-- ============================================================================
-- Ohm's Law Features Migration
-- This file contains the Ohm's Law experiment table, experiment entry, and related badges
-- ============================================================================

-- Create ohmslaw_runs table for Ohm's Law experiment results
CREATE TABLE IF NOT EXISTS public.ohmslaw_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    voltage NUMERIC(10, 2) NOT NULL CHECK (voltage >= 0 AND voltage <= 20),
    resistance NUMERIC(10, 2) NOT NULL CHECK (resistance >= 1 AND resistance <= 1000),
    current NUMERIC(10, 4) NOT NULL CHECK (current >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.ohmslaw_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ohmslaw_runs
CREATE POLICY "Users can view their own Ohm's Law runs"
    ON public.ohmslaw_runs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Ohm's Law runs"
    ON public.ohmslaw_runs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teachers and admins can view all Ohm's Law runs"
    ON public.ohmslaw_runs FOR SELECT
    USING (public.get_user_role(auth.uid()) IN ('teacher', 'admin'));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ohmslaw_runs_user_id ON public.ohmslaw_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_ohmslaw_runs_created_at ON public.ohmslaw_runs(created_at DESC);

-- Insert Ohm's Law experiment into experiments table
INSERT INTO public.experiments (name, description, subject, difficulty, xp_reward, duration_minutes, instructions) VALUES
    ('Ohm''s Law Laboratory', 
     'Explore the fundamental relationship between voltage, current, and resistance. Adjust voltage and resistance values to observe how current changes according to Ohm''s Law (I = V / R). Visualize the relationship with a real-time voltage-current graph.',
     'Physics', 
     'easy', 
     120, 
     15, 
     '{
        "steps": [
            "Use the voltage slider to set a voltage between 0-20 V",
            "Use the resistance slider to set a resistance between 1-1000 Ω",
            "Observe the calculated current displayed below",
            "Watch the V-I graph update in real-time as you change values",
            "Experiment with different combinations to understand the relationship",
            "Click Submit Result when you''re finished exploring"
        ],
        "objectives": [
            "Understand Ohm''s Law: I = V / R",
            "Recognize the linear relationship between voltage and current",
            "Understand how resistance affects current flow",
            "Interpret voltage-current graphs"
        ]
    }')
ON CONFLICT DO NOTHING;

-- Insert badges for Ohm's Law experiment
INSERT INTO public.badges (name, description, icon, tier, xp_requirement, criteria) VALUES
    -- Bronze tier badges
    ('Ohm''s Law Beginner', 'Complete the Ohm''s Law Laboratory experiment', '⚡', 'bronze', 0, '{"experiment_type": "ohms law", "completed": true}'),
    
    -- Silver tier badges
    ('Ohm''s Law Master', 'Achieve 90%+ accuracy in the Ohm''s Law experiment', '🔋', 'silver', 500, '{"experiment_type": "ohms law", "accuracy_threshold": 90}'),
    ('Physics Explorer', 'Complete 5 Physics experiments', '🌌', 'silver', 1000, '{"subject": "physics", "experiments_completed": 5}'),
    
    -- Gold tier badges
    ('Ohm''s Law Expert', 'Complete the Ohm''s Law experiment 3 times with 85%+ accuracy', '⚙️', 'gold', 2000, '{"experiment_type": "ohms law", "experiments_completed": 3, "min_accuracy": 85}'),
    ('Physics Scholar', 'Complete 10 Physics experiments', '🔬', 'gold', 5000, '{"subject": "physics", "experiments_completed": 10}'),
    
    -- Platinum tier badge
    ('Physics Wizard', 'Complete all Physics experiments with 90%+ accuracy', '🧙', 'platinum', 15000, '{"subject": "physics", "min_accuracy": 90}');

