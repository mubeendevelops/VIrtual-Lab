-- ============================================================================
-- Young's Double Slit Experiment Migration
-- This file contains the youngs_double_slit_runs table, experiment entry, and badges
-- ============================================================================

-- Create youngs_double_slit_runs table for experiment results
CREATE TABLE IF NOT EXISTS public.youngs_double_slit_runs (
    id serial PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    wavelength_nm numeric NOT NULL CHECK (wavelength_nm >= 380 AND wavelength_nm <= 700),
    slit_separation_mm numeric NOT NULL CHECK (slit_separation_mm >= 0.1 AND slit_separation_mm <= 1.0),
    screen_distance_m numeric NOT NULL CHECK (screen_distance_m >= 0.5 AND screen_distance_m <= 3.0),
    fringe_width_mm numeric NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.youngs_double_slit_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for youngs_double_slit_runs
CREATE POLICY "Users can view their own Young's Double Slit runs"
    ON public.youngs_double_slit_runs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Young's Double Slit runs"
    ON public.youngs_double_slit_runs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teachers and admins can view all Young's Double Slit runs"
    ON public.youngs_double_slit_runs FOR SELECT
    USING (public.get_user_role(auth.uid()) IN ('teacher', 'admin'));

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_youngs_double_slit_runs_user_id ON public.youngs_double_slit_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_youngs_double_slit_runs_created_at ON public.youngs_double_slit_runs(created_at DESC);

-- Insert Young's Double Slit experiment into experiments table
INSERT INTO public.experiments (name, description, subject, difficulty, xp_reward, duration_minutes, instructions) VALUES
    ('Young''s Double Slit Experiment', 
     'Explore wave interference and the formation of interference patterns. Adjust wavelength, slit separation, and screen distance to observe how these parameters affect the fringe pattern. Understand constructive and destructive interference in wave optics.',
     'Physics', 
     'medium', 
     150, 
     20, 
     '{
        "steps": [
            "Adjust the wavelength slider to change the color of light (380-700 nm visible spectrum)",
            "Change the slit separation to observe how it affects fringe spacing",
            "Modify the screen distance to see its impact on the interference pattern",
            "Hover over the interference pattern on the screen to see fringe details",
            "Observe how the fringe width (β) changes with different parameters",
            "Note the relationship: β = (λ × D) / d",
            "Click ''Submit Result'' when finished exploring"
        ],
        "objectives": [
            "Understand wave interference and the double slit experiment",
            "Recognize the relationship between wavelength, slit separation, and fringe width",
            "Identify constructive and destructive interference patterns",
            "Understand how fringe spacing relates to experimental parameters",
            "Apply the formula β = (λ × D) / d to calculate fringe width"
        ]
    }')
ON CONFLICT DO NOTHING;

-- Insert badges for Young's Double Slit experiment
INSERT INTO public.badges (name, description, icon, tier, xp_requirement, criteria) VALUES
    -- Bronze tier badges
    ('Double Slit Beginner', 'Complete the Young''s Double Slit experiment once', '🌊', 'bronze', 0, '{"experiment_type": "youngs double slit", "completed": true}'),
    
    -- Silver tier badges
    ('Double Slit Master', 'Achieve 90%+ accuracy in any Young''s Double Slit experiment attempt', '💫', 'silver', 500, '{"experiment_type": "youngs double slit", "accuracy_threshold": 90}'),
    
    -- Gold tier badges
    ('Double Slit Expert', 'Complete the Young''s Double Slit experiment 3 times, each with 85%+ accuracy', '⚡', 'gold', 2000, '{"experiment_type": "youngs double slit", "experiments_completed": 3, "min_accuracy": 85}')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

