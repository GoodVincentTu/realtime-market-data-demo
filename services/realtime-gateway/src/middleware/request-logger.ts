import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger.js';

export function requestLogger(req: Request, _res: Response, next: NextFunction) {
  logger.info({ method: req.method, url: req.originalUrl }, 'http request');
  next();
}