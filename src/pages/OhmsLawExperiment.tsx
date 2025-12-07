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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { checkAndAwardBadges } from "@/lib/badgeUtils";
import {
  Zap,
  RotateCcw,
  CheckCircle,
  Info,
  Gauge,
  TrendingUp,
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

export default function OhmsLawExperiment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, updateProfile } = useAuth();
  const graphCanvasRef = useRef<HTMLCanvasElement>(null);

  const [experiment, setExperiment] = useState<ExperimentData | null>(null);
  const [experimentRunId, setExperimentRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Experiment state
  const [voltage, setVoltage] = useState(5); // V (0-20)
  const [resistance, setResistance] = useState(100); // Ω (1-1000)
  const [current, setCurrent] = useState(0.05); // A (calculated)
  const [isCompleted, setIsCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [interactionCount, setInteractionCount] = useState(0); // Track user interactions
  const prevValuesRef = useRef({ voltage: 5, resistance: 100 }); // Track previous values to detect real changes

  // Default values
  const DEFAULT_VOLTAGE = 5;
  const DEFAULT_RESISTANCE = 100;

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

  // Define drawGraph function first using useCallback
  const drawGraph = useCallback(() => {
    const canvas = graphCanvasRef.current;
    if (!canvas) {
      console.warn(
        "Canvas not found - graph will be drawn when canvas is ready"
      );
      return;
    }

    // Ensure canvas has valid dimensions
    if (canvas.width === 0 || canvas.height === 0) {
      // Try to set default dimensions if not set
      if (canvas.width === 0) canvas.width = 600;
      if (canvas.height === 0) canvas.height = 400;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Could not get 2d context from canvas");
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 50, right: 50, bottom: 60, left: 70 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Helper function for rounded rectangle
    const drawRoundedRect = (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    // Clear canvas with smooth background
    ctx.clearRect(0, 0, width, height);

    // Create gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, "#ffffff");
    bgGradient.addColorStop(1, "#f8fafc");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Draw minor grid lines (lighter)
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 20; i++) {
      const x = padding.left + (i / 20) * graphWidth;
      const y = padding.top + (i / 20) * graphHeight;

      // Vertical minor grid
      if (i % 2 !== 0) {
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
      }

      // Horizontal minor grid
      if (i % 2 !== 0) {
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      }
    }

    // Draw major grid lines
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = padding.left + (i / 10) * graphWidth;
      const y = padding.top + (i / 10) * graphHeight;

      // Vertical grid lines
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();

      // Horizontal grid lines
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Calculate max current for scaling
    const maxCurrentAtMaxVoltage = resistance > 0 ? 20 / resistance : 0.2;
    const maxCurrentForGraph = Math.max(0.2, maxCurrentAtMaxVoltage * 1.1);

    // Draw axes with arrows
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2.5;
    ctx.fillStyle = "#334155";

    // X-axis (Voltage) with arrow
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right + 10, height - padding.bottom);
    ctx.stroke();
    // Arrow head
    ctx.beginPath();
    ctx.moveTo(width - padding.right + 10, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom - 5);
    ctx.lineTo(width - padding.right, height - padding.bottom + 5);
    ctx.closePath();
    ctx.fill();

    // Y-axis (Current) with arrow
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    ctx.lineTo(padding.left, padding.top - 10);
    ctx.stroke();
    // Arrow head
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top - 10);
    ctx.lineTo(padding.left - 5, padding.top);
    ctx.lineTo(padding.left + 5, padding.top);
    ctx.closePath();
    ctx.fill();

    // Draw axis labels with better styling
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 14px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Voltage (V)", width / 2, height - padding.bottom + 25);

    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Current (A)", 0, 0);
    ctx.restore();

    // Draw axis ticks and labels
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // X-axis ticks and labels
    for (let i = 0; i <= 10; i++) {
      const x = padding.left + (i / 10) * graphWidth;
      const voltageValue = (i / 10) * 20;

      // Tick mark
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, height - padding.bottom);
      ctx.lineTo(x, height - padding.bottom + 5);
      ctx.stroke();

      // Label
      ctx.fillText(voltageValue.toFixed(0), x, height - padding.bottom + 10);
    }

    // Y-axis ticks and labels
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 10; i++) {
      const y = height - padding.bottom - (i / 10) * graphHeight;
      const currentValue = (i / 10) * maxCurrentForGraph;

      // Tick mark
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left - 5, y);
      ctx.stroke();

      // Label
      ctx.fillText(currentValue.toFixed(3), padding.left - 10, y);
    }

    // Draw V-I line with gradient fill
    if (resistance > 0) {
      // Create gradient for the line
      const lineGradient = ctx.createLinearGradient(
        padding.left,
        height - padding.bottom,
        width - padding.right,
        padding.top
      );
      lineGradient.addColorStop(0, "#3b82f6");
      lineGradient.addColorStop(0.5, "#60a5fa");
      lineGradient.addColorStop(1, "#93c5fd");

      // Draw filled area under the curve
      const areaGradient = ctx.createLinearGradient(
        padding.left,
        height - padding.bottom,
        padding.left,
        padding.top
      );
      areaGradient.addColorStop(0, "rgba(59, 130, 246, 0.15)");
      areaGradient.addColorStop(1, "rgba(59, 130, 246, 0.05)");

      ctx.fillStyle = areaGradient;
      ctx.beginPath();
      ctx.moveTo(padding.left, height - padding.bottom);

      for (let v = 0; v <= 20; v += 0.1) {
        const i = v / resistance;
        const x = padding.left + (v / 20) * graphWidth;
        const y =
          height - padding.bottom - (i / maxCurrentForGraph) * graphHeight;
        const clampedY = Math.max(
          padding.top,
          Math.min(height - padding.bottom, y)
        );
        ctx.lineTo(x, clampedY);
      }

      ctx.lineTo(width - padding.right, height - padding.bottom);
      ctx.closePath();
      ctx.fill();

      // Draw the line with gradient
      ctx.strokeStyle = lineGradient;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(59, 130, 246, 0.3)";
      ctx.shadowBlur = 8;
      ctx.beginPath();

      let firstPoint = true;
      for (let v = 0; v <= 20; v += 0.1) {
        const i = v / resistance;
        const x = padding.left + (v / 20) * graphWidth;
        const y =
          height - padding.bottom - (i / maxCurrentForGraph) * graphHeight;
        const clampedY = Math.max(
          padding.top,
          Math.min(height - padding.bottom, y)
        );

        if (firstPoint) {
          ctx.moveTo(x, clampedY);
          firstPoint = false;
        } else {
          ctx.lineTo(x, clampedY);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Add resistance label with background
      const labelX = padding.left + (16 / 20) * graphWidth;
      const labelY =
        height -
        padding.bottom -
        (16 / resistance / maxCurrentForGraph) * graphHeight;
      const clampedLabelY = Math.max(
        padding.top + 20,
        Math.min(height - padding.bottom - 20, labelY)
      );

      // Label background
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1.5;
      const labelText = `R = ${resistance} Ω`;
      ctx.font = "bold 12px Inter, system-ui, sans-serif";
      const textMetrics = ctx.measureText(labelText);
      const labelPadding = 8;
      const labelWidth = textMetrics.width + labelPadding * 2;
      const labelHeight = 20;

      drawRoundedRect(
        labelX,
        clampedLabelY - labelHeight / 2,
        labelWidth,
        labelHeight,
        6
      );
      ctx.fill();
      ctx.stroke();

      // Label text
      ctx.fillStyle = "#3b82f6";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, labelX + labelPadding, clampedLabelY);
    }

    // Draw current data point with enhanced styling
    const pointX = padding.left + (voltage / 20) * graphWidth;
    const pointY =
      height - padding.bottom - (current / maxCurrentForGraph) * graphHeight;

    // Only draw if point is within graph bounds
    if (
      pointX >= padding.left &&
      pointX <= width - padding.right &&
      pointY >= padding.top &&
      pointY <= height - padding.bottom
    ) {
      // Draw connecting lines to axes
      ctx.strokeStyle = "rgba(239, 68, 68, 0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      // Vertical line to x-axis
      ctx.beginPath();
      ctx.moveTo(pointX, pointY);
      ctx.lineTo(pointX, height - padding.bottom);
      ctx.stroke();

      // Horizontal line to y-axis
      ctx.beginPath();
      ctx.moveTo(pointX, pointY);
      ctx.lineTo(padding.left, pointY);
      ctx.stroke();

      ctx.setLineDash([]);

      // Draw point with glow effect
      const pointGradient = ctx.createRadialGradient(
        pointX,
        pointY,
        0,
        pointX,
        pointY,
        12
      );
      pointGradient.addColorStop(0, "#ef4444");
      pointGradient.addColorStop(0.7, "#f87171");
      pointGradient.addColorStop(1, "rgba(239, 68, 68, 0)");

      ctx.fillStyle = pointGradient;
      ctx.beginPath();
      ctx.arc(pointX, pointY, 12, 0, Math.PI * 2);
      ctx.fill();

      // Draw point
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(pointX, pointY, 7, 0, Math.PI * 2);
      ctx.fill();

      // Draw point outline
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Draw inner highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.beginPath();
      ctx.arc(pointX - 2, pointY - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw value label with background
      ctx.font = "bold 11px Inter, system-ui, sans-serif";
      const valueText = `V = ${voltage.toFixed(1)} V, I = ${current.toFixed(
        3
      )} A`;
      const valueMetrics = ctx.measureText(valueText);
      const valuePadding = 6;
      const valueWidth = valueMetrics.width + valuePadding * 2;
      const valueHeight = 22;
      const valueX = pointX;
      const valueY = pointY - 35;

      // Label background with shadow
      ctx.shadowColor = "rgba(0, 0, 0, 0.1)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = "#1e293b";
      drawRoundedRect(
        valueX - valueWidth / 2,
        valueY - valueHeight / 2,
        valueWidth,
        valueHeight,
        8
      );
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Label text
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(valueText, valueX, valueY);
    }
  }, [voltage, resistance, current]);

  // Calculate current whenever voltage or resistance changes
  useEffect(() => {
    const calculatedCurrent = resistance > 0 ? voltage / resistance : 0;
    setCurrent(calculatedCurrent);
  }, [voltage, resistance]);

  // Track user interactions (only count actual changes, not initial render)
  useEffect(() => {
    if (experimentRunId && !isCompleted) {
      const hasChanged =
        prevValuesRef.current.voltage !== voltage ||
        prevValuesRef.current.resistance !== resistance;

      if (hasChanged) {
        setInteractionCount((prev) => prev + 1);
        prevValuesRef.current = { voltage, resistance };

        // Log parameter change (debounced to avoid too many events)
        const timeoutId = setTimeout(() => {
          logEvent("parameter_changed", {
            param: "voltage_or_resistance",
            voltage,
            resistance,
            current: voltage / resistance,
          });
        }, 500);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [voltage, resistance, experimentRunId, isCompleted]);

  // Initialize and resize canvas
  useEffect(() => {
    if (loading) return; // Wait for component to finish loading

    const canvas = graphCanvasRef.current;
    if (!canvas) {
      // Retry after a short delay if canvas isn't ready
      const retryTimeout = setTimeout(() => {
        const retryCanvas = graphCanvasRef.current;
        if (retryCanvas) {
          // Trigger re-initialization
          const event = new Event("resize");
          window.dispatchEvent(event);
        }
      }, 200);
      return () => clearTimeout(retryTimeout);
    }

    const resizeCanvas = () => {
      const canvas = graphCanvasRef.current;
      if (!canvas) return;

      const container = canvas.parentElement;
      if (!container) {
        // Container not ready, retry
        setTimeout(resizeCanvas, 50);
        return;
      }

      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        // Container not sized yet, retry
        setTimeout(resizeCanvas, 50);
        return;
      }

      const maxWidth = Math.min(600, Math.max(300, rect.width - 32)); // Account for padding, min 300px
      const aspectRatio = 400 / 600;

      canvas.width = maxWidth;
      canvas.height = maxWidth * aspectRatio;
      drawGraph();
    };

    // Initial resize with a delay to ensure container is rendered
    const timeoutId = setTimeout(resizeCanvas, 150);

    // Resize on window resize
    window.addEventListener("resize", resizeCanvas);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [drawGraph, loading]);

  // Redraw graph when parameters change (only if canvas is initialized)
  useEffect(() => {
    if (!loading) {
      const canvas = graphCanvasRef.current;
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        drawGraph();
      }
    }
  }, [drawGraph, loading, voltage, resistance, current]);

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

  const handleVoltageChange = (value: number[]) => {
    if (!isCompleted && value && value.length > 0) {
      const newVoltage = Math.max(0, Math.min(20, Number(value[0]) || 0));
      setVoltage(newVoltage);
    }
  };

  const handleResistanceChange = (value: number[]) => {
    if (!isCompleted && value && value.length > 0) {
      const newResistance = Math.max(1, Math.min(1000, Number(value[0]) || 1));
      setResistance(newResistance);
    }
  };

  const handleVoltageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    const clamped = Math.max(0, Math.min(20, value));
    setVoltage(clamped);
  };

  const handleResistanceInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseFloat(e.target.value) || 1;
    const clamped = Math.max(1, Math.min(1000, value));
    setResistance(clamped);
  };

  const resetExperiment = async () => {
    setIsCompleted(false);
    setScore(0);
    setInteractionCount(0);
    setVoltage(DEFAULT_VOLTAGE);
    setResistance(DEFAULT_RESISTANCE);
    prevValuesRef.current = {
      voltage: DEFAULT_VOLTAGE,
      resistance: DEFAULT_RESISTANCE,
    };

    // Start a new experiment run
    if (experiment && user) {
      await startExperimentRun();
    }
  };

  const submitResult = async () => {
    if (!experimentRunId || !experiment || !user) return;

    // Calculate score based on interactions and understanding
    // Base score: 50 points for completing
    // Bonus: up to 50 points for experimenting (changing values)
    const baseScore = 50;
    const interactionBonus = Math.min(50, interactionCount * 5); // 5 points per interaction, max 50
    const score = Math.min(100, baseScore + interactionBonus);

    setScore(score);
    setIsCompleted(true);

    // Save to ohmslaw_runs table
    const { error: ohmsError } = await supabase.from("ohmslaw_runs").insert({
      user_id: user.id,
      voltage: voltage,
      resistance: resistance,
      current: current,
    });

    if (ohmsError) {
      console.error("Error saving Ohm Law result:", ohmsError);
      toast.error("Failed to save result");
      return;
    }

    // Calculate XP - ensure minimum XP is awarded
    const baseXP = Math.max(
      10,
      Math.round((score / 100) * experiment.xp_reward)
    ); // Minimum 10 XP
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
          voltage,
          resistance,
          current,
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
    if (profile) {
      const newXP = profile.xp_points + xpEarned;
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
          subject: "Physics",
        },
      };

      await checkAndAwardBadges(user.id, profile?.xp_points || 0, completedRun);
    }

    logEvent("experiment_completed", {
      score,
      voltage,
      resistance,
      current,
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
              <Zap className="h-8 w-8 text-primary" />
              {experiment?.name || "Ohm's Law Experiment"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {experiment?.description ||
                "Explore the relationship between voltage, current, and resistance"}
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
            <Card
              variant="elevated"
              className="animate-fade-in"
              style={{ animationDelay: "0.1s" }}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-primary" />
                  Experiment Controls
                </CardTitle>
                <CardDescription>
                  Adjust voltage and resistance to observe Ohm's Law: I = V / R
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Voltage Control */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="voltage"
                      className="text-base font-semibold"
                    >
                      Voltage (V)
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      Range: 0-20 V
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="voltage"
                      min={0}
                      max={20}
                      step={0.1}
                      value={[voltage]}
                      onValueChange={handleVoltageChange}
                      disabled={isCompleted}
                      className="flex-1"
                      aria-label="Voltage slider"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      step={0.1}
                      value={voltage.toFixed(1)}
                      onChange={handleVoltageInputChange}
                      disabled={isCompleted}
                      className="w-24"
                      aria-label="Voltage input"
                    />
                    <span className="text-sm font-medium w-8">V</span>
                  </div>
                </div>

                {/* Resistance Control */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="resistance"
                      className="text-base font-semibold"
                    >
                      Resistance (Ω)
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      Range: 1-1000 Ω
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="resistance"
                      min={1}
                      max={1000}
                      step={1}
                      value={[resistance]}
                      onValueChange={handleResistanceChange}
                      disabled={isCompleted}
                      className="flex-1"
                      aria-label="Resistance slider"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      step={1}
                      value={resistance}
                      onChange={handleResistanceInputChange}
                      disabled={isCompleted}
                      className="w-24"
                      aria-label="Resistance input"
                    />
                    <span className="text-sm font-medium w-8">Ω</span>
                  </div>
                </div>

                {/* Current Display */}
                <div className="p-4 rounded-lg bg-primary/10 border-2 border-primary/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      Current (A)
                    </Label>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-primary">
                        {current.toFixed(3)}
                      </span>
                      <span className="text-sm text-muted-foreground">A</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Calculated using: I = V / R = {voltage.toFixed(1)} /{" "}
                    {resistance} = {current.toFixed(3)} A
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={resetExperiment}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                  <Button
                    variant="hero"
                    onClick={submitResult}
                    disabled={isCompleted}
                    className="gap-2 flex-1"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Submit Result
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Graph Card */}
            <Card
              className="animate-fade-in"
              style={{ animationDelay: "0.2s" }}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Voltage-Current Graph
                </CardTitle>
                <CardDescription>
                  Visual representation of Ohm's Law relationship
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative bg-gradient-to-b from-secondary/30 to-secondary/10 rounded-xl overflow-hidden p-4">
                  <canvas
                    ref={graphCanvasRef}
                    className="w-full h-auto max-w-full mx-auto block"
                    style={{
                      maxHeight: "400px",
                      aspectRatio: "3/2",
                      minHeight: "300px",
                    }}
                    width={600}
                    height={400}
                    aria-label="Voltage-Current graph"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Instructions */}
            <Card
              className="animate-fade-in"
              style={{ animationDelay: "0.3s" }}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-accent" />
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm">
                  {(
                    experiment?.instructions?.steps || [
                      "Adjust the voltage slider to change voltage (0-20 V)",
                      "Adjust the resistance slider to change resistance (1-1000 Ω)",
                      "Observe how current changes according to I = V / R",
                      "Watch the graph update in real-time",
                      "Experiment with different values to understand the relationship",
                      'Click "Submit Result" when finished',
                    ]
                  ).map((step, index) => (
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

            {/* Formula Card */}
            <Card
              variant="gradient"
              className="animate-fade-in"
              style={{ animationDelay: "0.4s" }}
            >
              <CardHeader>
                <CardTitle>Ohm's Law</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold">I = V / R</div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>I = Current (Amperes)</p>
                    <p>V = Voltage (Volts)</p>
                    <p>R = Resistance (Ohms)</p>
                  </div>
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
                        Final Voltage:{" "}
                        <span className="font-medium">
                          {voltage.toFixed(1)} V
                        </span>
                      </p>
                      <p>
                        Final Resistance:{" "}
                        <span className="font-medium">{resistance} Ω</span>
                      </p>
                      <p>
                        Calculated Current:{" "}
                        <span className="font-medium">
                          {current.toFixed(3)} A
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
