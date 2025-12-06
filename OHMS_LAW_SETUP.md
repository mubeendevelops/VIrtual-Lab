# Ohm's Law Experiment Setup Guide

This guide explains how to set up and use the Ohm's Law interactive experiment module.

## Overview

The Ohm's Law experiment allows students to explore the relationship between voltage (V), current (I), and resistance (R) using the formula: **I = V / R**

## Features

- **Interactive Controls**: Sliders and number inputs for voltage (0-20V) and resistance (1-1000Ω)
- **Real-time Calculation**: Current automatically calculated and displayed with 3 decimal places
- **Live Graph**: Voltage-Current graph updates in real-time as parameters change
- **XP Rewards**: Earn XP points for completing the experiment
- **Progress Tracking**: All results saved to database for analysis

## Database Setup

### 1. Run Migrations

Apply the database migrations to create the required tables:

**Using Supabase Dashboard:**
1. Go to **SQL Editor** in your Supabase dashboard
2. Run `supabase/migrations/20251205130000_add_ohmslaw_table.sql`
3. Run `supabase/migrations/20251205130001_insert_ohmslaw_experiment.sql`

**Using Supabase CLI:**
```bash
supabase db push
```

### 2. Verify Tables

The migrations create:
- `ohmslaw_runs` table - stores experiment results
- Inserts default "Ohm's Law Laboratory" experiment

## Frontend Component

The experiment component is located at:
- `src/pages/OhmsLawExperiment.tsx`

### Key Features:

1. **Voltage Control** (0-20V)
   - Slider with number input
   - Real-time updates
   - Accessible with keyboard navigation

2. **Resistance Control** (1-1000Ω)
   - Slider with number input
   - Real-time updates
   - Accessible with keyboard navigation

3. **Current Display**
   - Read-only display showing calculated current
   - Formula shown: I = V / R
   - Updates automatically

4. **Live Graph**
   - Canvas-based V-I graph
   - Shows linear relationship
   - Updates on every parameter change
   - Grid lines and axis labels

5. **Controls**
   - Reset button (restores V=5, R=100)
   - Submit Result button (saves to database)

## Routing

The experiment is accessible via:
- Route: `/experiment-ohmslaw/:id`
- Where `:id` is the experiment ID from the database

The Experiments page automatically routes Physics experiments to this component.

## Data Flow

### Experiment Flow:

1. **Start**: User clicks "Start Experiment" from experiments list
2. **Initialize**: Creates `experiment_runs` record with status 'in_progress'
3. **Interact**: User adjusts voltage/resistance sliders
4. **Track**: Each change logs `parameter_changed` event
5. **Submit**: User clicks "Submit Result"
6. **Save**: 
   - Inserts into `ohmslaw_runs` table
   - Updates `experiment_runs` with completion status
   - Awards XP points
   - Checks for badge eligibility

### API Endpoints (Supabase):

The component uses Supabase client directly:

**Insert Result:**
```typescript
await supabase
  .from('ohmslaw_runs')
  .insert({
    user_id: user.id,
    voltage: voltage,
    resistance: resistance,
    current: current,
  });
```

**Update Experiment Run:**
```typescript
await supabase
  .from('experiment_runs')
  .update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    score: score,
    xp_earned: xpEarned,
    data: { voltage, resistance, current },
  })
  .eq('id', experimentRunId);
```

## Database Schema

### ohmslaw_runs Table

```sql
CREATE TABLE ohmslaw_runs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    voltage NUMERIC(10, 2) CHECK (voltage >= 0 AND voltage <= 20),
    resistance NUMERIC(10, 2) CHECK (resistance >= 1 AND resistance <= 1000),
    current NUMERIC(10, 4) CHECK (current >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Sample Data

```json
{
  "user_id": "11111111-1111-1111-1111-111111111111",
  "voltage": 5,
  "resistance": 100,
  "current": 0.05
}
```

## Analytics Events

The component emits the following tracking events:

1. **experiment_started**
   - Triggered: On component mount
   - Data: `{ experiment_id }`

2. **parameter_changed**
   - Triggered: On every slider/input change
   - Data: `{ param, voltage, resistance, current }`

3. **experiment_completed**
   - Triggered: On "Submit Result"
   - Data: `{ score, voltage, resistance, current, xp_earned }`

Events are logged to the `event_logs` table.

## Accessibility

- Keyboard navigation for all sliders
- ARIA labels on inputs
- Screen reader friendly labels
- Focus indicators on interactive elements

## Mobile Responsiveness

- Responsive grid layout
- Touch-friendly sliders
- Mobile-optimized graph display
- Adaptive button sizing

## Testing

### Manual Testing Steps:

1. Navigate to `/experiments`
2. Find "Ohm's Law Laboratory" experiment
3. Click "Start Experiment"
4. Adjust voltage slider - verify current updates
5. Adjust resistance slider - verify current updates
6. Verify graph updates in real-time
7. Click "Reset" - verify values return to defaults
8. Click "Submit Result" - verify:
   - Success toast appears
   - XP is awarded
   - Data is saved to database

### Database Verification:

```sql
-- Check saved results
SELECT * FROM ohmslaw_runs ORDER BY created_at DESC LIMIT 10;

-- Check experiment runs
SELECT * FROM experiment_runs 
WHERE experiment_id IN (
  SELECT id FROM experiments WHERE name LIKE '%Ohm%'
) ORDER BY created_at DESC;
```

## Troubleshooting

**Graph not updating:**
- Check browser console for errors
- Verify canvas ref is properly initialized
- Ensure graphData state is updating

**Results not saving:**
- Verify user is authenticated
- Check Supabase RLS policies
- Verify ohmslaw_runs table exists
- Check browser console for errors

**XP not awarded:**
- Verify experiment_runs record exists
- Check profile update permissions
- Verify xp_reward value in experiments table

## Integration with Existing System

The Ohm's Law experiment integrates seamlessly with:
- ✅ User authentication (via AuthContext)
- ✅ XP and leveling system
- ✅ Badge awarding system
- ✅ Experiment tracking
- ✅ Leaderboard (via XP earned)
- ✅ Profile statistics

## Next Steps

1. Run the database migrations
2. Start the development server: `npm run dev`
3. Navigate to experiments page
4. Start the Ohm's Law experiment
5. Test all functionality

## Files Created

- `src/pages/OhmsLawExperiment.tsx` - Main experiment component
- `supabase/migrations/20251205130000_add_ohmslaw_table.sql` - Table creation
- `supabase/migrations/20251205130001_insert_ohmslaw_experiment.sql` - Default experiment data

## Notes

- The experiment uses Supabase as the backend (not Express)
- All data is stored in PostgreSQL via Supabase
- RLS policies ensure users can only see their own data
- Teachers/admins can view all student results

