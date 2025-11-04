import type { Router } from 'express';
import { registry } from '../metrics/metrics.js';

export function opsRoutes(r: Router) {
  r.get('/ops/metrics', async (_req, res) => {
    res.setHeader('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });
}