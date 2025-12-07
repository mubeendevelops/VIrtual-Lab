-- ============================================================================
-- Osmosis and Plasmolysis Experiment Migration
-- This file contains the osmosis_plasmolysis_runs table, experiment entry, and badges
-- ============================================================================

-- Create osmosis_plasmolysis_runs table for experiment results
CREATE TABLE IF NOT EXISTS public.osmosis_plasmolysis_runs (
    id serial PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    cell_type text NOT NULL,
    external_solution text NOT NULL,
    external_concentration numeric,
    predicted_state text NOT NULL CHECK (predicted_state IN ('Turgid', 'Flaccid', 'Plasmolysed')),
    simulation_duration_sec numeric,
    created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.osmosis_plasmolysis_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for osmosis_plasmolysis_runs
CREATE POLICY "Users can view their own Osmosis runs"
    ON public.osmosis_plasmolysis_runs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Osmosis runs"
    ON public.osmosis_plasmolysis_runs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teachers and admins can view all Osmosis runs"
    ON public.osmosis_plasmolysis_runs FOR SELECT
    USING (public.get_user_role(auth.uid()) IN ('teacher', 'admin'));

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_osmosis_plasmolysis_runs_user_id ON public.osmosis_plasmolysis_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_osmosis_plasmolysis_runs_created_at ON public.osmosis_plasmolysis_runs(created_at DESC);

-- Insert Osmosis and Plasmolysis experiment into experiments table
INSERT INTO public.experiments (name, description, subject, difficulty, xp_reward, duration_minutes, instructions) VALUES
    ('Osmosis and Plasmolysis Laboratory', 
     'Explore how plant cells respond to different external solute concentrations through osmosis. Observe how cells become turgid, flaccid, or plasmolysed based on the concentration gradient. Watch animated water movement and cell structure changes in real-time.',
     'Biology', 
     'medium', 
     150, 
     20, 
     '{
        "steps": [
            "Select a cell type (Onion epidermal cell or Rhoeo leaf cell)",
            "Choose an external solution from the dropdown or adjust the concentration slider",
            "Observe how the tonicity label updates automatically (Hypotonic/Isotonic/Hypertonic)",
            "Watch the plant cell diagram change based on the concentration difference",
            "Notice the water movement arrows (green = into cell, red = out of cell)",
            "Click ''Start Simulation'' to animate the cell transition over 4 seconds",
            "Read the net water movement and cell state readouts below the diagram",
            "Click ''Submit Observation'' when finished exploring"
        ],
        "objectives": [
            "Understand osmosis and how water moves across semi-permeable membranes",
            "Recognize the relationship between solute concentration and water movement",
            "Identify the three cell states: Turgid, Flaccid, and Plasmolysed",
            "Understand the difference between hypotonic, isotonic, and hypertonic solutions",
            "Observe how plant cells respond to different external environments"
        ]
    }')
ON CONFLICT DO NOTHING;

-- Insert badges for Osmosis and Plasmolysis experiment
INSERT INTO public.badges (name, description, icon, tier, xp_requirement, criteria) VALUES
    -- Bronze tier badges
    ('Osmosis Beginner', 'Complete the Osmosis and Plasmolysis Laboratory experiment once', '🔬', 'bronze', 0, '{"experiment_type": "osmosis", "completed": true}'),
    
    -- Silver tier badges
    ('Osmosis Master', 'Achieve 90%+ accuracy in any Osmosis and Plasmolysis experiment attempt', '💧', 'silver', 500, '{"experiment_type": "osmosis", "accuracy_threshold": 90}'),
    ('Biology Explorer', 'Complete 5 Biology experiments (any accuracy)', '🌿', 'silver', 1000, '{"subject": "biology", "experiments_completed": 5}'),
    
    -- Gold tier badges
    ('Osmosis Expert', 'Complete the Osmosis and Plasmolysis experiment 3 times, each with 85%+ accuracy', '🧪', 'gold', 2000, '{"experiment_type": "osmosis", "experiments_completed": 3, "min_accuracy": 85}'),
    ('Biology Scholar', 'Complete 10 Biology experiments (any accuracy)', '🌱', 'gold', 5000, '{"subject": "biology", "experiments_completed": 10}'),
    
    -- Platinum tier badge
    ('Biology Wizard', 'Complete all Biology experiments with 90%+ accuracy on each', '🧙', 'platinum', 15000, '{"subject": "biology", "min_accuracy": 90}')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

