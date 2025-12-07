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
  Play,
  CheckCircle,
  Droplets,
  Microscope,
  Info,
} from "lucide-react";

// Internal solute concentration (fixed)
const INTERNAL_CONCENTRATION = 0.3; // M

// Cell type definitions
const CELL_TYPES = ["Onion epidermal cell", "Rhoeo leaf cell"] as const;

// External solution definitions
const EXTERNAL_SOLUTIONS = [
  { label: "Distilled water (hypotonic)", concentration: 0.0 },
  { label: "0.9% NaCl (isotonic)", concentration: 0.15 },
  { label: "5% NaCl (hypertonic)", concentration: 0.85 },
] as const;

type CellType = (typeof CELL_TYPES)[number];
type CellState = "Turgid" | "Flaccid" | "Plasmolysed";
type Tonicity = "hypotonic" | "isotonic" | "hypertonic";
type WaterMovement = "into cell" | "out of cell" | "no net movement";

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

// Tracking function stub
const trackEvent = (name: string, data?: any) => {
  console.log(`[Analytics] ${name}`, data);
};

export default function OsmosisPlasmolysisExperiment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, updateProfile } = useAuth();
  const svgRef = useRef<SVGSVGElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationStartTimeRef = useRef<number | null>(null);

  const [experiment, setExperiment] = useState<ExperimentData | null>(null);
  const [experimentRunId, setExperimentRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [cellType, setCellType] = useState<CellType>("Onion epidermal cell");
  const [externalSolution, setExternalSolution] = useState<string>(
    "Distilled water (hypotonic)"
  );
  const [externalConcentration, setExternalConcentration] =
    useState<number>(0.0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [simulationDuration, setSimulationDuration] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [interactionCount, setInteractionCount] = useState(0);
  const prevValuesRef = useRef({
    cellType: "Onion epidermal cell",
    externalSolution: "Distilled water (hypotonic)",
    externalConcentration: 0.0,
  });

  // Computed values
  const tonicity: Tonicity =
    externalConcentration < INTERNAL_CONCENTRATION - 0.05
      ? "hypotonic"
      : externalConcentration > INTERNAL_CONCENTRATION + 0.05
      ? "hypertonic"
      : "isotonic";

  const predictedState: CellState =
    tonicity === "hypotonic"
      ? "Turgid"
      : tonicity === "hypertonic"
      ? "Plasmolysed"
      : "Flaccid";

  const waterMovement: WaterMovement =
    tonicity === "hypotonic"
      ? "into cell"
      : tonicity === "hypertonic"
      ? "out of cell"
      : "no net movement";

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
        prevValuesRef.current.cellType !== cellType ||
        prevValuesRef.current.externalSolution !== externalSolution ||
        prevValuesRef.current.externalConcentration !== externalConcentration;

      if (hasChanged) {
        setInteractionCount((prev) => prev + 1);
        prevValuesRef.current = {
          cellType,
          externalSolution,
          externalConcentration,
        };

        const timeoutId = setTimeout(() => {
          logEvent("parameter_changed", {
            param: "cell_or_solution",
            cellType,
            externalSolution,
            externalConcentration,
          });
        }, 500);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [cellType, externalSolution, externalConcentration, experimentRunId, isCompleted]);

  // Update external concentration when solution changes
  useEffect(() => {
    const solution = EXTERNAL_SOLUTIONS.find(
      (s) => s.label === externalSolution
    );
    if (solution) {
      setExternalConcentration(solution.concentration);
    }
  }, [externalSolution]);

  // Animation loop
  const animate = useCallback(() => {
    if (!isAnimating || animationStartTimeRef.current === null) return;

    const elapsed = (Date.now() - animationStartTimeRef.current) / 1000;
    const duration = 4.0;
    const progress = Math.min(elapsed / duration, 1);

    setAnimationProgress(progress);
    setSimulationDuration(elapsed);

    if (progress < 1) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      setIsAnimating(false);
      animationStartTimeRef.current = null;
      logEvent("simulation_completed");
    }
  }, [isAnimating]);

  useEffect(() => {
    if (isAnimating) {
      animationStartTimeRef.current = Date.now();
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAnimating, animate]);

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

  const handleStartSimulation = () => {
    setIsAnimating(true);
    setAnimationProgress(0);
    setSimulationDuration(0);
    logEvent("simulation_started");
  };

  const handleReset = () => {
    setIsAnimating(false);
    setAnimationProgress(0);
    setSimulationDuration(0);
    setCellType("Onion epidermal cell");
    setExternalSolution("Distilled water (hypotonic)");
    setExternalConcentration(0.0);
    animationStartTimeRef.current = null;
    prevValuesRef.current = {
      cellType: "Onion epidermal cell",
      externalSolution: "Distilled water (hypotonic)",
      externalConcentration: 0.0,
    };
    logEvent("experiment_reset");
  };

  const handleSubmitObservation = async () => {
    if (!experimentRunId || !experiment || !user) return;

    // Calculate score based on interactions and understanding
    const baseScore = 50;
    const interactionBonus = Math.min(50, interactionCount * 5);
    const score = Math.min(100, baseScore + interactionBonus);

    setScore(score);
    setIsCompleted(true);

    // Save to osmosis_plasmolysis_runs table
    const { error: osmosisError } = await supabase
      .from("osmosis_plasmolysis_runs")
      .insert({
        user_id: user.id,
        cell_type: cellType,
        external_solution: externalSolution,
        external_concentration: externalConcentration,
        predicted_state: predictedState,
        simulation_duration_sec: simulationDuration || 4.0,
      });

    if (osmosisError) {
      console.error("Error saving Osmosis result:", osmosisError);
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
          cellType,
          externalSolution,
          externalConcentration,
          predictedState,
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
          subject: "Biology",
        },
      };

      await checkAndAwardBadges(user.id, profile?.xp_points || 0, completedRun);
    }

    logEvent("experiment_completed", {
      score,
      cellType,
      externalSolution,
      externalConcentration,
      predictedState,
      xp_earned: xpEarned,
    });

    toast.success(`Experiment completed! You earned ${xpEarned} XP!`);
  };

  // Calculate cell dimensions based on state and animation
  const getCellDimensions = () => {
    const baseVacuoleRadius = 60;
    const baseMembraneRadius = 80;
    const baseCellWallSize = 100;

    let vacuoleRadius = baseVacuoleRadius;
    let membraneRadius = baseMembraneRadius;
    let cellWallSize = baseCellWallSize;

    if (isAnimating || animationProgress > 0) {
      const progress = animationProgress;

      if (predictedState === "Turgid") {
        vacuoleRadius = baseVacuoleRadius + 20 * progress;
        membraneRadius = baseMembraneRadius + 10 * progress;
      } else if (predictedState === "Plasmolysed") {
        vacuoleRadius = baseVacuoleRadius - 30 * progress;
        membraneRadius = baseMembraneRadius - 15 * progress;
      } else {
        vacuoleRadius = baseVacuoleRadius - 5 * progress;
        membraneRadius = baseMembraneRadius - 2 * progress;
      }
    } else {
      if (tonicity === "hypotonic") {
        vacuoleRadius = baseVacuoleRadius + 20;
        membraneRadius = baseMembraneRadius + 10;
      } else if (tonicity === "hypertonic") {
        vacuoleRadius = baseVacuoleRadius - 30;
        membraneRadius = baseMembraneRadius - 15;
      }
    }

    return {
      cellWallSize,
      membraneRadius: Math.max(30, Math.min(90, membraneRadius)),
      vacuoleRadius: Math.max(20, Math.min(80, vacuoleRadius)),
    };
  };

  const { cellWallSize, membraneRadius, vacuoleRadius } = getCellDimensions();
  const centerX = 150;
  const centerY = 150;

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
              <Microscope className="h-8 w-8 text-primary" />
              {experiment?.name || "Osmosis and Plasmolysis Lab"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {experiment?.description ||
                "Explore how plant cells respond to different external solute concentrations"}
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
                  <Droplets className="h-5 w-5 text-primary" />
                  Experiment Controls
                </CardTitle>
                <CardDescription>
                  Select cell type and external solution to observe osmosis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Cell Type Dropdown */}
                <div className="space-y-2">
                  <Label htmlFor="cell-type" className="text-base font-semibold">
                    Cell type
                  </Label>
                  <Select
                    value={cellType}
                    onValueChange={(value) => setCellType(value as CellType)}
                    disabled={isCompleted}
                  >
                    <SelectTrigger
                      id="cell-type"
                      aria-label="Cell type selector"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CELL_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* External Solution Dropdown */}
                <div className="space-y-2">
                  <Label
                    htmlFor="external-solution"
                    className="text-base font-semibold"
                  >
                    External solution
                  </Label>
                  <Select
                    value={externalSolution}
                    onValueChange={setExternalSolution}
                    disabled={isCompleted}
                  >
                    <SelectTrigger
                      id="external-solution"
                      aria-label="External solution selector"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXTERNAL_SOLUTIONS.map((solution) => (
                        <SelectItem key={solution.label} value={solution.label}>
                          {solution.label}
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
                      External solute concentration (M)
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {externalConcentration.toFixed(2)} M
                    </span>
                  </div>
                  <Slider
                    id="concentration"
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    value={[externalConcentration]}
                    onValueChange={(value) =>
                      setExternalConcentration(value[0])
                    }
                    disabled={isAnimating || isCompleted}
                    className="w-full"
                    aria-label="External solute concentration slider"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0.0 M</span>
                    <span className="font-medium">
                      {tonicity === "hypotonic"
                        ? "Hypotonic"
                        : tonicity === "isotonic"
                        ? "Isotonic"
                        : "Hypertonic"}
                    </span>
                    <span>1.0 M</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={isAnimating}
                    className="gap-2"
                    aria-label="Reset experiment"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                  <Button
                    variant="hero"
                    onClick={handleStartSimulation}
                    disabled={isAnimating || isCompleted}
                    className="gap-2 flex-1"
                    aria-label="Start simulation"
                  >
                    <Play className="h-4 w-4" />
                    Start Simulation
                  </Button>
                  <Button
                    variant="accent"
                    onClick={handleSubmitObservation}
                    disabled={isCompleted}
                    className="gap-2 flex-1"
                    aria-label="Submit observation"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Submit Observation
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Cell Diagram Card */}
            <Card className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <CardHeader>
                <CardTitle>Plant Cell Diagram</CardTitle>
                <CardDescription>
                  Visual representation of osmosis effects on plant cell structure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative bg-gradient-to-b from-secondary/30 to-secondary/10 rounded-xl overflow-hidden p-8">
                  <svg
                    ref={svgRef}
                    viewBox="0 0 300 300"
                    className="w-full h-auto max-w-full mx-auto block"
                    aria-label="Plant cell diagram showing osmosis effect"
                    role="img"
                  >
                    <defs>
                      <linearGradient
                        id="bgGradient"
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#f1f5f9" />
                        <stop offset="100%" stopColor="#e2e8f0" />
                      </linearGradient>
                      <linearGradient
                        id="vacuoleGradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#c084fc" stopOpacity="0.3" />
                        <stop
                          offset="100%"
                          stopColor="#a855f7"
                          stopOpacity="0.5"
                        />
                      </linearGradient>
                      <linearGradient
                        id="membraneGradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                        <stop
                          offset="100%"
                          stopColor="#2563eb"
                          stopOpacity="0.6"
                        />
                      </linearGradient>
                      <marker
                        id="arrowhead-green"
                        markerWidth="10"
                        markerHeight="10"
                        refX="9"
                        refY="3"
                        orient="auto"
                      >
                        <polygon points="0 0, 10 3, 0 6" fill="#22c55e" />
                      </marker>
                      <marker
                        id="arrowhead-red"
                        markerWidth="10"
                        markerHeight="10"
                        refX="9"
                        refY="3"
                        orient="auto"
                      >
                        <polygon points="0 0, 10 3, 0 6" fill="#ef4444" />
                      </marker>
                    </defs>

                    <rect width="300" height="300" fill="url(#bgGradient)" />

                    <circle
                      cx={centerX}
                      cy={centerY}
                      r={cellWallSize}
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="3"
                      strokeDasharray="5,5"
                      opacity={0.6}
                    />

                    <circle
                      cx={centerX}
                      cy={centerY}
                      r={membraneRadius}
                      fill="url(#membraneGradient)"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      opacity={0.7}
                    />

                    <circle
                      cx={centerX}
                      cy={centerY}
                      r={vacuoleRadius}
                      fill="url(#vacuoleGradient)"
                      stroke="#a855f7"
                      strokeWidth="2"
                      opacity={0.8}
                    />

                    {tonicity === "hypotonic" && (
                      <>
                        {[...Array(6)].map((_, i) => {
                          const angle = i * 60 * (Math.PI / 180);
                          const startX =
                            centerX + (cellWallSize + 20) * Math.cos(angle);
                          const startY =
                            centerY + (cellWallSize + 20) * Math.sin(angle);
                          const endX =
                            centerX + (membraneRadius - 5) * Math.cos(angle);
                          const endY =
                            centerY + (membraneRadius - 5) * Math.sin(angle);
                          const animOffset = isAnimating
                            ? Math.sin(Date.now() / 200 + i) * 3
                            : 0;

                          return (
                            <g key={`arrow-in-${i}`}>
                              <line
                                x1={startX}
                                y1={startY + animOffset}
                                x2={endX}
                                y2={endY + animOffset}
                                stroke="#22c55e"
                                strokeWidth="2"
                                markerEnd="url(#arrowhead-green)"
                                opacity={0.7}
                              />
                            </g>
                          );
                        })}
                      </>
                    )}

                    {tonicity === "hypertonic" && (
                      <>
                        {[...Array(6)].map((_, i) => {
                          const angle = i * 60 * (Math.PI / 180);
                          const startX =
                            centerX + (membraneRadius - 5) * Math.cos(angle);
                          const startY =
                            centerY + (membraneRadius - 5) * Math.sin(angle);
                          const endX =
                            centerX + (cellWallSize + 20) * Math.cos(angle);
                          const endY =
                            centerY + (cellWallSize + 20) * Math.sin(angle);
                          const animOffset = isAnimating
                            ? Math.sin(Date.now() / 200 + i) * 3
                            : 0;

                          return (
                            <g key={`arrow-out-${i}`}>
                              <line
                                x1={startX}
                                y1={startY + animOffset}
                                x2={endX}
                                y2={endY + animOffset}
                                stroke="#ef4444"
                                strokeWidth="2"
                                markerEnd="url(#arrowhead-red)"
                                opacity={0.7}
                              />
                            </g>
                          );
                        })}
                      </>
                    )}

                    <text
                      x={centerX}
                      y={centerY - cellWallSize - 30}
                      textAnchor="middle"
                      className="text-xs font-semibold fill-foreground"
                      fontSize="12"
                    >
                      Cell Wall
                    </text>
                    <text
                      x={centerX}
                      y={centerY}
                      textAnchor="middle"
                      className="text-xs fill-foreground"
                      fontSize="10"
                      opacity={0.8}
                    >
                      Vacuole
                    </text>
                  </svg>
                </div>

                {/* Text Readouts */}
                <div className="mt-6 space-y-3">
                  <div className="p-4 rounded-lg bg-primary/10 border-2 border-primary/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-muted-foreground">
                        Net water movement:
                      </span>
                      <span className="text-base font-bold text-primary">
                        {waterMovement}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-accent/10 border-2 border-accent/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-muted-foreground">
                        Cell state:
                      </span>
                      <span className="text-base font-bold text-accent">
                        {predictedState}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="sr-only">
                  Plant cell diagram showing {predictedState.toLowerCase()} state.
                  Water is moving {waterMovement}. External solution is {tonicity}{" "}
                  relative to the cell's internal concentration.
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
                    "Select a cell type from the dropdown",
                    "Choose an external solution or adjust the concentration slider",
                    "Observe how the cell diagram changes based on tonicity",
                    "Click 'Start Simulation' to animate the cell transition",
                    "Watch the water movement arrows and cell state readouts",
                    "Click 'Submit Observation' when finished",
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
                <CardTitle>About Osmosis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  <strong>Osmosis</strong> is the movement of water across a
                  semi-permeable membrane from an area of lower solute
                  concentration to an area of higher solute concentration.
                </p>
                <div className="space-y-2">
                  <p>
                    <strong>Hypotonic:</strong> External solution has lower solute
                    concentration. Water moves into the cell, causing it to become{" "}
                    <strong>Turgid</strong>.
                  </p>
                  <p>
                    <strong>Isotonic:</strong> Equal solute concentrations. No net
                    water movement, cell remains <strong>Flaccid</strong>.
                  </p>
                  <p>
                    <strong>Hypertonic:</strong> External solution has higher
                    solute concentration. Water moves out, causing{" "}
                    <strong>Plasmolysis</strong> (membrane pulls away from cell
                    wall).
                  </p>
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
                        Cell Type:{" "}
                        <span className="font-medium">{cellType}</span>
                      </p>
                      <p>
                        Solution:{" "}
                        <span className="font-medium">{externalSolution}</span>
                      </p>
                      <p>
                        Final State:{" "}
                        <span className="font-medium">{predictedState}</span>
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

