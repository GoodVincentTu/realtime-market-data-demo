import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

// Only enforce API key for sensitive endpoints (webhooks/admin).
// Public GETs (health, symbols, ticks, metrics) are open.
export function maybeApiKey(req: Request, res: Response, next: NextFunction) {
  const url = req.originalUrl || req.url;

  // Open endpoints (no auth)
  const openMatchers = [
    /^\/docs(?:\/.*)?$/,               // swagger UI
    /^\/docs\.json$/,                  // swagger spec
    new RegExp(`^${config.apiPrefix}/health/`),
    new RegExp(`^${config.apiPrefix}/symbols$`),
    new RegExp(`^${config.apiPrefix}/ticks\\/`),
    new RegExp(`^${config.apiPrefix}/metrics\\/`)
  ];
  if (openMatchers.some(rx => rx.test(url))) return next();

  // Require API key for webhooks (write path)
  const needsKey =
    req.method === 'POST' &&
    url.startsWith(`${config.apiPrefix}/webhooks/`);

  if (!needsKey) return next();

  const headerKey = req.header('x-api-key');
  if (!headerKey || headerKey !== (config.apiKey || 'dev-key')) {
    return res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'invalid or missing x-api-key' }
    });
  }
  return next();
}