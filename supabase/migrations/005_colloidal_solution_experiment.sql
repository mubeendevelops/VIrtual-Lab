-- ============================================================================
-- Colloidal Solution Experiment Migration
-- This file contains the colloid_runs table, experiment entry, and badges
-- ============================================================================

-- Create colloid_runs table for experiment results
CREATE TABLE IF NOT EXISTS public.colloid_runs (
    id serial PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    sol_type text NOT NULL,
    concentration numeric NOT NULL CHECK (concentration >= 0 AND concentration <= 10),
    colloid_status text NOT NULL CHECK (colloid_status IN ('Not Formed', 'Weak Colloid', 'Stable Colloid', 'Unstable Colloid')),
    scattering_level text NOT NULL CHECK (scattering_level IN ('No scattering', 'Faint scattering', 'Strong scattering', 'Irregular scattering')),
    stability_score numeric NOT NULL CHECK (stability_score >= 0 AND stability_score <= 1),
    created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.colloid_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for colloid_runs
CREATE POLICY "Users can view their own Colloid runs"
    ON public.colloid_runs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Colloid runs"
    ON public.colloid_runs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teachers and admins can view all Colloid runs"
    ON public.colloid_runs FOR SELECT
    USING (public.get_user_role(auth.uid()) IN ('teacher', 'admin'));

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_colloid_runs_user_id ON public.colloid_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_colloid_runs_created_at ON public.colloid_runs(created_at DESC);

-- Insert Colloidal Solution experiment into experiments table
INSERT INTO public.experiments (name, description, subject, difficulty, xp_reward, duration_minutes, instructions) VALUES
    ('Preparation of Colloidal Solution', 
     'Explore the Tyndall effect and observe how colloidal solutions scatter light. Adjust sol type and concentration to understand the formation and stability of colloids. Observe the visible light beam in colloidal solutions compared to true solutions.',
     'Chemistry', 
     'medium', 
     150, 
     20, 
     '{
        "steps": [
            "Select a sol type (Starch Sol, Sulphur Sol, or True Solution as control)",
            "Adjust the concentration slider to change the percentage (0-10%)",
            "Observe how the colloid status changes based on concentration",
            "Click ''Start Experiment'' to begin the observation",
            "Watch the Tyndall effect visualization in the beaker",
            "Note the stability bar for unstable colloids",
            "Click ''Save Observation'' when finished exploring"
        ],
        "objectives": [
            "Understand the difference between true solutions and colloidal solutions",
            "Observe the Tyndall effect and light scattering",
            "Recognize how concentration affects colloid formation",
            "Understand the relationship between particle size and light scattering",
            "Identify stable and unstable colloidal solutions"
        ]
    }')
ON CONFLICT DO NOTHING;

-- Insert badges for Colloidal Solution experiment
INSERT INTO public.badges (name, description, icon, tier, xp_requirement, criteria) VALUES
    -- Bronze tier badges
    ('Colloid Beginner', 'Complete the Preparation of Colloidal Solution experiment once', '🧪', 'bronze', 0, '{"experiment_type": "colloid", "completed": true}'),
    
    -- Silver tier badges
    ('Colloid Master', 'Achieve 90%+ accuracy in any Colloidal Solution experiment attempt', '💎', 'silver', 500, '{"experiment_type": "colloid", "accuracy_threshold": 90}'),
    
    -- Gold tier badges
    ('Colloid Expert', 'Complete the Colloidal Solution experiment 3 times, each with 85%+ accuracy', '⚗️', 'gold', 2000, '{"experiment_type": "colloid", "experiments_completed": 3, "min_accuracy": 85}')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

