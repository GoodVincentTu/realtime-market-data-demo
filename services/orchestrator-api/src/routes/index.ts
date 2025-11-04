import { Router, type Request, type Response, type NextFunction } from 'express';
import { httpReqDuration } from '../metrics/metrics.js';
import { ops } from './ops.routes.js';
import { pub } from './public.routes.js';
import { webhooks } from './webhooks.routes.js';

export function apiRouter() {
  const r = Router();
  r.use((req: Request, res: Response, next: NextFunction) => {
    const end = httpReqDuration.startTimer({ method: req.method, route: req.path });
    res.on('finish', () => end({ code: String(res.statusCode) }));
    next();
  });
  r.use(ops);
  r.use(pub);
  r.use(webhooks);
  r.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'route' } }));
  return r;
}