import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/health
 * Returns service health status, uptime, and environment.
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'milestone-shield-ai',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV ?? 'development',
  });
});

export default router;
