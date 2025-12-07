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
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Gauge,
  Beaker,
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

// Sol type definitions
const SOL_TYPES = ["Starch Sol", "Sulphur Sol", "True Solution (Control)"] as const;

type SolType = (typeof SOL_TYPES)[number];
type ColloidStatus = "Not Formed" | "Weak Colloid" | "Stable Colloid" | "Unstable Colloid";
type ScatteringLevel = "No scattering" | "Faint scattering" | "Strong scattering" | "Irregular scattering";

// Default values
const DEFAULT_SOL_TYPE: SolType = "Starch Sol";
const DEFAULT_CONCENTRATION = 2.0; // %

// Calculate colloid status and scattering based on sol type and concentration
const calculateColloidStatus = (
  solType: SolType,
  concentration: number
): { status: ColloidStatus; scattering: ScatteringLevel; stabilityScore: number } => {
  if (solType === "True Solution (Control)") {
    return {
      status: "Not Formed",
      scattering: "No scattering",
      stabilityScore: 0,
    };
  }

  if (concentration < 1.0) {
    return {
      status: "Weak Colloid",
      scattering: "Faint scattering",
      stabilityScore: 0.3,
    };
  } else if (concentration >= 1.0 && concentration <= 6.0) {
    return {
      status: "Stable Colloid",
      scattering: "Strong scattering",
      stabilityScore: 0.9,
    };
  } else {
    return {
      status: "Unstable Colloid",
      scattering: "Irregular scattering",
      stabilityScore: 0.5,
    };
  }
};

