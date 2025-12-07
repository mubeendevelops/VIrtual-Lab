-- ============================================================================
-- Blood Group Determination Experiment Migration
-- This file contains the bloodgroup_runs table, experiment entry, and badges
-- ============================================================================

-- Create bloodgroup_runs table for experiment results
CREATE TABLE IF NOT EXISTS public.bloodgroup_runs (
    id serial PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    sample_id text NOT NULL,
    anti_a text NOT NULL CHECK (anti_a IN ('positive', 'negative')),
    anti_b text NOT NULL CHECK (anti_b IN ('positive', 'negative')),
    anti_d text NOT NULL CHECK (anti_d IN ('positive', 'negative')),
    blood_group text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bloodgroup_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bloodgroup_runs
CREATE POLICY "Users can view their own Blood Group runs"
    ON public.bloodgroup_runs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Blood Group runs"
    ON public.bloodgroup_runs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teachers and admins can view all Blood Group runs"
    ON public.bloodgroup_runs FOR SELECT
    USING (public.get_user_role(auth.uid()) IN ('teacher', 'admin'));

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_bloodgroup_runs_user_id ON public.bloodgroup_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_bloodgroup_runs_created_at ON public.bloodgroup_runs(created_at DESC);

-- Insert Blood Group Determination experiment into experiments table
INSERT INTO public.experiments (name, description, subject, difficulty, xp_reward, duration_minutes, instructions) VALUES
    ('Blood Group Determination', 
     'Determine blood groups using agglutination reactions with specific antibodies. Apply Anti-A, Anti-B, and Anti-D reagents to blood samples and observe agglutination patterns to identify blood groups.',
     'Biology', 
     'medium', 
     150, 
     20, 
     '{
        "steps": [
            "Select a blood sample from the dropdown",
            "Click on each reagent button (Anti-A, Anti-B, Anti-D) to apply it to the slide",
            "Observe the agglutination reaction in each section of the glass slide",
            "Positive reaction shows clumping (agglutination), negative shows smooth drop",
            "After applying all three reagents, the blood group will be automatically determined",
            "Review the reaction results and final blood group",
            "Click ''Submit Result'' when finished"
        ],
        "objectives": [
            "Understand blood group classification systems (ABO and Rh)",
            "Learn how agglutination reactions work",
            "Identify blood groups based on antigen-antibody reactions",
            "Understand the difference between positive and negative agglutination",
            "Apply scientific method to determine unknown blood samples"
        ]
    }')
ON CONFLICT DO NOTHING;

-- Insert badges for Blood Group Determination experiment
INSERT INTO public.badges (name, description, icon, tier, xp_requirement, criteria) VALUES
    -- Bronze tier badges
    ('Blood Group Beginner', 'Complete the Blood Group Determination experiment once', '🩸', 'bronze', 0, '{"experiment_type": "blood group", "completed": true}'),
    
    -- Silver tier badges
    ('Blood Group Master', 'Achieve 90%+ accuracy in the Blood Group Determination experiment', '💉', 'silver', 500, '{"experiment_type": "blood group", "accuracy_threshold": 90}'),
    
    -- Gold tier badges
    ('Blood Group Expert', 'Complete the Blood Group Determination experiment 3 times with 85%+ accuracy', '🧬', 'gold', 2000, '{"experiment_type": "blood group", "experiments_completed": 3, "min_accuracy": 85}')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

