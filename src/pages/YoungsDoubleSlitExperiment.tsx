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
  RotateCcw,
  CheckCircle,
  Lightbulb,
  Info,
  Gauge,
  Waves,
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

// Default values
const DEFAULT_WAVELENGTH = 550; // nm
const DEFAULT_SLIT_SEPARATION = 0.4; // mm
const DEFAULT_SCREEN_DISTANCE = 1.0; // m

// Wavelength to RGB color mapping (visible spectrum 380-700 nm)
const wavelengthToRGB = (wavelength: number): string => {
  let r = 0, g = 0, b = 0;
  
  if (wavelength >= 380 && wavelength < 440) {
    r = -(wavelength - 440) / (440 - 380);
    g = 0;
    b = 1;
  } else if (wavelength >= 440 && wavelength < 490) {
    r = 0;
    g = (wavelength - 440) / (490 - 440);
    b = 1;
  } else if (wavelength >= 490 && wavelength < 510) {
    r = 0;
    g = 1;
    b = -(wavelength - 510) / (510 - 490);
  } else if (wavelength >= 510 && wavelength < 580) {
    r = (wavelength - 510) / (580 - 510);
    g = 1;
    b = 0;
  } else if (wavelength >= 580 && wavelength < 645) {
    r = 1;
    g = -(wavelength - 645) / (645 - 580);
    b = 0;
  } else if (wavelength >= 645 && wavelength <= 700) {
    r = 1;
    g = 0;
    b = 0;
  }
  
  // Adjust brightness
  let factor = 1;
  if (wavelength >= 380 && wavelength < 420) {
    factor = 0.3 + 0.7 * (wavelength - 380) / (420 - 380);
  } else if (wavelength >= 420 && wavelength < 700) {
    factor = 1;
  } else if (wavelength >= 700) {
    factor = 0.3 + 0.7 * (780 - wavelength) / (780 - 700);
  }
  
  r = Math.round(255 * (r * factor));
  g = Math.round(255 * (g * factor));
  b = Math.round(255 * (b * factor));
  
  return `rgb(${r}, ${g}, ${b})`;
};

