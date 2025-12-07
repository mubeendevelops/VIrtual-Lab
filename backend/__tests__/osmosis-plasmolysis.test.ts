/**
 * Test file for Osmosis and Plasmolysis experiment API endpoint
 * 
 * This test file POSTs a sample observation to /api/experiments/osmosis-plasmolysis/result
 * and expects a 201 response with correct JSON fields.
 * 
 * To run: npm test (from backend directory)
 */

import request from 'supertest';

// Note: This test assumes a backend server is running
// In a real scenario, you would import your Express app directly
// For this example, we'll use a base URL that can be configured

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

describe('POST /api/experiments/osmosis-plasmolysis/result', () => {
  const sampleObservation = {
    user_id: '33333333-3333-3333-3333-333333333333',
    cell_type: 'Onion epidermal cell',
    external_solution: '5% NaCl (hypertonic)',
    external_concentration: 0.85,
    predicted_state: 'Plasmolysed',
    simulation_duration_sec: 4.0,
    timestamp: '2025-12-07T10:15:00.000Z',
  };

  it('should return 201 and insert valid experiment data', async () => {
    const response = await request(BASE_URL)
      .post('/api/experiments/osmosis-plasmolysis/result')
      .set('Content-Type', 'application/json')
      .set('x-user-id', sampleObservation.user_id)
      .send(sampleObservation);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('user_id');
    expect(response.body).toHaveProperty('cell_type');
    expect(response.body).toHaveProperty('external_solution');
    expect(response.body).toHaveProperty('external_concentration');
    expect(response.body).toHaveProperty('predicted_state');
    expect(response.body).toHaveProperty('simulation_duration_sec');
    expect(response.body).toHaveProperty('created_at');

    // Verify field values
    expect(response.body.cell_type).toBe(sampleObservation.cell_type);
    expect(response.body.external_solution).toBe(sampleObservation.external_solution);
    expect(response.body.external_concentration).toBe(sampleObservation.external_concentration);
    expect(response.body.predicted_state).toBe(sampleObservation.predicted_state);
    expect(response.body.simulation_duration_sec).toBe(sampleObservation.simulation_duration_sec);
  });

  it('should handle different cell states correctly', async () => {
    const turgidObservation = {
      ...sampleObservation,
      external_solution: 'Distilled water (hypotonic)',
      external_concentration: 0.0,
      predicted_state: 'Turgid',
    };

    const response = await request(BASE_URL)
      .post('/api/experiments/osmosis-plasmolysis/result')
      .set('Content-Type', 'application/json')
      .set('x-user-id', turgidObservation.user_id)
      .send(turgidObservation);

    expect(response.status).toBe(201);
    expect(response.body.predicted_state).toBe('Turgid');
  });

  it('should return 400 if required fields are missing', async () => {
    const incompleteData = {
      cell_type: 'Onion epidermal cell',
      // Missing other required fields
    };

    const response = await request(BASE_URL)
      .post('/api/experiments/osmosis-plasmolysis/result')
      .set('Content-Type', 'application/json')
      .send(incompleteData);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should return 400 if predicted_state is invalid', async () => {
    const invalidData = {
      ...sampleObservation,
      predicted_state: 'InvalidState',
    };

    const response = await request(BASE_URL)
      .post('/api/experiments/osmosis-plasmolysis/result')
      .set('Content-Type', 'application/json')
      .send(invalidData);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('predicted_state');
  });

  it('should accept user_id from header', async () => {
    const observationWithoutUserId = {
      cell_type: 'Rhoeo leaf cell',
      external_solution: '0.9% NaCl (isotonic)',
      external_concentration: 0.15,
      predicted_state: 'Flaccid',
      simulation_duration_sec: 3.5,
      timestamp: new Date().toISOString(),
    };

    const headerUserId = 'header-user-123';

    const response = await request(BASE_URL)
      .post('/api/experiments/osmosis-plasmolysis/result')
      .set('Content-Type', 'application/json')
      .set('x-user-id', headerUserId)
      .send(observationWithoutUserId);

    // Should either use header user_id or create one
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('user_id');
  });
});