export default function ColloidalSolutionLab() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, updateProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [experiment, setExperiment] = useState<ExperimentData | null>(null);
  const [experimentRunId, setExperimentRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [solType, setSolType] = useState<SolType>(DEFAULT_SOL_TYPE);
  const [concentration, setConcentration] = useState(DEFAULT_CONCENTRATION);
  const [isExperimentStarted, setIsExperimentStarted] = useState(false);
  const [stabilityProgress, setStabilityProgress] = useState(100);
  const [isCompleted, setIsCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [interactionCount, setInteractionCount] = useState(0);
  const prevValuesRef = useRef({
    solType: DEFAULT_SOL_TYPE,
    concentration: DEFAULT_CONCENTRATION,
  });

  const { status: colloidStatus, scattering: scatteringLevel, stabilityScore } =
    calculateColloidStatus(solType, concentration);

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

  // Track parameter changes
  useEffect(() => {
    if (experimentRunId && !isCompleted) {
      const hasChanged =
        prevValuesRef.current.solType !== solType ||
        prevValuesRef.current.concentration !== concentration;

      if (hasChanged) {
        setInteractionCount((prev) => prev + 1);
        prevValuesRef.current = { solType, concentration };

        const timeoutId = setTimeout(() => {
          logEvent("parameter_changed", {
            param: solType !== prevValuesRef.current.solType ? "solType" : "concentration",
            value: solType !== prevValuesRef.current.solType ? solType : concentration,
          });
        }, 500);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [solType, concentration, experimentRunId, isCompleted]);

  // Stability decay animation for unstable colloids
  useEffect(() => {
    if (
      isExperimentStarted &&
      colloidStatus === "Unstable Colloid" &&
      stabilityProgress > 0
    ) {
      const interval = setInterval(() => {
        setStabilityProgress((prev) => {
          const newValue = Math.max(0, prev - 1);
          return newValue;
        });
      }, 100); // Decrease by 1% every 100ms (10 seconds total)

      return () => clearInterval(interval);
    } else if (colloidStatus !== "Unstable Colloid") {
      setStabilityProgress(100);
    }
  }, [isExperimentStarted, colloidStatus, stabilityProgress]);

  // Draw the Tyndall effect visualization
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

    // Define regions
    const lightSourceWidth = width * 0.15;
    const beakerX = width * 0.4;
    const beakerY = height * 0.3;
    const beakerWidth = width * 0.3;
    const beakerHeight = height * 0.4;

    // Light source (left side)
    const lightX = lightSourceWidth / 2;
    const lightY = height / 2;

    // Draw light beam
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.8;

    // Calculate beam intensity based on concentration (varies smoothly)
    let beamOpacity = 0;
    let beamWidth = 1;
    let particleCount = 0;

    if (scatteringLevel === "No scattering") {
      // True Solution: completely invisible inside beaker
      beamOpacity = 0;
      beamWidth = 1;
      particleCount = 0;
    } else if (scatteringLevel === "Faint scattering") {
      // Weak Colloid (0-1%): intensity scales with concentration
      // At 0%: opacity 0, at 1%: opacity 0.4
      beamOpacity = (concentration / 1.0) * 0.4;
      beamWidth = 2 + (concentration / 1.0) * 1; // 2-3px
      particleCount = Math.floor((concentration / 1.0) * 5); // 0-5 particles
    } else if (scatteringLevel === "Strong scattering") {
      // Stable Colloid (1-6%): intensity scales with concentration
      // At 1%: opacity 0.4, at 6%: opacity 0.9
      const normalizedConc = (concentration - 1.0) / (6.0 - 1.0); // 0 to 1
      beamOpacity = 0.4 + normalizedConc * 0.5; // 0.4 to 0.9
      beamWidth = 3 + normalizedConc * 2; // 3-5px
      particleCount = 5 + Math.floor(normalizedConc * 10); // 5-15 particles
    } else if (scatteringLevel === "Irregular scattering") {
      // Unstable Colloid (>6%): intensity decreases slightly due to settling
      // At 6%: opacity 0.9, at 10%: opacity 0.7
      const normalizedConc = (concentration - 6.0) / (10.0 - 6.0); // 0 to 1
      beamOpacity = 0.9 - normalizedConc * 0.2; // 0.9 to 0.7 (decreases)
      beamWidth = 5 - normalizedConc * 1; // 5-4px
      particleCount = 15 - Math.floor(normalizedConc * 5); // 15-10 particles
    }

    // Draw beam BEFORE beaker (visible for all solutions)
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(lightX, lightY);
    ctx.lineTo(beakerX, beakerY + beakerHeight / 2);
    ctx.stroke();

    // Draw beaker
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#e2e8f0";
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;

    // Beaker shape (trapezoid)
    ctx.beginPath();
    ctx.moveTo(beakerX, beakerY);
    ctx.lineTo(beakerX + beakerWidth, beakerY);
    ctx.lineTo(beakerX + beakerWidth * 0.9, beakerY + beakerHeight);
    ctx.lineTo(beakerX + beakerWidth * 0.1, beakerY + beakerHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Solution inside beaker (color based on sol type)
    let solutionColor = "#ffffff"; // Clear/colorless for True Solution
    if (solType === "Starch Sol") {
      solutionColor = "#fef3c7"; // Light yellow
    } else if (solType === "Sulphur Sol") {
      solutionColor = "#fde68a"; // Yellow
    }

    ctx.fillStyle = solutionColor;
    ctx.fillRect(
      beakerX + beakerWidth * 0.1,
      beakerY + beakerHeight * 0.3,
      beakerWidth * 0.8,
      beakerHeight * 0.7
    );

    // Draw scattered particles/light points inside beaker (Tyndall effect)
    // Particles visible even before experiment starts to show real-time changes
    if (particleCount > 0) {
      const beamStartX = lightX;
      const beamStartY = lightY;
      const beamEndX = beakerX;
      const beamEndY = beakerY + beakerHeight / 2;
      
      // Calculate beam path
      const beamLength = Math.sqrt(
        Math.pow(beamEndX - beamStartX, 2) +
          Math.pow(beamEndY - beamStartY, 2)
      );

      ctx.fillStyle = "#fbbf24";
      
      const time = Date.now() / 1000;

      for (let i = 0; i < particleCount; i++) {
        // Position along beam path
        const t = (i / particleCount) + (time * 0.1) % 1;
        const clampedT = t % 1;
        
        const x = beamStartX + (beamEndX - beamStartX) * clampedT;
        const y = beamStartY + (beamEndY - beamStartY) * clampedT;
        
        // Add random offset for scattering effect
        const offsetX = (Math.random() - 0.5) * 15;
        const offsetY = (Math.random() - 0.5) * 15;
        
        // Animate particles with pulsing
        const pulse = Math.sin(time * 3 + i) * 0.3 + 0.7;
        const particleOpacity = beamOpacity * pulse;

        ctx.globalAlpha = particleOpacity;
        ctx.beginPath();
        ctx.arc(x + offsetX, y + offsetY, 2 + pulse * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw beam path through beaker (always visible, intensity varies with concentration)
    // Beam updates in real-time as concentration changes
    ctx.strokeStyle = "#fbbf24";
    ctx.setLineDash([]);

    // For True Solution: beam is INVISIBLE inside beaker (no Tyndall effect)
    // Only visible before entering and after exiting
    if (scatteringLevel === "No scattering") {
      // True Solution: beam invisible inside beaker
      // Only draw beam entering (already drawn above) and exiting
      ctx.globalAlpha = 0.3; // Very faint exiting beam
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(beakerX + beakerWidth, beakerY + beakerHeight / 2);
      ctx.lineTo(width * 0.85, beakerY + beakerHeight / 2);
      ctx.stroke();
    } else {
      // Colloidal solutions: beam visible inside beaker with scattering
      // Intensity varies smoothly with concentration - updates in real-time
      ctx.globalAlpha = beamOpacity;
      ctx.lineWidth = beamWidth;

      // Beam inside beaker (scattered) - visible due to Tyndall effect
      ctx.beginPath();
      ctx.moveTo(beakerX, beakerY + beakerHeight / 2);
      const scatterX = beakerX + beakerWidth * 0.5;
      const scatterY = beakerY + beakerHeight / 2 + (Math.random() - 0.5) * 20;
      ctx.lineTo(scatterX, scatterY);
      ctx.stroke();

      // Additional scattered rays - number varies with concentration
      // Show more rays for higher concentrations
      const numScatterRays = scatteringLevel === "Strong scattering" 
        ? Math.min(5, Math.floor(3 + (concentration - 1.0) / 2.5)) // 3-5 rays for 1-6%
        : scatteringLevel === "Faint scattering"
        ? Math.floor(concentration * 2) // 0-2 rays for 0-1%
        : 2; // 2 rays for unstable
      
      if (numScatterRays > 0) {
        for (let i = 0; i < numScatterRays; i++) {
          ctx.beginPath();
          ctx.moveTo(beakerX + beakerWidth * 0.2, beakerY + beakerHeight / 2);
          ctx.lineTo(
            beakerX + beakerWidth * 0.6,
            beakerY + beakerHeight / 2 + (Math.random() - 0.5) * 30
          );
          ctx.globalAlpha = beamOpacity * 0.6;
          ctx.stroke();
        }
      }

      // Beam exiting beaker (visible but weaker than inside)
      ctx.globalAlpha = beamOpacity * 0.5;
      ctx.lineWidth = beamWidth * 0.7;
      ctx.beginPath();
      ctx.moveTo(beakerX + beakerWidth, beakerY + beakerHeight / 2);
      ctx.lineTo(width * 0.85, beakerY + beakerHeight / 2);
      ctx.stroke();
    }

    // Labels
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#1e293b";
    ctx.font = "14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Light Source", lightX, height - 20);
    ctx.fillText("Beaker", beakerX + beakerWidth / 2, height - 20);
  }, [
    solType,
    concentration,
    scatteringLevel,
    isExperimentStarted,
  ]);

  // Animation loop for continuous particle animation
  useEffect(() => {
    if (!isExperimentStarted) {
      drawVisualization();
      return;
    }

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
  }, [drawVisualization, isExperimentStarted]);

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

  const handleStartExperiment = () => {
    setIsExperimentStarted(true);
    setStabilityProgress(100);
    logEvent("experiment_started", {
      solType,
      concentration,
      colloidStatus,
      scatteringLevel,
    });
  };

  const handleReset = () => {
    setIsExperimentStarted(false);
    setStabilityProgress(100);
    setSolType(DEFAULT_SOL_TYPE);
    setConcentration(DEFAULT_CONCENTRATION);
    prevValuesRef.current = {
      solType: DEFAULT_SOL_TYPE,
      concentration: DEFAULT_CONCENTRATION,
    };
    setIsCompleted(false);
    logEvent("experiment_reset", {});
  };

  const handleSaveObservation = async () => {
    if (!experimentRunId || !experiment || !user) return;

    // Calculate score based on interactions
    const baseScore = 50;
    const interactionBonus = Math.min(50, interactionCount * 5);
    const score = Math.min(100, baseScore + interactionBonus);

    setScore(score);
    setIsCompleted(true);

    // Save to colloid_runs table
    const { error: colloidError } = await supabase
      .from("colloid_runs")
      .insert({
        user_id: user.id,
        sol_type: solType,
        concentration: concentration,
        colloid_status: colloidStatus,
        scattering_level: scatteringLevel,
        stability_score: stabilityScore,
      });

    if (colloidError) {
      console.error("Error saving Colloid result:", colloidError);
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
          solType,
          concentration,
          colloidStatus,
          scatteringLevel,
          stabilityScore,
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
          subject: "Chemistry",
        },
      };

      await checkAndAwardBadges(user.id, newXP, completedRun);
    }

    logEvent("experiment_completed", {
      score,
      solType,
      concentration,
      colloidStatus,
      scatteringLevel,
      stabilityScore,
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
              <FlaskConical className="h-8 w-8 text-primary" />
              {experiment?.name || "Preparation of Colloidal Solution"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {experiment?.description ||
                "Explore the Tyndall effect and observe how colloidal solutions scatter light"}
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
                  <Gauge className="h-5 w-5 text-primary" />
                  Experiment Controls
                </CardTitle>
                <CardDescription>
                  Select sol type and concentration to observe colloidal formation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Sol Type Dropdown */}
                <div className="space-y-2">
                  <Label htmlFor="sol-type" className="text-base font-semibold">
                    Sol Type
                  </Label>
                  <Select
                    value={solType}
                    onValueChange={(value) => setSolType(value as SolType)}
                    disabled={isExperimentStarted || isCompleted}
                  >
                    <SelectTrigger
                      id="sol-type"
                      aria-label="Sol type selector"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOL_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Concentration Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="concentration"
                      className="text-base font-semibold"
                    >
                      Concentration (%)
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      Range: 0-10%
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="concentration"
                      min={0}
                      max={10}
                      step={0.1}
                      value={[concentration]}
                      onValueChange={(value) => setConcentration(value[0])}
                      disabled={isExperimentStarted || isCompleted}
                      className="flex-1"
                      aria-label="Concentration slider"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={concentration.toFixed(1)}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(10, parseFloat(e.target.value) || 0));
                        setConcentration(val);
                      }}
                      disabled={isExperimentStarted || isCompleted}
                      className="w-24"
                      aria-label="Concentration input"
                    />
                    <span className="text-sm font-medium w-8">%</span>
                  </div>
                </div>

                {/* Colloid Status Display */}
                <div className="p-4 rounded-lg bg-primary/10 border-2 border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">
                      Colloid Status:
                    </span>
                    <span className="text-base font-bold text-primary">
                      {colloidStatus}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">
                      Scattering:
                    </span>
                    <span className="text-sm font-medium text-accent">
                      {scatteringLevel}
                    </span>
                  </div>
                </div>

                {/* Stability Bar (for unstable colloids) */}
                {isExperimentStarted && colloidStatus === "Unstable Colloid" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <Label className="text-muted-foreground">
                        Stability:
                      </Label>
                      <span className="font-medium">{stabilityProgress}%</span>
                    </div>
                    <Progress value={stabilityProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Colloid is settling over time
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={isCompleted}
                    className="gap-2"
                    aria-label="Reset experiment"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                  <Button
                    variant="hero"
                    onClick={handleStartExperiment}
                    disabled={isExperimentStarted || isCompleted}
                    className="gap-2 flex-1"
                    aria-label="Start experiment"
                  >
                    <Beaker className="h-4 w-4" />
                    Start Experiment
                  </Button>
                  <Button
                    variant="success"
                    onClick={handleSaveObservation}
                    disabled={!isExperimentStarted || isCompleted}
                    className="gap-2 w-full"
                    aria-label="Save observation"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Save Observation
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Visualization Card */}
            <Card className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <CardHeader>
                <CardTitle>Tyndall Effect Visualization</CardTitle>
                <CardDescription>
                  Observe how light scatters in colloidal solutions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative bg-gradient-to-b from-secondary/30 to-secondary/10 rounded-xl overflow-hidden p-4">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={400}
                    className="w-full h-auto max-w-full mx-auto block"
                    aria-label="Colloidal solution experiment visualization showing light source, beaker, and Tyndall effect"
                  />
                </div>
                {/* Description for screen readers */}
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Tyndall effect: scattering of light by colloidal particles.
                  Stronger scattering = more visible beam.
                </p>
                <div className="sr-only">
                  Colloidal solution experiment visualization. Light source on the
                  left emits a beam through a beaker containing {solType} at{" "}
                  {concentration}% concentration. {scatteringLevel}. Colloid status:{" "}
                  {colloidStatus}.
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
                    "Select a sol type from the dropdown",
                    "Adjust the concentration slider (0-10%)",
                    "Observe how colloid status changes with concentration",
                    "Click 'Start Experiment' to begin observation",
                    "Watch the Tyndall effect visualization in the beaker",
                    "Watch the stability bar for unstable colloids",
                    "Click 'Save Observation' when finished",
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
                <CardTitle>About Colloids</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  <strong>Colloids</strong> are mixtures where particles are
                  dispersed in a medium. The <strong>Tyndall effect</strong> is
                  the scattering of light by colloidal particles, making the
                  light beam visible.
                </p>
                <div className="space-y-2">
                  <p>
                    <strong>True Solution:</strong> Particles are too small to
                    scatter light. No Tyndall effect observed.
                  </p>
                  <p>
                    <strong>Weak Colloid:</strong> Low concentration results in
                    faint scattering.
                  </p>
                  <p>
                    <strong>Stable Colloid:</strong> Optimal concentration
                    shows strong, visible scattering.
                  </p>
                  <p>
                    <strong>Unstable Colloid:</strong> High concentration causes
                    particles to settle over time.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Current Settings Card */}
            <Card className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
              <CardHeader>
                <CardTitle>Current Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Sol Type: </span>
                  <span className="font-medium">{solType}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Concentration: </span>
                  <span className="font-medium">{concentration.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <span className="font-medium">{colloidStatus}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Scattering: </span>
                  <span className="font-medium">{scatteringLevel}</span>
                </div>
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
                    <div className="text-4xl font-bold text-gold mb-2">
                      {score}%
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {score >= 90
                        ? "Excellent work!"
                        : score >= 70
                        ? "Good job!"
                        : "Keep practicing!"}
                    </p>
                    <div className="text-sm space-y-1">
                      <p>
                        Sol Type: <span className="font-medium">{solType}</span>
                      </p>
                      <p>
                        Concentration:{" "}
                        <span className="font-medium">{concentration.toFixed(1)}%</span>
                      </p>
                      <p>
                        Final Status:{" "}
                        <span className="font-medium">{colloidStatus}</span>
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