export default function YoungsDoubleSlitExperiment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, updateProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    order: number;
    isBright: boolean;
  } | null>(null);

  const [experiment, setExperiment] = useState<ExperimentData | null>(null);
  const [experimentRunId, setExperimentRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [wavelength, setWavelength] = useState(DEFAULT_WAVELENGTH); // nm
  const [slitSeparation, setSlitSeparation] = useState(DEFAULT_SLIT_SEPARATION); // mm
  const [screenDistance, setScreenDistance] = useState(DEFAULT_SCREEN_DISTANCE); // m
  const [isCompleted, setIsCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [interactionCount, setInteractionCount] = useState(0);
  const prevValuesRef = useRef({
    wavelength: DEFAULT_WAVELENGTH,
    slitSeparation: DEFAULT_SLIT_SEPARATION,
    screenDistance: DEFAULT_SCREEN_DISTANCE,
  });

  // Calculate fringe width: β = (λ × D) / d
  // Convert wavelength from nm to m, slit separation from mm to m
  const fringeWidth = useCallback(() => {
    const lambda_m = wavelength * 1e-9; // Convert nm to m
    const d_m = slitSeparation * 1e-3; // Convert mm to m
    const D_m = screenDistance; // Already in m
    
    if (d_m === 0) return 0;
    const beta_m = (lambda_m * D_m) / d_m;
    return beta_m * 1000; // Convert to mm for display
  }, [wavelength, slitSeparation, screenDistance]);

  const fringeWidth_mm = fringeWidth();

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
        prevValuesRef.current.wavelength !== wavelength ||
        prevValuesRef.current.slitSeparation !== slitSeparation ||
        prevValuesRef.current.screenDistance !== screenDistance;

      if (hasChanged) {
        setInteractionCount((prev) => prev + 1);
        prevValuesRef.current = {
          wavelength,
          slitSeparation,
          screenDistance,
        };

        const timeoutId = setTimeout(() => {
          logEvent("parameter_changed", {
            wavelength,
            slitSeparation,
            screenDistance,
            fringeWidth: fringeWidth_mm,
          });
        }, 500);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [wavelength, slitSeparation, screenDistance, experimentRunId, isCompleted, fringeWidth_mm]);

  // Draw the double slit experiment visualization
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
    const sourceWidth = width * 0.15;
    const barrierWidth = width * 0.1;
    const screenStart = width * 0.75;
    const screenWidth = width * 0.25;

    // Light source (left side)
    const sourceX = sourceWidth / 2;
    const sourceY = height / 2;
    const lightColor = wavelengthToRGB(wavelength);

    // Draw light rays from source
    ctx.strokeStyle = lightColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;

    // Barrier with two slits
    const barrierX = sourceWidth + barrierWidth / 2;
    const barrierY = height / 2;
    const slitSpacing = (slitSeparation / 1.0) * 30; // Scale for visualization (max 1mm = 30px)
    const slitWidth = 4;

    // Draw barrier
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(sourceWidth, 0, barrierWidth, height);

    // Draw slits
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(
      sourceWidth + barrierWidth / 2 - slitWidth / 2,
      barrierY - slitSpacing / 2 - slitWidth / 2,
      slitWidth,
      slitWidth
    );
    ctx.fillRect(
      sourceWidth + barrierWidth / 2 - slitWidth / 2,
      barrierY + slitSpacing / 2 - slitWidth / 2,
      slitWidth,
      slitWidth
    );

    // Draw light rays from source to slits
    ctx.beginPath();
    ctx.moveTo(sourceX, sourceY);
    ctx.lineTo(barrierX, barrierY - slitSpacing / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sourceX, sourceY);
    ctx.lineTo(barrierX, barrierY + slitSpacing / 2);
    ctx.stroke();

    // Screen (right side)
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(screenStart, 0, screenWidth, height);

    // Draw interference pattern on screen
    const screenCenterY = height / 2;
    const maxFringes = 10; // Show ±10 bright fringes
    const beta_px = (fringeWidth_mm / 10) * 50; // Scale: 10mm = 50px

    ctx.globalAlpha = 1;

    // Draw fringes
    // Bright fringes at x = nβ (n = 0, ±1, ±2, ...)
    // Dark fringes at x = (n + 0.5)β
    for (let n = -maxFringes; n <= maxFringes; n++) {
      // Bright fringe at integer order
      const brightY = screenCenterY + n * beta_px;
      if (brightY >= 0 && brightY <= height) {
        // Convert RGB to RGBA for gradient
        const rgbMatch = lightColor.match(/\d+/g);
        if (rgbMatch && rgbMatch.length >= 3) {
          const r = parseInt(rgbMatch[0]);
          const g = parseInt(rgbMatch[1]);
          const b = parseInt(rgbMatch[2]);
          
          const gradient = ctx.createLinearGradient(
            screenStart,
            brightY - 15,
            screenStart + screenWidth,
            brightY + 15
          );
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
          gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.5)`);
          gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.25)`);

          ctx.fillStyle = gradient;
          ctx.fillRect(screenStart, brightY - 8, screenWidth, 16);

          // Add glow effect
          ctx.shadowBlur = 10;
          ctx.shadowColor = lightColor;
          ctx.fillRect(screenStart, brightY - 8, screenWidth, 16);
          ctx.shadowBlur = 0;
        }
      }

      // Dark fringe (between bright fringes) at half-integer positions
      if (n < maxFringes) {
        const darkY = screenCenterY + (n + 0.5) * beta_px;
        if (darkY >= 0 && darkY <= height) {
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(screenStart, darkY - 4, screenWidth, 8);
        }
      }
    }

    // Draw central maximum label
    ctx.fillStyle = "#64748b";
    ctx.font = "12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("n=0", screenStart + screenWidth / 2, screenCenterY - 20);

    // Handle mouse hover
    if (hoveredPoint) {
      const hoverY = screenCenterY + hoveredPoint.order * beta_px;
      if (hoverY >= 0 && hoverY <= height) {
        // Highlight the hovered fringe
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(screenStart, hoverY - 10, screenWidth, 20);
        ctx.setLineDash([]);

        // Draw tooltip
        const tooltipX = screenStart + screenWidth / 2;
        const tooltipY = hoverY - 30;
        const tooltipText = `n=${hoveredPoint.order} ${hoveredPoint.isBright ? "Bright" : "Dark"}`;

        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(tooltipX - 60, tooltipY - 20, 120, 30);
        ctx.fillStyle = "#ffffff";
        ctx.font = "12px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(tooltipText, tooltipX, tooltipY);
      }
    }

    // Labels
    ctx.fillStyle = "#1e293b";
    ctx.font = "14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Light Source", sourceX, height - 20);
    ctx.fillText("Barrier", barrierX, height - 20);
    ctx.fillText("Screen", screenStart + screenWidth / 2, height - 20);
  }, [wavelength, slitSeparation, screenDistance, fringeWidth_mm, hoveredPoint]);

  useEffect(() => {
    drawVisualization();
  }, [drawVisualization]);

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

  // Handle mouse interaction on canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if mouse is over the screen area
    const screenStart = canvas.width * 0.75;
    const screenWidth = canvas.width * 0.25;
    const screenCenterY = canvas.height / 2;
    const beta_px = (fringeWidth_mm / 10) * 50;

    if (x >= screenStart && x <= screenStart + screenWidth) {
      // Calculate which fringe is being hovered
      const distanceFromCenter = y - screenCenterY;
      const normalizedDistance = distanceFromCenter / beta_px;
      
      // Check if closer to bright (integer) or dark (half-integer) fringe
      const nearestInteger = Math.round(normalizedDistance);
      const nearestHalf = Math.round(normalizedDistance * 2) / 2;
      
      const distToInteger = Math.abs(normalizedDistance - nearestInteger);
      const distToHalf = Math.abs(normalizedDistance - nearestHalf);
      
      if (distToInteger < distToHalf && distToInteger < 0.3) {
        // Bright fringe
        const exactY = screenCenterY + nearestInteger * beta_px;
        const distance = Math.abs(y - exactY);
        
        if (distance < 15) {
          const x_mm = normalizedDistance * fringeWidth_mm;
          setHoveredPoint({
            x: x_mm,
            order: nearestInteger,
            isBright: true,
          });
        } else {
          setHoveredPoint(null);
        }
      } else if (distToHalf < 0.3) {
        // Dark fringe
        const exactY = screenCenterY + nearestHalf * beta_px;
        const distance = Math.abs(y - exactY);
        
        if (distance < 15) {
          const x_mm = normalizedDistance * fringeWidth_mm;
          const order = Math.floor(nearestHalf);
          setHoveredPoint({
            x: x_mm,
            order: order,
            isBright: false,
          });
        } else {
          setHoveredPoint(null);
        }
      } else {
        setHoveredPoint(null);
      }
    } else {
      setHoveredPoint(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredPoint(null);
  };

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

  const handleReset = () => {
    setWavelength(DEFAULT_WAVELENGTH);
    setSlitSeparation(DEFAULT_SLIT_SEPARATION);
    setScreenDistance(DEFAULT_SCREEN_DISTANCE);
    prevValuesRef.current = {
      wavelength: DEFAULT_WAVELENGTH,
      slitSeparation: DEFAULT_SLIT_SEPARATION,
      screenDistance: DEFAULT_SCREEN_DISTANCE,
    };
    setHoveredPoint(null);
    logEvent("experiment_reset", {});
  };

  const handleSubmitResult = async () => {
    if (!experimentRunId || !experiment || !user) return;

    // Calculate score based on interactions
    const baseScore = 50;
    const interactionBonus = Math.min(50, interactionCount * 5);
    const score = Math.min(100, baseScore + interactionBonus);

    setScore(score);
    setIsCompleted(true);

    // Save to youngs_double_slit_runs table
    const { error: slitError } = await supabase
      .from("youngs_double_slit_runs")
      .insert({
        user_id: user.id,
        wavelength_nm: wavelength,
        slit_separation_mm: slitSeparation,
        screen_distance_m: screenDistance,
        fringe_width_mm: fringeWidth_mm,
      });

    if (slitError) {
      console.error("Error saving Young's Double Slit result:", slitError);
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
          wavelength,
          slitSeparation,
          screenDistance,
          fringeWidth: fringeWidth_mm,
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
          subject: "Physics",
        },
      };

      await checkAndAwardBadges(user.id, newXP, completedRun);
    }

    logEvent("experiment_completed", {
      score,
      wavelength,
      slitSeparation,
      screenDistance,
      fringeWidth: fringeWidth_mm,
      xp_earned: xpEarned,
    });

    toast.success(`Experiment completed! You earned ${xpEarned} XP!`);
  };

  // Determine interference type at hovered point
  const interferenceType = hoveredPoint
    ? hoveredPoint.isBright
      ? "Constructive"
      : "Destructive"
    : null;

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
              <Waves className="h-8 w-8 text-primary" />
              {experiment?.name || "Young's Double Slit Experiment"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {experiment?.description ||
                "Explore wave interference and the formation of interference patterns"}
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
                  Adjust parameters to observe changes in the interference pattern
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Wavelength Control */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="wavelength" className="text-base font-semibold">
                      Wavelength (λ in nm)
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      Range: 380-700 nm
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="wavelength"
                      min={380}
                      max={700}
                      step={10}
                      value={[wavelength]}
                      onValueChange={(value) => setWavelength(value[0])}
                      disabled={isCompleted}
                      className="flex-1"
                      aria-label="Wavelength slider"
                    />
                    <Input
                      type="number"
                      min={380}
                      max={700}
                      step={10}
                      value={wavelength}
                      onChange={(e) => {
                        const val = Math.max(380, Math.min(700, parseFloat(e.target.value) || 380));
                        setWavelength(val);
                      }}
                      disabled={isCompleted}
                      className="w-24"
                      aria-label="Wavelength input"
                    />
                    <span className="text-sm font-medium w-8">nm</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: wavelengthToRGB(wavelength) }}
                    />
                    <span>Visible spectrum color</span>
                  </div>
                </div>

                {/* Slit Separation Control */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="slit-separation" className="text-base font-semibold">
                      Slit Separation (d in mm)
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      Range: 0.1-1.0 mm
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="slit-separation"
                      min={0.1}
                      max={1.0}
                      step={0.01}
                      value={[slitSeparation]}
                      onValueChange={(value) => setSlitSeparation(value[0])}
                      disabled={isCompleted}
                      className="flex-1"
                      aria-label="Slit separation slider"
                    />
                    <Input
                      type="number"
                      min={0.1}
                      max={1.0}
                      step={0.01}
                      value={slitSeparation.toFixed(2)}
                      onChange={(e) => {
                        const val = Math.max(0.1, Math.min(1.0, parseFloat(e.target.value) || 0.1));
                        setSlitSeparation(val);
                      }}
                      disabled={isCompleted}
                      className="w-24"
                      aria-label="Slit separation input"
                    />
                    <span className="text-sm font-medium w-8">mm</span>
                  </div>
                </div>

                {/* Screen Distance Control */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="screen-distance" className="text-base font-semibold">
                      Screen Distance (D in m)
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      Range: 0.5-3.0 m
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="screen-distance"
                      min={0.5}
                      max={3.0}
                      step={0.1}
                      value={[screenDistance]}
                      onValueChange={(value) => setScreenDistance(value[0])}
                      disabled={isCompleted}
                      className="flex-1"
                      aria-label="Screen distance slider"
                    />
                    <Input
                      type="number"
                      min={0.5}
                      max={3.0}
                      step={0.1}
                      value={screenDistance.toFixed(1)}
                      onChange={(e) => {
                        const val = Math.max(0.5, Math.min(3.0, parseFloat(e.target.value) || 0.5));
                        setScreenDistance(val);
                      }}
                      disabled={isCompleted}
                      className="w-24"
                      aria-label="Screen distance input"
                    />
                    <span className="text-sm font-medium w-8">m</span>
                  </div>
                </div>

                {/* Fringe Width Display */}
                <div className="p-4 rounded-lg bg-primary/10 border-2 border-primary/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Fringe Width (β)</Label>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-primary">
                        {fringeWidth_mm.toFixed(3)}
                      </span>
                      <span className="text-sm text-muted-foreground">mm</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Calculated using: β = (λ × D) / d = ({wavelength} × 10⁻⁹ m × {screenDistance} m) / ({slitSeparation} × 10⁻³ m) = {fringeWidth_mm.toFixed(3)} mm
                  </p>
                </div>

                {/* Interference Type Display */}
                {hoveredPoint && (
                  <div className="p-4 rounded-lg bg-accent/10 border-2 border-accent/20">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-muted-foreground">
                          Type of interference:
                        </span>
                        <span className="text-base font-bold text-accent">
                          {interferenceType} at selected point
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Fringe order: n = {hoveredPoint.order}</p>
                        <p>Distance from center: x = {hoveredPoint.x.toFixed(2)} mm</p>
                      </div>
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
                    aria-label="Reset experiment"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                  <Button
                    variant="hero"
                    onClick={handleSubmitResult}
                    disabled={isCompleted}
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
                <CardTitle>Interference Pattern Visualization</CardTitle>
                <CardDescription>
                  Hover over the screen to see fringe details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative bg-gradient-to-b from-secondary/30 to-secondary/10 rounded-xl overflow-hidden p-4">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={400}
                    className="w-full h-auto max-w-full mx-auto block cursor-crosshair"
                    onMouseMove={handleCanvasMouseMove}
                    onMouseLeave={handleCanvasMouseLeave}
                    aria-label="Young's Double Slit experiment visualization showing light source, barrier with two slits, and interference pattern on screen"
                  />
                </div>
                {/* Screen reader description */}
                <div className="sr-only mt-4">
                  Young's Double Slit experiment visualization. Light source on the left emits
                  monochromatic light at {wavelength} nm wavelength. The light passes through two
                  slits separated by {slitSeparation} mm. The interference pattern on the screen
                  shows bright and dark fringes with a fringe width of {fringeWidth_mm.toFixed(3)} mm.
                  {hoveredPoint &&
                    ` Currently hovering over ${hoveredPoint.isBright ? "bright" : "dark"} fringe of order ${hoveredPoint.order}.`}
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
                    "Adjust the wavelength slider to change the color of light (380-700 nm)",
                    "Change the slit separation to observe how it affects fringe spacing",
                    "Modify the screen distance to see its impact on the pattern",
                    "Hover over the interference pattern on the screen to see fringe details",
                    "Observe how the fringe width changes with different parameters",
                    "Click 'Submit Result' when finished exploring",
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

            {/* Formula Card */}
            <Card variant="gradient" className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <CardHeader>
                <CardTitle>Physics Formula</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-semibold mb-1">Fringe Width:</p>
                    <div className="text-center text-lg font-bold">β = (λ × D) / d</div>
                    <div className="text-xs text-muted-foreground mt-2 space-y-1">
                      <p>β = Fringe width (mm)</p>
                      <p>λ = Wavelength (m)</p>
                      <p>D = Screen distance (m)</p>
                      <p>d = Slit separation (m)</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t">
                    <p className="font-semibold mb-1">Bright Fringes:</p>
                    <div className="text-center text-base font-medium">x = nβ</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      where n = 0, ±1, ±2, ±3...
                    </p>
                  </div>
                  <div className="pt-2">
                    <p className="font-semibold mb-1">Dark Fringes:</p>
                    <div className="text-center text-base font-medium">x = (n + 0.5)β</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      where n = 0, ±1, ±2, ±3...
                    </p>
                  </div>
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
                  <span className="text-muted-foreground">Wavelength: </span>
                  <span className="font-medium">{wavelength} nm</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Slit Separation: </span>
                  <span className="font-medium">{slitSeparation.toFixed(2)} mm</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Screen Distance: </span>
                  <span className="font-medium">{screenDistance.toFixed(1)} m</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fringe Width: </span>
                  <span className="font-medium">{fringeWidth_mm.toFixed(3)} mm</span>
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
                        Final Wavelength:{" "}
                        <span className="font-medium">{wavelength} nm</span>
                      </p>
                      <p>
                        Final Fringe Width:{" "}
                        <span className="font-medium">{fringeWidth_mm.toFixed(3)} mm</span>
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

