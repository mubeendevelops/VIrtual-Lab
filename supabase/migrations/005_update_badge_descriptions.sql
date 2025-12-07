-- ============================================================================
-- Update Badge Descriptions Migration
-- This file updates all badge descriptions to accurately reflect requirements
-- ============================================================================

-- Update Chemistry badges
UPDATE public.badges 
SET description = 'Complete the Acid-Base Titration experiment once'
WHERE name = 'Titration Beginner';

UPDATE public.badges 
SET description = 'Complete all Chemistry experiments with 90%+ accuracy on each'
WHERE name = 'Chemistry Wizard';

-- Update Physics badges
UPDATE public.badges 
SET description = 'Complete the Ohm''s Law Laboratory experiment once'
WHERE name = 'Ohm''s Law Beginner';

UPDATE public.badges 
SET description = 'Achieve 90%+ accuracy in any Ohm''s Law experiment attempt'
WHERE name = 'Ohm''s Law Master';

UPDATE public.badges 
SET description = 'Complete 5 Physics experiments (any accuracy)'
WHERE name = 'Physics Explorer';

UPDATE public.badges 
SET description = 'Complete the Ohm''s Law experiment 3 times, each with 85%+ accuracy'
WHERE name = 'Ohm''s Law Expert';

UPDATE public.badges 
SET description = 'Complete 10 Physics experiments (any accuracy)'
WHERE name = 'Physics Scholar';

UPDATE public.badges 
SET description = 'Complete all Physics experiments with 90%+ accuracy on each'
WHERE name = 'Physics Wizard';

-- Update Young's Double Slit badges
UPDATE public.badges 
SET description = 'Complete the Young''s Double Slit experiment once'
WHERE name = 'Double Slit Beginner';

UPDATE public.badges 
SET description = 'Achieve 90%+ accuracy in any Young''s Double Slit experiment attempt'
WHERE name = 'Double Slit Master';

UPDATE public.badges 
SET description = 'Complete the Young''s Double Slit experiment 3 times, each with 85%+ accuracy'
WHERE name = 'Double Slit Expert';

-- Update Colloidal Solution badges
UPDATE public.badges 
SET description = 'Complete the Preparation of Colloidal Solution experiment once'
WHERE name = 'Colloid Beginner';

UPDATE public.badges 
SET description = 'Achieve 90%+ accuracy in any Colloidal Solution experiment attempt'
WHERE name = 'Colloid Master';

UPDATE public.badges 
SET description = 'Complete the Colloidal Solution experiment 3 times, each with 85%+ accuracy'
WHERE name = 'Colloid Expert';

-- Update Blood Group badges
UPDATE public.badges 
SET description = 'Complete the Blood Group Determination experiment once'
WHERE name = 'Blood Group Beginner';

UPDATE public.badges 
SET description = 'Achieve 90%+ accuracy in any Blood Group Determination experiment attempt'
WHERE name = 'Blood Group Master';

UPDATE public.badges 
SET description = 'Complete the Blood Group Determination experiment 3 times, each with 85%+ accuracy'
WHERE name = 'Blood Group Expert';

-- Update Biology badges
UPDATE public.badges 
SET description = 'Complete the Osmosis and Plasmolysis Laboratory experiment once'
WHERE name = 'Osmosis Beginner';

UPDATE public.badges 
SET description = 'Achieve 90%+ accuracy in any Osmosis and Plasmolysis experiment attempt'
WHERE name = 'Osmosis Master';

UPDATE public.badges 
SET description = 'Complete 5 Biology experiments (any accuracy)'
WHERE name = 'Biology Explorer';

UPDATE public.badges 
SET description = 'Complete the Osmosis and Plasmolysis experiment 3 times, each with 85%+ accuracy'
WHERE name = 'Osmosis Expert';

UPDATE public.badges 
SET description = 'Complete 10 Biology experiments (any accuracy)'
WHERE name = 'Biology Scholar';

UPDATE public.badges 
SET description = 'Complete all Biology experiments with 90%+ accuracy on each'
WHERE name = 'Biology Wizard';

-- Update general badges
UPDATE public.badges 
SET description = 'Complete your first experiment (any subject)'
WHERE name = 'First Steps';

UPDATE public.badges 
SET description = 'Achieve 95%+ accuracy in any single experiment attempt'
WHERE name = 'Accuracy Master';

UPDATE public.badges 
SET description = 'Complete 10 experiments total (any subject, any accuracy)'
WHERE name = 'Lab Regular';

UPDATE public.badges 
SET description = 'Earn 5000 total XP points'
WHERE name = 'Science Star';

UPDATE public.badges 
SET description = 'Complete 50 experiments total (any subject, any accuracy)'
WHERE name = 'Lab Expert';

