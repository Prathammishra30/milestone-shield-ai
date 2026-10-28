import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';

export function createApp() {
  const app = express();

  // ── Core middleware ──────────────────────────────────
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  // ── Routes ───────────────────────────────────────────
  app.use('/api', healthRouter);

  // ── 404 catch-all ────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ status: 'error', message: 'Not found' });
  });

  // ── Error handler (must be last) ─────────────────────
  app.use(errorHandler);

  return app;
}
