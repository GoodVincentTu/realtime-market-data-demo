import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
export function requestId(req: Request, res: Response, next: NextFunction) {
  const rid = req.header('x-request-id') || randomUUID();
  (req as any).rid = rid;
  res.setHeader('x-request-id', rid);
  next();
}