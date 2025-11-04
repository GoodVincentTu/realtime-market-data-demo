import * as IORedis from 'ioredis';
import { cfg } from './config.js';
import { logger } from './logger.js';

// Work with both CJS and ESM builds of ioredis without tsconfig tweaks.
const RedisCtor: any = (IORedis as any).default ?? (IORedis as any);

export const redisSub = new RedisCtor(cfg.redisUrl, { maxRetriesPerRequest: null });

redisSub.on('error', (e: unknown) => logger.error({ err: e }, 'redisSub error'));
redisSub.on('connect', () => logger.info('redisSub connected'));
redisSub.on('reconnecting', () => logger.warn('redisSub reconnecting'));

export async function subscribe(channel: string, handler: (msg: string) => void) {
  await redisSub.subscribe(channel);
  redisSub.on('message', (ch: string, msg: string) => {
    if (ch === channel) handler(msg);
  });
}

export async function redisHealth(): Promise<boolean> {
  try {
    const pong = await redisSub.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}