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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { checkAndAwardBadges } from "@/lib/badgeUtils";
import {
  FlaskConical,
  Droplet,
  RotateCcw,
  CheckCircle,
  Info,
  Beaker,
  Gauge,
  Award,
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

export default function TitrationExperiment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, updateProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [experiment, setExperiment] = useState<ExperimentData | null>(null);
  const [experimentRunId, setExperimentRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Simulation state
  const [buretteLevel, setBuretteLevel] = useState(50); // mL of NaOH in burette
  const [volumeAdded, setVolumeAdded] = useState(0); // mL added to flask
  const [pH, setPH] = useState(1.0); // Starting pH of HCl
  const [isDropping, setIsDropping] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [drops, setDrops] = useState<{ id: number; y: number }[]>([]);

  // Titration parameters
  const EQUIVALENCE_POINT = 25; // mL at equivalence
  const DROP_VOLUME = 0.5; // mL per drop

  useEffect(() => {
    if (id) {
      fetchExperiment();
    }
  }, [id]);

  useEffect(() => {
    if (experiment && user && !experimentRunId) {
      startExperimentRun();
    }
  }, [experiment, user]);

  useEffect(() => {
    // Draw the simulation
    drawSimulation();
  }, [buretteLevel, volumeAdded, pH, drops]);

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

    const { data, error } = await supabase
      .from("experiment_runs")
      .insert({
        user_id: user.id,
        experiment_id: experiment.id,
        status: "in_progress",
      })
      .select()
      .single();

    if (data) {
      setExperimentRunId(data.id);
      logEvent("experiment_started", { experiment_id: experiment.id });
    }
  };

  const logEvent = async (eventType: string, eventData: object) => {
    if (!user) return;

    await supabase.from("event_logs").insert([
      {
        user_id: user.id,
        experiment_run_id: experimentRunId,
        event_type: eventType,
        event_data: eventData,
      },
    ]);
  };

  const calculatePH = (volumeNaOH: number) => {
    // Simplified pH calculation for HCl + NaOH titration
    // HCl (25mL, 0.1M) + NaOH (0.1M)
    if (volumeNaOH < EQUIVALENCE_POINT * 0.9) {
      // Before equivalence point - acidic
      return 1.0 + (volumeNaOH / EQUIVALENCE_POINT) * 5;
    } else if (
      volumeNaOH >= EQUIVALENCE_POINT * 0.9 &&
      volumeNaOH <= EQUIVALENCE_POINT * 1.1
    ) {
      // Near equivalence point - rapid change
      const fraction =
        (volumeNaOH - EQUIVALENCE_POINT * 0.9) / (EQUIVALENCE_POINT * 0.2);
      return 6 + fraction * 6;
    } else {
      // After equivalence point - basic
      return Math.min(14, 12 + (volumeNaOH - EQUIVALENCE_POINT * 1.1) * 0.1);
    }
  };

  const getIndicatorColor = (currentPH: number) => {
    // Phenolphthalein: colorless below pH 8.2, pink above
    if (currentPH < 8.2) {
      return "rgba(255, 255, 255, 0.9)"; // Colorless (slight tint)
    } else if (currentPH < 10) {
      const intensity = (currentPH - 8.2) / 1.8;
      return `rgba(255, ${Math.round(100 - intensity * 100)}, ${Math.round(
        180 - intensity * 80
      )}, 0.9)`;
    } else {
      return "rgba(255, 0, 100, 0.9)"; // Deep pink
    }
  };

  const addDrop = useCallback(() => {
    if (buretteLevel <= 0 || isCompleted) return;

    setIsDropping(true);
    const dropId = Date.now();
    setDrops((prev) => [...prev, { id: dropId, y: 0 }]);

    logEvent("drop_added", {
      volume_before: volumeAdded,
      volume_after: volumeAdded + DROP_VOLUME,
      ph_before: pH,
    });

    // Animate drop falling
    const animateDrop = () => {
      setDrops((prev) => {
        const updated = prev.map((d) =>
          d.id === dropId ? { ...d, y: d.y + 8 } : d
        );

        const drop = updated.find((d) => d.id === dropId);
        if (drop && drop.y >= 200) {
          // Drop reached flask - update values
          setTimeout(() => {
            setBuretteLevel((prev) => Math.max(0, prev - DROP_VOLUME));
            setVolumeAdded((prev) => {
              const newVolume = prev + DROP_VOLUME;
              const newPH = calculatePH(newVolume);
              setPH(newPH);

              logEvent("measurement_taken", {
                volume: newVolume,
                ph: newPH,
              });

              return newVolume;
            });
            setDrops((prev) => prev.filter((d) => d.id !== dropId));
            setIsDropping(false);
          }, 0);
          return prev.filter((d) => d.id !== dropId);
        }

        if (drop && drop.y < 200) {
          requestAnimationFrame(animateDrop);
        }

        return updated;
      });
    };

    requestAnimationFrame(animateDrop);
  }, [buretteLevel, volumeAdded, pH, isCompleted, experimentRunId]);

  const completeExperiment = async () => {
    if (!experimentRunId || !experiment || !user) return;

    // Calculate score based on accuracy to equivalence point
    const deviation = Math.abs(volumeAdded - EQUIVALENCE_POINT);
    const accuracy = Math.max(0, 100 - deviation * 4);
    const finalScore = Math.round(accuracy);
    const xpEarned = Math.round((accuracy / 100) * experiment.xp_reward);

    setScore(finalScore);
    setIsCompleted(true);

    // Update experiment run
    await supabase
      .from("experiment_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        score: finalScore,
        accuracy: accuracy,
        xp_earned: xpEarned,
        data: {
          volume_added: volumeAdded,
          final_ph: pH,
          deviation_from_equivalence: deviation,
        },
      })
      .eq("id", experimentRunId);

    // Update user XP
    let newXP = profile?.xp_points || 0;
    if (profile) {
      newXP = profile.xp_points + xpEarned;
      const newLevel = Math.floor(newXP / 500) + 1;
      await updateProfile({
        xp_points: newXP,
        level: newLevel,
      });
    }

    // Check and award badges
    if (user) {
      const completedRun = {
        id: experimentRunId,
        experiment_id: experiment?.id || "",
        status: "completed",
        score: finalScore,
        accuracy: accuracy,
        experiments: {
          name: experiment?.name || "",
          subject: experiment?.subject || "",
        },
      };

      await checkAndAwardBadges(user.id, newXP, completedRun);
    }

    logEvent("experiment_completed", {
      score: finalScore,
      accuracy: accuracy,
      xp_earned: xpEarned,
      volume_added: volumeAdded,
      final_ph: pH,
    });

    toast.success(`Experiment completed! You earned ${xpEarned} XP!`);
  };

  const resetExperiment = () => {
    setBuretteLevel(50);
    setVolumeAdded(0);
    setPH(1.0);
    setIsCompleted(false);
    setScore(0);
    setDrops([]);
    setExperimentRunId(null);

    if (experiment && user) {
      startExperimentRun();
    }
  };

  const drawSimulation = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Background gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, "#f0f9ff");
    bgGradient.addColorStop(1, "#e0f2fe");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Draw stand
    ctx.fillStyle = "#64748b";
    ctx.fillRect(width / 2 - 5, 20, 10, height - 40);
    ctx.fillRect(width / 2 - 60, height - 30, 120, 10);

    // Draw burette (left side)
    const buretteX = width / 2 - 80;
    const buretteY = 50;
    const buretteWidth = 30;
    const buretteHeight = 200;

    // Burette glass
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.strokeRect(buretteX, buretteY, buretteWidth, buretteHeight);

    // Burette liquid level
    const liquidHeight = (buretteLevel / 50) * (buretteHeight - 20);
    const liquidGradient = ctx.createLinearGradient(
      buretteX,
      buretteY,
      buretteX + buretteWidth,
      buretteY
    );
    liquidGradient.addColorStop(0, "#3b82f6");
    liquidGradient.addColorStop(0.5, "#60a5fa");
    liquidGradient.addColorStop(1, "#3b82f6");
    ctx.fillStyle = liquidGradient;
    ctx.fillRect(
      buretteX + 2,
      buretteY + buretteHeight - 18 - liquidHeight,
      buretteWidth - 4,
      liquidHeight
    );

    // Burette tip
    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.moveTo(buretteX + 10, buretteY + buretteHeight);
    ctx.lineTo(buretteX + 20, buretteY + buretteHeight);
    ctx.lineTo(buretteX + 17, buretteY + buretteHeight + 30);
    ctx.lineTo(buretteX + 13, buretteY + buretteHeight + 30);
    ctx.closePath();
    ctx.fill();

    // Draw drops falling from burette tip
    drops.forEach((drop) => {
      const dropY = buretteY + buretteHeight + 30 + drop.y;
      // Only draw drops that haven't reached the beaker yet
      if (dropY < height - 120) {
        ctx.beginPath();
        ctx.arc(buretteX + 15, dropY, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#3b82f6";
        ctx.fill();
        // Add highlight to drop
        ctx.beginPath();
        ctx.arc(buretteX + 13, dropY - 1, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fill();
      }
    });

    // Draw beaker positioned directly under the burette tip
    const buretteTipX = buretteX + 15; // Center of burette tip
    const buretteTipY = buretteY + buretteHeight + 30; // Bottom of burette tip

    const beakerWidth = 90;
    const beakerHeight = 110;
    const beakerX = buretteTipX - beakerWidth / 2; // Center beaker under tip
    const beakerY = height - beakerHeight - 30; // Position above bottom with margin
    const beakerTopY = beakerY + 5; // Slight offset for rim

    // Draw beaker body - cylindrical shape (slightly wider at top)
    ctx.strokeStyle = "#94a3b8";
    ctx.fillStyle = "rgba(248, 250, 252, 0.8)";
    ctx.lineWidth = 2;

    // Beaker outline - trapezoid shape (wider at top, like real beaker)
    ctx.beginPath();
    ctx.moveTo(beakerX + 12, beakerTopY); // Top left
    ctx.lineTo(beakerX + beakerWidth - 12, beakerTopY); // Top right
    ctx.lineTo(beakerX + beakerWidth - 8, beakerY + beakerHeight - 15); // Bottom right
    ctx.lineTo(beakerX + 8, beakerY + beakerHeight - 15); // Bottom left
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Beaker rim (thicker, more prominent)
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(beakerX + 12, beakerTopY);
    ctx.lineTo(beakerX + beakerWidth - 12, beakerTopY);
    ctx.stroke();

    // Beaker liquid with indicator color (pH-based)
    const indicatorColor = getIndicatorColor(pH);
    const baseLiquidHeight = 25; // Starting liquid height
    const liquidRise = Math.min(50, (volumeAdded / EQUIVALENCE_POINT) * 50); // Liquid rises as volume increases
    const totalLiquidHeight = baseLiquidHeight + liquidRise;
    const liquidBottom = beakerY + beakerHeight - 15;
    const liquidTop = liquidBottom - totalLiquidHeight;

    // Draw liquid with proper shape matching beaker
    ctx.fillStyle = indicatorColor;
    ctx.beginPath();
    ctx.moveTo(beakerX + 10, liquidTop);
    ctx.lineTo(beakerX + beakerWidth - 10, liquidTop);
    ctx.lineTo(beakerX + beakerWidth - 8, liquidBottom);
    ctx.lineTo(beakerX + 8, liquidBottom);
    ctx.closePath();
    ctx.fill();

    // Add gradient effect to liquid for depth
    const beakerLiquidGradient = ctx.createLinearGradient(
      beakerX,
      liquidTop,
      beakerX,
      liquidBottom
    );
    const lighterColor = indicatorColor.includes("0.9")
      ? indicatorColor.replace("0.9", "0.6")
      : indicatorColor.replace(")", ", 0.6)");
    const darkerColor = indicatorColor.includes("0.9")
      ? indicatorColor.replace("0.9", "1")
      : indicatorColor.replace(")", ", 1)");
    beakerLiquidGradient.addColorStop(0, lighterColor);
    beakerLiquidGradient.addColorStop(0.5, indicatorColor);
    beakerLiquidGradient.addColorStop(1, darkerColor);
    ctx.fillStyle = beakerLiquidGradient;
    ctx.fill();

    // Add meniscus effect (curved liquid surface)
    const meniscusColor = indicatorColor.includes("0.9")
      ? indicatorColor.replace("0.9", "1")
      : indicatorColor.replace(")", ", 1)");
    ctx.strokeStyle = meniscusColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(buretteTipX, liquidTop, 2, 0, Math.PI);
    ctx.stroke();

    // Bubbles effect when adding drops (inside beaker liquid)
    if (isDropping && totalLiquidHeight > 0) {
      const bubbleAreaTop = liquidTop;
      const bubbleAreaBottom = liquidBottom;
      for (let i = 0; i < 10; i++) {
        const bubbleX = beakerX + 15 + Math.random() * (beakerWidth - 30);
        const bubbleY =
          bubbleAreaTop + Math.random() * (bubbleAreaBottom - bubbleAreaTop);
        const bubbleSize = 2 + Math.random() * 3;

        // Only draw bubbles within liquid
        if (bubbleY >= bubbleAreaTop && bubbleY <= bubbleAreaBottom) {
          ctx.beginPath();
          ctx.arc(bubbleX, bubbleY, bubbleSize, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.fill();
          // Add highlight to bubbles for 3D effect
          ctx.beginPath();
          ctx.arc(
            bubbleX - bubbleSize * 0.3,
            bubbleY - bubbleSize * 0.3,
            bubbleSize * 0.4,
            0,
            Math.PI * 2
          );
          ctx.fillStyle = "rgba(255, 255, 255, 1)";
          ctx.fill();
        }
      }
    }

    // Draw subtle connection line from burette tip to beaker (visual guide)
    ctx.strokeStyle = "rgba(203, 213, 225, 0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(buretteTipX, buretteTipY);
    ctx.lineTo(buretteTipX, beakerTopY - 2);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // Labels
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px Inter, sans-serif";
    ctx.fillText("NaOH", buretteX - 5, buretteY - 10);
    ctx.fillText(
      "HCl + Indicator",
      beakerX + beakerWidth / 2 - 55,
      beakerTopY - 10
    );
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
              {experiment?.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              {experiment?.description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-gold/10 text-gold border-gold/20">
              +{experiment?.xp_reward} XP
            </Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Simulation Area */}
          <div className="lg:col-span-2">
            <Card
              variant="elevated"
              className="animate-fade-in"
              style={{ animationDelay: "0.1s" }}
            >
              <CardContent className="p-4 md:p-6">
                {/* Canvas */}
                <div className="relative bg-gradient-to-b from-secondary/30 to-secondary/10 rounded-xl overflow-hidden mb-6">
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={400}
                    className="w-full max-w-[500px] mx-auto"
                  />
                </div>

                {/* Controls */}
                <div className="flex flex-wrap gap-3 justify-center">
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={addDrop}
                    disabled={isDropping || isCompleted || buretteLevel <= 0}
                    className="gap-2"
                  >
                    <Droplet className="h-5 w-5" />
                    Add Drop
                  </Button>
                  <Button
                    variant="success"
                    size="lg"
                    onClick={completeExperiment}
                    disabled={isCompleted || volumeAdded < 10}
                    className="gap-2"
                  >
                    <CheckCircle className="h-5 w-5" />
                    Complete
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={resetExperiment}
                    className="gap-2"
                  >
                    <RotateCcw className="h-5 w-5" />
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Info Panel */}
          <div className="space-y-4">
            {/* Measurements */}
            <Card
              className="animate-fade-in"
              style={{ animationDelay: "0.2s" }}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-primary" />
                  Measurements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Volume Added</span>
                    <span className="font-mono font-medium">
                      {volumeAdded.toFixed(1)} mL
                    </span>
                  </div>
                  <Progress value={(volumeAdded / 50) * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">pH Value</span>
                    <span
                      className={`font-mono font-medium ${
                        pH < 7
                          ? "text-chemistry-acid"
                          : pH > 7
                          ? "text-chemistry-base"
                          : "text-chemistry-neutral"
                      }`}
                    >
                      {pH.toFixed(2)}
                    </span>
                  </div>
                  <Progress value={(pH / 14) * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Burette Level</span>
                    <span className="font-mono font-medium">
                      {buretteLevel.toFixed(1)} mL
                    </span>
                  </div>
                  <Progress value={(buretteLevel / 50) * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card
              className="animate-fade-in"
              style={{ animationDelay: "0.3s" }}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5 text-accent" />
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm">
                  {experiment?.instructions?.steps?.map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {/* Completion Card */}
            {isCompleted && (
              <Card variant="gradient" className="animate-scale-in">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5 text-gold" />
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
                    <div className="text-sm">
                      <p>
                        Volume at completion:{" "}
                        <span className="font-medium">
                          {volumeAdded.toFixed(1)} mL
                        </span>
                      </p>
                      <p>
                        Target (equivalence):{" "}
                        <span className="font-medium">25.0 mL</span>
                      </p>
                      <p>
                        Deviation:{" "}
                        <span className="font-medium">
                          {Math.abs(volumeAdded - 25).toFixed(1)} mL
                        </span>
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
