-- ============================================================================
-- Initial Schema Migration
-- This file contains all base tables, functions, triggers, RLS policies, and initial data
-- ============================================================================

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('student', 'teacher', 'admin');

-- Create profiles table for user data
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    role app_role DEFAULT 'student' NOT NULL,
    xp_points INTEGER DEFAULT 0 NOT NULL,
    level INTEGER DEFAULT 1 NOT NULL,
    class_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create user_roles table for role-based access control (security best practice)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (user_id, role)
);

-- Create experiments table
CREATE TABLE public.experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    subject TEXT NOT NULL,
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    xp_reward INTEGER DEFAULT 100 NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    instructions JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create experiment_runs table (student attempts)
CREATE TABLE public.experiment_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    experiment_id UUID REFERENCES public.experiments(id) ON DELETE CASCADE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    score INTEGER,
    accuracy DECIMAL(5,2),
    data JSONB,
    xp_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create event_logs table for analytics
CREATE TABLE public.event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    experiment_run_id UUID REFERENCES public.experiment_runs(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create badges table
CREATE TABLE public.badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
    xp_requirement INTEGER DEFAULT 0,
    criteria JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create user_badges junction table
CREATE TABLE public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (user_id, badge_id)
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;

-- Create function to get user role from profiles
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = _user_id
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Teachers and admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (
        public.get_user_role(auth.uid()) IN ('teacher', 'admin')
    );

-- Add RLS policy to allow all authenticated users to view student profiles for leaderboard
-- This allows the leaderboard to display all students' XP and rankings
CREATE POLICY "Everyone can view student profiles for leaderboard"
    ON public.profiles FOR SELECT
    USING (
        role = 'student' AND auth.uid() IS NOT NULL
    );

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
    ON public.user_roles FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for experiments (everyone can read active experiments)
CREATE POLICY "Everyone can view active experiments"
    ON public.experiments FOR SELECT
    USING (is_active = true);

CREATE POLICY "Teachers and admins can manage experiments"
    ON public.experiments FOR ALL
    USING (public.get_user_role(auth.uid()) IN ('teacher', 'admin'));

-- RLS Policies for experiment_runs
CREATE POLICY "Users can view their own experiment runs"
    ON public.experiment_runs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own experiment runs"
    ON public.experiment_runs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own experiment runs"
    ON public.experiment_runs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Teachers and admins can view all experiment runs"
    ON public.experiment_runs FOR SELECT
    USING (public.get_user_role(auth.uid()) IN ('teacher', 'admin'));

-- RLS Policies for event_logs
CREATE POLICY "Users can view their own events"
    ON public.event_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own events"
    ON public.event_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teachers and admins can view all events"
    ON public.event_logs FOR SELECT
    USING (public.get_user_role(auth.uid()) IN ('teacher', 'admin'));

-- RLS Policies for badges (everyone can view badges)
CREATE POLICY "Everyone can view badges"
    ON public.badges FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage badges"
    ON public.badges FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_badges
CREATE POLICY "Users can view their own badges"
    ON public.user_badges FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can grant badges"
    ON public.user_badges FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teachers and admins can view all user badges"
    ON public.user_badges FOR SELECT
    USING (public.get_user_role(auth.uid()) IN ('teacher', 'admin'));

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student')
    );
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (
        NEW.id,
        COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student')
    );
    
    RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update profile timestamp
-- Fix function search path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_experiments_updated_at
    BEFORE UPDATE ON public.experiments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default badges
INSERT INTO public.badges (name, description, icon, tier, xp_requirement, criteria) VALUES
    ('First Steps', 'Complete your first experiment', '🧪', 'bronze', 0, '{"experiments_completed": 1}'),
    ('Titration Beginner', 'Complete the Acid-Base Titration experiment', '⚗️', 'bronze', 0, '{"experiment_type": "titration", "completed": true}'),
    ('Accuracy Master', 'Achieve 95%+ accuracy in any experiment', '🎯', 'silver', 500, '{"accuracy_threshold": 95}'),
    ('Lab Regular', 'Complete 10 experiments', '🔬', 'silver', 1000, '{"experiments_completed": 10}'),
    ('Science Star', 'Earn 5000 XP points', '⭐', 'gold', 5000, '{"xp_threshold": 5000}'),
    ('Lab Expert', 'Complete 50 experiments', '🏆', 'gold', 10000, '{"experiments_completed": 50}'),
    ('Chemistry Wizard', 'Complete all chemistry experiments with 90%+ accuracy', '🧙', 'platinum', 25000, '{"subject": "chemistry", "min_accuracy": 90}');

-- Insert default experiment (Acid-Base Titration)
INSERT INTO public.experiments (name, description, subject, difficulty, xp_reward, duration_minutes, instructions) VALUES
    ('Acid-Base Titration', 'Learn to determine the concentration of an acid by titrating it with a base of known concentration. Watch the pH change and observe the color indicator transition at the equivalence point.', 'Chemistry', 'medium', 150, 20, '{
        "steps": [
            "Fill the burette with NaOH solution (0.1M)",
            "Add 25mL of HCl solution to the flask",
            "Add a few drops of phenolphthalein indicator",
            "Slowly add NaOH drop by drop",
            "Watch for the pink color change",
            "Record the volume at equivalence point"
        ],
        "objectives": [
            "Understand acid-base neutralization",
            "Learn to use a burette accurately",
            "Identify the equivalence point",
            "Calculate unknown concentration"
        ]
    }');

