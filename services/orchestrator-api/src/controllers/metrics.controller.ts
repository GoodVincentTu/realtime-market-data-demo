import type { Request, Response } from 'express';
import { registry } from '../metrics/metrics.js';
export async function promMetrics(_req: Request, res: Response) {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
}