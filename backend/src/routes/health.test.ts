import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('GET /api/health', () => {
  it('returns 200 with healthy status', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('milestone-shield-ai');
    expect(res.body.version).toBe('0.1.0');
  });

  it('includes timestamp in ISO format', async () => {
    const res = await request(app).get('/api/health');

    expect(res.body.timestamp).toBeDefined();
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });

  it('includes uptime as a positive number', async () => {
    const res = await request(app).get('/api/health');

    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThan(0);
  });

  it('includes environment field', async () => {
    const res = await request(app).get('/api/health');

    expect(res.body.environment).toBeDefined();
    expect(['development', 'test', 'production']).toContain(res.body.environment);
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toBe('Not found');
  });
});

describe('CORS', () => {
  it('includes CORS headers in response', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
