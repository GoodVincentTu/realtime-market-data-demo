import { dbHealth } from '../db/pool.js';
import { redisHealth } from '../redis/index.js';

export async function readinessSvc() {
  const [dbOk, redisOk] = await Promise.allSettled([dbHealth(), redisHealth()]);
  const checks = {
    db: dbOk.status === 'fulfilled' && dbOk.value ? 'ok' : 'fail',
    redis: redisOk.status === 'fulfilled' && redisOk.value ? 'ok' : 'fail'
  };
  const status = (checks.db === 'ok' && checks.redis === 'ok') ? 'ready' : 'not_ready';
  return { status, checks };
}