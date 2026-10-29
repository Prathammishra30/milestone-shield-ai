import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { securityHeadersMiddleware } from './middleware/securityHeaders';
import { apiLimiter, authLimiter } from './middleware/rateLimiter';
import healthRouter from './routes/health';
import paypalRouter from './routes/paypal';
import contractsRouter from './routes/contracts';
import usersRouter from './routes/users';
import webhooksRouter from './routes/webhooks';

export function createApp() {
  const app = express();

  // ── Reverse Proxy Trust Configuration ─────────────────
  // Enable forwarded header parsing only when running behind trusted reverse proxies
  if (env.TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  // ── Security Headers ──────────────────────────────────
  app.use(securityHeadersMiddleware);

  // ── Core middleware ──────────────────────────────────
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );

  // ── Global API Rate Limiter ──────────────────────────
  app.use('/api', apiLimiter);

  // ── Routes ───────────────────────────────────────────
  // Public endpoints (no user JWT authentication)
  app.use('/api', healthRouter);
  app.use('/api', webhooksRouter);

  // Authenticated endpoints (require valid user JWT session)
  app.use('/api', authLimiter, usersRouter);
  app.use('/api', contractsRouter);
  app.use('/api', paypalRouter);

  // ── 404 catch-all ────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ status: 'error', message: 'Not found' });
  });

  // ── Error handler (must be last) ─────────────────────
  app.use(errorHandler);

  return app;
}
