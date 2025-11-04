import type { Router } from 'express';
import { redisHealth } from '../redis.js';

export function healthRoutes(r: Router) {
  r.get('/health/liveness', (_req, res) => res.json({ ok: true }));
  r.get('/health/readiness', async (_req, res) => {
    const rOk = await redisHealth().catch(() => false);
    const status = rOk ? 'ready' : 'not_ready';
    const code = rOk ? 200 : 503;
    res.status(code).json({ status, checks: { redis: rOk ? 'ok' : 'fail' } });
  });
}