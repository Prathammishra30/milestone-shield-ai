import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateBody, validateQuery } from './validate';
import { errorHandler } from './errorHandler';

function createTestApp() {
  const app = express();
  app.use(express.json());

  // Test route with body validation
  const bodySchema = z.object({
    name: z.string().min(1, 'Name is required'),
    amount: z.number().positive('Amount must be positive'),
  });

  app.post('/test-body', validateBody(bodySchema), (_req, res) => {
    res.json({ status: 'ok', data: _req.body });
  });

  // Test route with query validation
  const querySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  });

  app.get('/test-query', validateQuery(querySchema), (_req, res) => {
    res.json({ status: 'ok', query: _req.query });
  });

  app.use(errorHandler);
  return app;
}

describe('validateBody middleware', () => {
  const app = createTestApp();

  it('passes valid body through', async () => {
    const res = await request(app)
      .post('/test-body')
      .send({ name: 'Test Project', amount: 100 });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Test Project');
    expect(res.body.data.amount).toBe(100);
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/test-body')
      .send({ name: 'Test' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid field types', async () => {
    const res = await request(app)
      .post('/test-body')
      .send({ name: '', amount: -5 });

    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBe(2);
  });

  it('rejects empty body', async () => {
    const res = await request(app)
      .post('/test-body')
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('validateQuery middleware', () => {
  const app = createTestApp();

  it('applies defaults for missing query params', async () => {
    const res = await request(app).get('/test-query');

    expect(res.status).toBe(200);
    expect(res.body.query.page).toBe(1);
    expect(res.body.query.limit).toBe(20);
  });

  it('coerces string query params to numbers', async () => {
    const res = await request(app).get('/test-query?page=3&limit=50');

    expect(res.status).toBe(200);
    expect(res.body.query.page).toBe(3);
    expect(res.body.query.limit).toBe(50);
  });

  it('rejects invalid query params', async () => {
    const res = await request(app).get('/test-query?limit=999');

    expect(res.status).toBe(400);
  });
});
