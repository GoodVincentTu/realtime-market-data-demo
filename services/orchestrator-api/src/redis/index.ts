import { Redis } from 'ioredis';
import { config } from '../config.js';

/**
 * Create Redis clients from URL; ioredis parses protocol (redis/rediss),
 * auth, db index, etc. We also disable maxRetriesPerRequest to avoid
 * unhandled promise rejections in sudden network blips.
 */
export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
export const redisPub = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

export async function redisHealth() {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}