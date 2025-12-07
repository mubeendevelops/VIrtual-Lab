# Osmosis and Plasmolysis Experiment Setup Guide

This guide explains how to set up and use the Osmosis and Plasmolysis interactive experiment module.

## Overview

The Osmosis and Plasmolysis experiment allows students to explore how plant cells respond to different external solute concentrations through osmosis. Students can observe how cells become turgid, flaccid, or plasmolysed based on the concentration gradient.

## Features

- **Interactive Controls**: Dropdowns for cell type and external solution, plus a slider for precise concentration control
- **Real-time Visualization**: SVG plant cell diagram that updates based on concentration differences
- **Animated Simulation**: 4-second animation showing the transition from initial to final cell state
- **Water Movement Indicators**: Animated arrows showing direction of water movement
- **State Readouts**: Clear display of net water movement and predicted cell state
- **Data Submission**: Save experiment observations to the database

## Database Setup

### 1. Run Migration

Apply the database migration to create the required table:

**Using Supabase Dashboard:**
1. Go to **SQL Editor** in your Supabase dashboard
2. Run `supabase/migrations/003_osmosis_plasmolysis_runs.sql`

**Using Supabase CLI:**
```bash
supabase db push
```

**Using psql directly:**
```bash
psql -U postgres -d virtuallab -f supabase/migrations/003_osmosis_plasmolysis_runs.sql
```

### 2. Verify Table

The migration creates:
- `osmosis_plasmolysis_runs` table - stores experiment results
- Indexes on `user_id` and `created_at` for performance
- Constraint ensuring `predicted_state` is one of: Turgid, Flaccid, Plasmolysed

## Frontend Component

The experiment component is located at:
- `src/components/OsmosisPlasmolysisLab.tsx`

### Key Features:

1. **Cell Type Selection**
   - Onion epidermal cell
   - Rhoeo leaf cell

2. **External Solution Selection**
   - Distilled water (hypotonic) - 0.0 M
   - 0.9% NaCl (isotonic) - 0.15 M
   - 5% NaCl (hypertonic) - 0.85 M

3. **Concentration Slider**
   - Range: 0.0 - 1.0 M
   - Step: 0.05 M
   - Auto-updates tonicity label (Hypotonic/Isotonic/Hypertonic)

4. **Plant Cell Diagram**
   - Rigid cell wall (fixed outline)
   - Cell membrane (changes size based on water movement)
   - Vacuole (expands for turgid, shrinks for plasmolysed)
   - Animated water arrows (green for into cell, red for out of cell)

5. **State Readouts**
   - Net water movement: into cell / out of cell / no net movement
   - Cell state: Turgid / Flaccid / Plasmolysed

6. **Controls**
   - Reset button (restores defaults: Onion cell, distilled water, 0.0 M)
   - Start Simulation button (animates cell transition over 4 seconds)
   - Submit Observation button (saves results to database)

## Backend API

The component expects a backend API endpoint at:
- `POST /api/experiments/osmosis-plasmolysis/result`

### Request Format:
```json
{
  "user_id": "uuid",
  "cell_type": "Onion epidermal cell",
  "external_solution": "5% NaCl (hypertonic)",
  "external_concentration": 0.85,
  "predicted_state": "Plasmolysed",
  "simulation_duration_sec": 4.0,
  "timestamp": "2025-12-07T10:15:00.000Z"
}
```

### Response Format (201 Created):
```json
{
  "id": 1,
  "user_id": "uuid",
  "cell_type": "Onion epidermal cell",
  "external_solution": "5% NaCl (hypertonic)",
  "external_concentration": 0.85,
  "predicted_state": "Plasmolysed",
  "simulation_duration_sec": 4.0,
  "created_at": "2025-12-07T10:15:00.000Z"
}
```

### Headers:
- `Content-Type: application/json`
- `x-user-id: uuid` (optional, defaults to demo user if not provided)

## Local Development

### Prerequisites

1. **PostgreSQL Database**
   - Install PostgreSQL locally, or
   - Use Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15`
   - Create database: `createdb virtuallab`

2. **Node.js and npm**
   - Node.js 18+ and npm installed

### Setup Steps

1. **Run Database Migration**
   ```bash
   # Using psql
   psql -U postgres -d virtuallab -f supabase/migrations/003_osmosis_plasmolysis_runs.sql
   
   # Or using Supabase CLI
   supabase db push
   ```

2. **Install Frontend Dependencies**
   ```bash
   npm install
   ```

3. **Start Frontend Development Server**
   ```bash
   npm run dev
   ```

4. **Set Up Backend (if using separate Express server)**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   
   Make sure the backend is configured to:
   - Connect to your PostgreSQL database
   - Listen on the port expected by the frontend (or configure proxy in `vite.config.ts`)

5. **Configure API Proxy (if needed)**
   
   If your backend runs on a different port, add proxy configuration to `vite.config.ts`:
   ```typescript
   export default defineConfig({
     // ... existing config
     server: {
       proxy: {
         '/api': {
           target: 'http://localhost:3001',
           changeOrigin: true,
         },
       },
     },
   });
   ```

6. **Access the Experiment**
   - Navigate to the experiment page in your application
   - Or use the component directly: `<OsmosisPlasmolysisLab />`

## Testing

A test file is provided at `backend/__tests__/osmosis-plasmolysis.test.ts` that tests the POST endpoint.

### Run Tests:
```bash
cd backend
npm test
```

The test verifies:
- Successful insertion with valid data (201 response)
- Validation errors for missing/invalid fields (400 response)
- Correct JSON response structure
- User ID handling from header

## Experiment Logic

### Internal Concentration
- Fixed at **0.3 M** (simulating typical plant cell internal solute concentration)

### Tonicity Calculation
- **Hypotonic**: External < 0.25 M → Water moves **into cell** → Cell becomes **Turgid**
- **Isotonic**: External ≈ 0.25-0.35 M → **No net movement** → Cell remains **Flaccid**
- **Hypertonic**: External > 0.35 M → Water moves **out of cell** → Cell becomes **Plasmolysed**

### Animation Behavior
- **Turgid**: Vacuole expands, membrane expands slightly
- **Flaccid**: Minimal change
- **Plasmolysed**: Vacuole shrinks significantly, membrane pulls away from cell wall

## Tracking Events

The component emits the following tracking events (logged to console, easy to connect to analytics):

- `experiment_started` - On component mount
- `parameter_changed` - On cell type, solution, or concentration change
- `simulation_started` - When "Start Simulation" is clicked
- `simulation_completed` - When animation finishes
- `experiment_completed` - When animation finishes
- `experiment_reset` - When "Reset" is clicked
- `observation_submitted` - When observation is successfully saved

## Accessibility Features

- All inputs are keyboard accessible with visible focus indicators
- `aria-label` attributes on all interactive elements
- Screen reader description of the cell diagram state
- Semantic HTML structure

## Files Created

- `src/components/OsmosisPlasmolysisLab.tsx` - Main experiment component
- `supabase/migrations/003_osmosis_plasmolysis_runs.sql` - Database migration
- `backend/__tests__/osmosis-plasmolysis.test.ts` - API endpoint test

## Notes

- The component uses a soft, pastel color palette matching the existing design system
- All UI elements are mobile responsive
- The SVG diagram uses gradients and animations for visual appeal
- Water arrows animate during simulation to show active movement
- The component is fully self-contained and can be easily integrated into any route

