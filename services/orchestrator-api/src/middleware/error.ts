import type { ErrorRequestHandler } from 'express';
import { logger } from '../logger.js';
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const status = (err as any).status ?? 500;
  const code = (err as any).code ?? 'INTERNAL_ERROR';
  logger.error({ err, rid: (req as any).rid }, 'request error');
  res.status(status).json({ error: { code, message: err?.message ?? 'internal error' } });
};