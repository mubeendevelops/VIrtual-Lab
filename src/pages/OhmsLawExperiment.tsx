import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { checkAndAwardBadges } from '@/lib/badgeUtils';
import { 
  Zap, 
  RotateCcw, 
  CheckCircle, 
  Info,
  Gauge,
  TrendingUp
} from 'lucide-react';

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
      logEvent('experiment_started', { experiment_id: experiment.id });
    }
  }, [experimentRunId]);

  // Define drawGraph function first using useCallback
  const drawGraph = useCallback(() => {
    const canvas = graphCanvasRef.current;
    if (!canvas) {
      console.warn('Canvas not found - graph will be drawn when canvas is ready');
      return;
    }
    
    // Ensure canvas has valid dimensions
    if (canvas.width === 0 || canvas.height === 0) {
      // Try to set default dimensions if not set
      if (canvas.width === 0) canvas.width = 600;
      if (canvas.height === 0) canvas.height = 400;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2d context from canvas');
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = padding + (i / 10) * graphWidth;
      const y = padding + (i / 10) * graphHeight;
      
      // Vertical grid lines
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
      
      // Horizontal grid lines
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    
    // X-axis (Voltage)
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Y-axis (Current)
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = '#1e293b';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Voltage (V)', width / 2, height - 10);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Current (A)', 0, 0);
    ctx.restore();

    // Draw axis ticks and labels
    ctx.textAlign = 'center';
    for (let i = 0; i <= 10; i++) {
      const x = padding + (i / 10) * graphWidth;
      const voltageValue = (i / 10) * 20;
      ctx.fillText(voltageValue.toFixed(0), x, height - padding + 20);
    }

    // Calculate max current for scaling (ensure graph shows meaningful range)
    // Use the maximum possible current at 20V for this resistance, with a minimum of 0.2A
    const maxCurrentAtMaxVoltage = resistance > 0 ? 20 / resistance : 0.2;
    const maxCurrentForGraph = Math.max(0.2, maxCurrentAtMaxVoltage * 1.1); // Show up to 110% of max at 20V
    
    ctx.textAlign = 'right';
    for (let i = 0; i <= 10; i++) {
      const y = height - padding - (i / 10) * graphHeight;
      const currentValue = (i / 10) * maxCurrentForGraph;
      ctx.fillText(currentValue.toFixed(3), padding - 10, y + 4);
    }

    // Draw V-I line (Ohm's Law: I = V/R) - linear relationship
    if (resistance > 0) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      let firstPoint = true;
      for (let v = 0; v <= 20; v += 0.1) {
        const i = v / resistance;
        const x = padding + (v / 20) * graphWidth;
        const y = height - padding - (i / maxCurrentForGraph) * graphHeight;
        
        // Ensure y is within bounds
        const clampedY = Math.max(padding, Math.min(height - padding, y));
        
        if (firstPoint) {
          ctx.moveTo(x, clampedY);
          firstPoint = false;
        } else {
          ctx.lineTo(x, clampedY);
        }
      }
      ctx.stroke();
      
      // Add line label
      ctx.fillStyle = '#3b82f6';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left';
      const labelX = padding + (15 / 20) * graphWidth;
      const labelY = height - padding - ((15 / resistance) / maxCurrentForGraph) * graphHeight;
      ctx.fillText(`R = ${resistance}Ω`, labelX + 5, Math.max(padding + 15, labelY));
    }

    // Draw current data point (red dot showing current position)
    const pointX = padding + (voltage / 20) * graphWidth;
    const pointY = height - padding - (current / maxCurrentForGraph) * graphHeight;
    
    // Only draw if point is within graph bounds
    if (pointX >= padding && pointX <= width - padding && pointY >= padding && pointY <= height - padding) {
      // Draw point
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(pointX, pointY, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw point outline
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw value label
      ctx.fillStyle = '#1e293b';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`V=${voltage.toFixed(1)}, I=${current.toFixed(3)}`, pointX, pointY - 10);
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
      const hasChanged = prevValuesRef.current.voltage !== voltage || 
                        prevValuesRef.current.resistance !== resistance;
      
      if (hasChanged) {
        setInteractionCount(prev => prev + 1);
        prevValuesRef.current = { voltage, resistance };
        
        // Log parameter change (debounced to avoid too many events)
        const timeoutId = setTimeout(() => {
          logEvent('parameter_changed', { 
            param: 'voltage_or_resistance',
            voltage,
            resistance,
            current: voltage / resistance
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
          const event = new Event('resize');
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
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', resizeCanvas);
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
      .from('experiments')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      setExperiment(data as unknown as ExperimentData);
    } else {
      toast.error('Experiment not found');
      navigate('/experiments');
    }
    setLoading(false);
  };

  const startExperimentRun = async () => {
    if (!user || !experiment) return;

    try {
      const { data, error } = await supabase
        .from('experiment_runs')
        .insert({
          user_id: user.id,
          experiment_id: experiment.id,
          status: 'in_progress',
        })
        .select()
        .single();

      if (data && !error) {
        setExperimentRunId(data.id);
      } else if (error) {
        console.error('Error starting experiment run:', error);
      }
    } catch (err) {
      console.error('Error starting experiment run:', err);
    }
  };

  const logEvent = async (eventType: string, eventData: any) => {
    if (!user || !experimentRunId) return;
    
    await supabase.from('event_logs').insert([{
      user_id: user.id,
      experiment_run_id: experimentRunId,
      event_type: eventType,
      event_data: eventData,
    }]);
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

  const handleResistanceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    prevValuesRef.current = { voltage: DEFAULT_VOLTAGE, resistance: DEFAULT_RESISTANCE };
    
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
    const { error: ohmsError } = await supabase
      .from('ohmslaw_runs')
      .insert({
        user_id: user.id,
        voltage: voltage,
        resistance: resistance,
        current: current,
      });

    if (ohmsError) {
      console.error('Error saving Ohm Law result:', ohmsError);
      toast.error('Failed to save result');
      return;
    }

    // Calculate XP - ensure minimum XP is awarded
    const baseXP = Math.max(10, Math.round((score / 100) * experiment.xp_reward)); // Minimum 10 XP
    const xpEarned = baseXP;
    
    const { error: updateError } = await supabase
      .from('experiment_runs')
      .update({
        status: 'completed',
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
      .eq('id', experimentRunId);

    if (updateError) {
      console.error('Error updating experiment run:', updateError);
      toast.error('Failed to update experiment run');
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
        console.error('Error updating profile:', profileError);
      }
    }

    // Check and award badges
    if (user) {
      const completedRun = {
        id: experimentRunId,
        experiment_id: experiment.id,
        status: 'completed',
        score: score,
        accuracy: score,
        experiments: {
          name: experiment.name || '',
          subject: 'Physics',
        },
      };
      
      await checkAndAwardBadges(user.id, profile?.xp_points || 0, completedRun);
    }

    logEvent('experiment_completed', {
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
              {experiment?.name || 'Ohm\'s Law Experiment'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {experiment?.description || 'Explore the relationship between voltage, current, and resistance'}
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
            <Card variant="elevated" className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
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
                    <Label htmlFor="voltage" className="text-base font-semibold">
                      Voltage (V)
                    </Label>
                    <span className="text-sm text-muted-foreground">Range: 0-20 V</span>
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
                    <Label htmlFor="resistance" className="text-base font-semibold">
                      Resistance (Ω)
                    </Label>
                    <span className="text-sm text-muted-foreground">Range: 1-1000 Ω</span>
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
                    <Label className="text-base font-semibold">Current (A)</Label>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-primary">
                        {current.toFixed(3)}
                      </span>
                      <span className="text-sm text-muted-foreground">A</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Calculated using: I = V / R = {voltage.toFixed(1)} / {resistance} = {current.toFixed(3)} A
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
            <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
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
                    style={{ maxHeight: '400px', aspectRatio: '3/2', minHeight: '300px' }}
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
            <Card className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-accent" />
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm">
                  {(experiment?.instructions?.steps || [
                    'Adjust the voltage slider to change voltage (0-20 V)',
                    'Adjust the resistance slider to change resistance (1-1000 Ω)',
                    'Observe how current changes according to I = V / R',
                    'Watch the graph update in real-time',
                    'Experiment with different values to understand the relationship',
                    'Click "Submit Result" when finished'
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
            <Card variant="gradient" className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
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
                    <div className="text-4xl font-bold text-gold mb-2">{score}%</div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {score >= 90 ? 'Excellent work!' : score >= 70 ? 'Good job!' : 'Keep practicing!'}
                    </p>
                    <div className="text-sm space-y-1">
                      <p>Final Voltage: <span className="font-medium">{voltage.toFixed(1)} V</span></p>
                      <p>Final Resistance: <span className="font-medium">{resistance} Ω</span></p>
                      <p>Calculated Current: <span className="font-medium">{current.toFixed(3)} A</span></p>
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

