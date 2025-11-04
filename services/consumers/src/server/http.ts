import http from 'node:http';
import { logger } from '../utils/logger.js';
import { pool } from '../db/pool.js';
import { getRedis } from '../redis/index.js';

export function startOpsServer(port: number) {
  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url) {
        res.statusCode = 400;
        res.end('bad request');
        return;
      }
      if (req.url === '/ops/health/liveness') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (req.url === '/ops/health/readiness') {
        const checks: Record<string, 'ok' | 'fail'> = { redis: 'ok', db: 'ok' };
        // Redis check
        try {
          await getRedis().ping();
        } catch {
          checks.redis = 'fail';
        }
        // DB check
        try {
          await pool.query('select 1');
        } catch {
          checks.db = 'fail';
        }
        const status = Object.values(checks).every((v) => v === 'ok') ? 'ready' : 'not_ready';
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ status, checks }));
        return;
      }

      // default 404
      res.statusCode = 404;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'unknown path' } }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: { code: 'INTERNAL', message: 'unexpected error' } }));
    }
  });

  server.listen(port, () => {
    logger.info({ port }, 'ops server listening');
  });

  return server;
}