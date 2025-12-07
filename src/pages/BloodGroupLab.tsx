import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { checkAndAwardBadges } from "@/lib/badgeUtils";
import {
  RotateCcw,
  CheckCircle,
  FlaskConical,
  Info,
  Droplet,
  TestTube,
} from "lucide-react";

interface ExperimentData {
  id: string;
  name: string;
  description: string;
  xp_reward: number;
  instructions: {
    steps?: string[];
    objectives?: string[];
  } | null;
}

// Blood sample definitions with their antigen presence
const BLOOD_SAMPLES = [
  { id: "Sample A", bloodGroup: "A+", antiA: true, antiB: false, antiD: true },
  { id: "Sample B", bloodGroup: "B+", antiA: false, antiB: true, antiD: true },
  { id: "Sample C", bloodGroup: "AB-", antiA: true, antiB: true, antiD: false },
  { id: "Unknown Sample", bloodGroup: "O-", antiA: false, antiB: false, antiD: false },
] as const;

type Reagent = "Anti-A" | "Anti-B" | "Anti-D";
type Reaction = "positive" | "negative";

interface SampleData {
  id: string;
  bloodGroup: string;
  antiA: boolean;
  antiB: boolean;
  antiD: boolean;
}

// Default values
const DEFAULT_SAMPLE = "Sample A";

