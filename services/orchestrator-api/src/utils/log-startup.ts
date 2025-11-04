import { logger } from '../logger.js';
import { config } from '../config.js';
import { dbHealth } from '../db/pool.js';
import { redisHealth } from '../redis/index.js';

const ROUTES: Array<{ method: string; path: string }> = [
  // ops
  { method: 'GET', path: '/health/liveness' },
  { method: 'GET', path: '/health/readiness' },
  { method: 'GET', path: '/ops/metrics' },
  // public
  { method: 'GET', path: '/symbols' },
  { method: 'GET', path: '/ticks/:symbol' },
  { method: 'GET', path: '/ticks/:symbol/history' },
  { method: 'GET', path: '/metrics/:symbol' },
  // webhooks
  { method: 'POST', path: '/webhooks/ticks' },
  { method: 'POST', path: '/webhooks/symbols' }
];

export async function logStartupBanner() {
  const [dbOk, rOk] = await Promise.all([
    dbHealth().catch(() => false),
    redisHealth().catch(() => false)
  ]);

  logger.info({
    env: process.env.NODE_ENV,
    port: config.port,
    apiPrefix: config.apiPrefix,
    database: dbOk ? 'ok' : 'fail',
    redis: rOk ? 'ok' : 'fail'
  }, 'service startup');

  logger.info('available routes:');
  for (const r of ROUTES) {
    logger.info(`${r.method.padEnd(6)} ${config.apiPrefix}${r.path}`);
  }
}