import type { Request, Response } from 'express';
import { readinessSvc } from '../services/health.service.js';

export async function liveness(_req: Request, res: Response) {
  res.json({ ok: true });
}

export async function readiness(_req: Request, res: Response) {
  const result = await readinessSvc();
  res.json(result);
}