export default function BloodGroupLab() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, updateProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [experiment, setExperiment] = useState<ExperimentData | null>(null);
  const [experimentRunId, setExperimentRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedSample, setSelectedSample] = useState<string>(DEFAULT_SAMPLE);
  const [appliedReagents, setAppliedReagents] = useState<Set<Reagent>>(new Set());
  const [reactions, setReactions] = useState<Record<Reagent, Reaction | null>>({
    "Anti-A": null,
    "Anti-B": null,
    "Anti-D": null,
  });
  const [isCompleted, setIsCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [interactionCount, setInteractionCount] = useState(0);

  // Get current sample data
  const currentSample = BLOOD_SAMPLES.find((s) => s.id === selectedSample) || BLOOD_SAMPLES[0];

  // Calculate blood group from reactions
  const determineBloodGroup = useCallback((): string => {
    const antiA = reactions["Anti-A"];
    const antiB = reactions["Anti-B"];
    const antiD = reactions["Anti-D"];

    if (antiA === null || antiB === null || antiD === null) {
      return "Unknown";
    }

    let group = "";
    if (antiA === "positive" && antiB === "positive") {
      group = "AB";
    } else if (antiA === "positive") {
      group = "A";
    } else if (antiB === "positive") {
      group = "B";
    } else {
      group = "O";
    }

    const rh = antiD === "positive" ? "+" : "-";
    return `${group}${rh}`;
  }, [reactions]);

  const bloodGroup = determineBloodGroup();

  useEffect(() => {
    if (id) {
      fetchExperiment();
    }
  }, [id]);

  useEffect(() => {
    if (experiment && user && !experimentRunId) {
      startExperimentRun();
    }
  }, [experiment, user, experimentRunId]);

  useEffect(() => {
    if (experiment && user && experimentRunId) {
      logEvent("experiment_started", { experiment_id: experiment.id });
    }
  }, [experimentRunId]);

  // Reset when sample changes
  useEffect(() => {
    setAppliedReagents(new Set());
    setReactions({
      "Anti-A": null,
      "Anti-B": null,
      "Anti-D": null,
    });
    setIsCompleted(false);
  }, [selectedSample]);

  // Draw the blood group determination visualization
  const drawVisualization = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    // Glass slide dimensions
    const slideX = width * 0.1;
    const slideY = height * 0.2;
    const slideWidth = width * 0.8;
    const slideHeight = height * 0.5;
    const sectionWidth = slideWidth / 3;

    // Draw glass slide background
    ctx.fillStyle = "#e2e8f0";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.fillRect(slideX, slideY, slideWidth, slideHeight);
    ctx.strokeRect(slideX, slideY, slideWidth, slideHeight);

    // Draw section dividers
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(slideX + sectionWidth, slideY);
    ctx.lineTo(slideX + sectionWidth, slideY + slideHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(slideX + sectionWidth * 2, slideY);
    ctx.lineTo(slideX + sectionWidth * 2, slideY + slideHeight);
    ctx.stroke();

    // Section labels
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 16px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Anti-A", slideX + sectionWidth * 0.5, slideY - 10);
    ctx.fillText("Anti-B", slideX + sectionWidth * 1.5, slideY - 10);
    ctx.fillText("Anti-D", slideX + sectionWidth * 2.5, slideY - 10);

    // Draw blood drops in each section
    const dropRadius = 40;
    const dropY = slideY + slideHeight / 2;

    ["Anti-A", "Anti-B", "Anti-D"].forEach((reagent, index) => {
      const dropX = slideX + sectionWidth * (index + 0.5);
      const isApplied = appliedReagents.has(reagent as Reagent);
      const reaction = reactions[reagent as Reagent];

      if (isApplied) {
        // Draw agglutinated blood (clumped)
        if (reaction === "positive") {
          // Positive reaction: show clumps/grains
          ctx.fillStyle = "#dc2626"; // Dark red for clumps
          
          const time = Date.now() / 1000;
          const numClumps = 8 + Math.floor(Math.sin(time) * 2);

          // Draw multiple clumps
          for (let i = 0; i < numClumps; i++) {
            const angle = (i / numClumps) * Math.PI * 2;
            const distance = dropRadius * 0.6;
            const clumpX = dropX + Math.cos(angle) * distance;
            const clumpY = dropY + Math.sin(angle) * distance;
            const clumpSize = 8 + Math.sin(time * 2 + i) * 2;

            // Add jitter for clumps
            const jitterX = (Math.random() - 0.5) * 3;
            const jitterY = (Math.random() - 0.5) * 3;

            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.arc(clumpX + jitterX, clumpY + jitterY, clumpSize, 0, Math.PI * 2);
            ctx.fill();
          }

          // Draw central cluster
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.arc(dropX, dropY, dropRadius * 0.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Negative reaction: smooth drop
          ctx.fillStyle = "#ef4444"; // Bright red
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(dropX, dropY, dropRadius, 0, Math.PI * 2);
          ctx.fill();

          // Add slight gradient for depth
          const gradient = ctx.createRadialGradient(
            dropX - 10,
            dropY - 10,
            0,
            dropX,
            dropY,
            dropRadius
          );
          gradient.addColorStop(0, "rgba(239, 68, 68, 0.9)");
          gradient.addColorStop(1, "rgba(220, 38, 38, 0.6)");
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      } else {
        // Draw initial smooth blood drop (before reagent)
        ctx.fillStyle = "#ef4444";
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(dropX, dropY, dropRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw slide label
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#64748b";
    ctx.font = "14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Glass Slide", slideX + slideWidth / 2, slideY + slideHeight + 30);
  }, [appliedReagents, reactions]);

  useEffect(() => {
    drawVisualization();
  }, [drawVisualization]);

  // Animation loop for agglutination
  useEffect(() => {
    const hasPositiveReaction = Object.values(reactions).some((r) => r === "positive");
    
    if (hasPositiveReaction) {
      const animate = () => {
        drawVisualization();
        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    } else {
      drawVisualization();
    }
  }, [drawVisualization, reactions]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const maxWidth = Math.min(800, Math.max(400, rect.width - 32));
      const aspectRatio = 400 / 600;
      canvas.width = maxWidth;
      canvas.height = maxWidth * aspectRatio;
      drawVisualization();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [drawVisualization]);

  const fetchExperiment = async () => {
    const { data } = await supabase
      .from("experiments")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (data) {
      setExperiment(data as unknown as ExperimentData);
    } else {
      toast.error("Experiment not found");
      navigate("/experiments");
    }
    setLoading(false);
  };

  const startExperimentRun = async () => {
    if (!user || !experiment) return;

    try {
      const { data, error } = await supabase
        .from("experiment_runs")
        .insert({
          user_id: user.id,
          experiment_id: experiment.id,
          status: "in_progress",
        })
        .select()
        .single();

      if (data && !error) {
        setExperimentRunId(data.id);
      } else if (error) {
        console.error("Error starting experiment run:", error);
      }
    } catch (err) {
      console.error("Error starting experiment run:", err);
    }
  };

  const logEvent = async (eventType: string, eventData: any) => {
    if (!user || !experimentRunId) return;

    await supabase.from("event_logs").insert([
      {
        user_id: user.id,
        experiment_run_id: experimentRunId,
        event_type: eventType,
        event_data: eventData,
      },
    ]);
  };

  const handleAddReagent = (reagent: Reagent) => {
    if (appliedReagents.has(reagent)) {
      toast.info(`${reagent} has already been applied`);
      return;
    }

    setAppliedReagents((prev) => new Set(prev).add(reagent));
    setInteractionCount((prev) => prev + 1);

    // Determine reaction based on sample antigens
    let reaction: Reaction = "negative";
    if (reagent === "Anti-A" && currentSample.antiA) {
      reaction = "positive";
    } else if (reagent === "Anti-B" && currentSample.antiB) {
      reaction = "positive";
    } else if (reagent === "Anti-D" && currentSample.antiD) {
      reaction = "positive";
    }

    setReactions((prev) => ({
      ...prev,
      [reagent]: reaction,
    }));

    logEvent("reagent_added", { reagent, reaction, sample_id: selectedSample });

    // Check if all reagents applied
    const newApplied = new Set(appliedReagents).add(reagent);
    if (newApplied.size === 3) {
      const detectedGroup = determineBloodGroup();
      logEvent("experiment_completed", { blood_group: detectedGroup });
    }
  };

  const handleReset = () => {
    setAppliedReagents(new Set());
    setReactions({
      "Anti-A": null,
      "Anti-B": null,
      "Anti-D": null,
    });
    setIsCompleted(false);
    logEvent("experiment_reset", {});
  };

  const handleSubmitResult = async () => {
    if (!experimentRunId || !experiment || !user) return;

    // Check if all reagents are applied
    if (appliedReagents.size < 3) {
      toast.error("Please apply all three reagents before submitting");
      return;
    }

    // Calculate score based on interactions
    const baseScore = 50;
    const interactionBonus = Math.min(50, interactionCount * 5);
    const score = Math.min(100, baseScore + interactionBonus);

    setScore(score);
    setIsCompleted(true);

    // Save to bloodgroup_runs table
    const { error: bloodError } = await supabase
      .from("bloodgroup_runs")
      .insert({
        user_id: user.id,
        sample_id: selectedSample,
        anti_a: reactions["Anti-A"] || "negative",
        anti_b: reactions["Anti-B"] || "negative",
        anti_d: reactions["Anti-D"] || "negative",
        blood_group: bloodGroup,
      });

    if (bloodError) {
      console.error("Error saving Blood Group result:", bloodError);
      toast.error("Failed to save result");
      return;
    }

    // Calculate XP
    const baseXP = Math.max(10, Math.round((score / 100) * experiment.xp_reward));
    const xpEarned = baseXP;

    const { error: updateError } = await supabase
      .from("experiment_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        score: score,
        accuracy: score,
        xp_earned: xpEarned,
        data: {
          sample_id: selectedSample,
          reactions,
          blood_group: bloodGroup,
          interaction_count: interactionCount,
        },
      })
      .eq("id", experimentRunId);

    if (updateError) {
      console.error("Error updating experiment run:", updateError);
      toast.error("Failed to update experiment run");
      return;
    }

    // Update user XP
    let newXP = profile?.xp_points || 0;
    if (profile) {
      newXP = profile.xp_points + xpEarned;
      const newLevel = Math.floor(newXP / 500) + 1;
      const { error: profileError } = await updateProfile({
        xp_points: newXP,
        level: newLevel,
      });

      if (profileError) {
        console.error("Error updating profile:", profileError);
      }
    }

    // Check and award badges
    if (user) {
      const completedRun = {
        id: experimentRunId,
        experiment_id: experiment.id,
        status: "completed",
        score: score,
        accuracy: score,
        experiments: {
          name: experiment.name || "",
          subject: "Biology",
        },
      };

      await checkAndAwardBadges(user.id, newXP, completedRun);
    }

    logEvent("experiment_completed", {
      score,
      sample_id: selectedSample,
      reactions,
      blood_group: bloodGroup,
      xp_earned: xpEarned,
    });

    toast.success(`Experiment completed! You earned ${xpEarned} XP!`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-secondary rounded w-1/3" />
            <div className="h-[500px] bg-secondary rounded" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <TestTube className="h-8 w-8 text-primary" />
              {experiment?.name || "Blood Group Determination"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {experiment?.description ||
                "Determine blood groups using agglutination reactions with specific antibodies"}
            </p>
          </div>
          <Badge className="bg-gold/10 text-gold border-gold/20">
            +{experiment?.xp_reward || 150} XP
          </Badge>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Experiment Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Controls Card */}
            <Card variant="elevated" className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  Experiment Controls
                </CardTitle>
                <CardDescription>
                  Select a blood sample and apply reagents to determine the blood group
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Sample Selection */}
                <div className="space-y-2">
                  <Label htmlFor="sample" className="text-base font-semibold">
                    Blood Sample ID
                  </Label>
                  <Select
                    value={selectedSample}
                    onValueChange={setSelectedSample}
                    disabled={isCompleted}
                  >
                    <SelectTrigger id="sample" aria-label="Blood sample selector">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOOD_SAMPLES.map((sample) => (
                        <SelectItem key={sample.id} value={sample.id}>
                          {sample.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Reagent Buttons */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Reagents</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {(["Anti-A", "Anti-B", "Anti-D"] as Reagent[]).map((reagent) => {
                      const isApplied = appliedReagents.has(reagent);
                      const reaction = reactions[reagent];
                      return (
                        <Button
                          key={reagent}
                          variant={isApplied ? (reaction === "positive" ? "destructive" : "outline") : "default"}
                          onClick={() => handleAddReagent(reagent)}
                          disabled={isApplied || isCompleted}
                          className="gap-2"
                          aria-label={`Apply ${reagent} reagent`}
                        >
                          <Droplet className="h-4 w-4" />
                          {reagent}
                          {isApplied && (
                            <Badge variant="secondary" className="ml-1">
                              {reaction === "positive" ? "+" : "-"}
                            </Badge>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Agglutination indicates presence of corresponding antigen.
                  </p>
                </div>

                {/* Reaction Results */}
                <div className="p-4 rounded-lg bg-primary/10 border-2 border-primary/20 space-y-2">
                  <Label className="text-base font-semibold">Reaction Results</Label>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Reaction with Anti-A:</span>
                      <span className="font-medium">
                        {reactions["Anti-A"] ? (
                          <Badge variant={reactions["Anti-A"] === "positive" ? "destructive" : "secondary"}>
                            {reactions["Anti-A"] === "positive" ? "Positive" : "Negative"}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Not tested</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Reaction with Anti-B:</span>
                      <span className="font-medium">
                        {reactions["Anti-B"] ? (
                          <Badge variant={reactions["Anti-B"] === "positive" ? "destructive" : "secondary"}>
                            {reactions["Anti-B"] === "positive" ? "Positive" : "Negative"}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Not tested</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Reaction with Anti-D:</span>
                      <span className="font-medium">
                        {reactions["Anti-D"] ? (
                          <Badge variant={reactions["Anti-D"] === "positive" ? "destructive" : "secondary"}>
                            {reactions["Anti-D"] === "positive" ? "Positive" : "Negative"}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Not tested</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Final Blood Group */}
                {appliedReagents.size === 3 && (
                  <div className="p-4 rounded-lg bg-accent/10 border-2 border-accent/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-muted-foreground">
                        Final Blood Group:
                      </span>
                      <span className="text-2xl font-bold text-accent">{bloodGroup}</span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={isCompleted}
                    className="gap-2"
                    aria-label="Reset slide"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset Slide
                  </Button>
                  <Button
                    variant="hero"
                    onClick={handleSubmitResult}
                    disabled={appliedReagents.size < 3 || isCompleted}
                    className="gap-2 flex-1"
                    aria-label="Submit result"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Submit Result
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Visualization Card */}
            <Card className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <CardHeader>
                <CardTitle>Agglutination Visualization</CardTitle>
                <CardDescription>
                  Observe the glass slide to see agglutination reactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative bg-gradient-to-b from-secondary/30 to-secondary/10 rounded-xl overflow-hidden p-4">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={400}
                    className="w-full h-auto max-w-full mx-auto block"
                    aria-label="Blood group determination visualization showing glass slide with three sections for Anti-A, Anti-B, and Anti-D reagents"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Agglutination (clumping) indicates presence of corresponding antigen.
                </p>
                <div className="sr-only">
                  Blood group determination visualization. Glass slide with three sections:
                  Anti-A, Anti-B, and Anti-D. Each section shows a blood drop. When a reagent
                  is applied, agglutination (clumping) indicates a positive reaction.
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Instructions */}
            <Card className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-accent" />
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm">
                  {(experiment?.instructions?.steps || [
                    "Select a blood sample from the dropdown",
                    "Click on each reagent button (Anti-A, Anti-B, Anti-D) to apply it",
                    "Observe the agglutination reaction on the glass slide",
                    "Positive reaction shows clumping, negative shows smooth drop",
                    "After applying all three reagents, the blood group will be determined",
                    "Click 'Submit Result' when finished",
                  ]).map((step, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <CardHeader>
                <CardTitle>About Blood Groups</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  <strong>Blood groups</strong> are determined by the presence or absence of
                  specific antigens (A, B) and the Rh factor (D antigen) on red blood cells.
                </p>
                <div className="space-y-2">
                  <p>
                    <strong>Agglutination:</strong> When an antibody (Anti-A, Anti-B, or Anti-D)
                    binds to its corresponding antigen, it causes red blood cells to clump together.
                  </p>
                  <p>
                    <strong>Positive reaction:</strong> Visible clumping indicates the antigen is
                    present.
                  </p>
                  <p>
                    <strong>Negative reaction:</strong> No clumping indicates the antigen is absent.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Current Status Card */}
            <Card className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
              <CardHeader>
                <CardTitle>Current Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Sample: </span>
                  <span className="font-medium">{selectedSample}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Reagents Applied: </span>
                  <span className="font-medium">{appliedReagents.size}/3</span>
                </div>
                {appliedReagents.size === 3 && (
                  <div>
                    <span className="text-muted-foreground">Blood Group: </span>
                    <span className="font-medium text-accent">{bloodGroup}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Completion Card */}
            {isCompleted && (
              <Card variant="gradient" className="animate-scale-in">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-gold" />
                    Experiment Complete!
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gold mb-2">{score}%</div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {score >= 90
                        ? "Excellent work!"
                        : score >= 70
                        ? "Good job!"
                        : "Keep practicing!"}
                    </p>
                    <div className="text-sm space-y-1">
                      <p>
                        Sample: <span className="font-medium">{selectedSample}</span>
                      </p>
                      <p>
                        Blood Group: <span className="font-medium">{bloodGroup}</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

