// src/config/index.ts
import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().default(4100),

  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

  QUEUE_PREFIX: z.string().default('realtime'),
  TICKS_QUEUE: z.string().default('ticks'),
  PUBSUB_CHANNEL: z.string().default('ch:ticks'),

  LOG_LEVEL: z.enum(['fatal','error','warn','info','debug','trace','silent']).default('info'),
  LOG_PRETTY: z.union([z.literal('1'), z.literal('0')]).default('1'),

  // batching + worker
  BATCH_MAX: z.coerce.number().default(500),
  BATCH_FLUSH_MS: z.coerce.number().default(200),
  WORKER_CONCURRENCY: z.coerce.number().default(8),
});

const e = Env.parse(process.env);

export const cfg = {
  env: e.NODE_ENV,
  port: e.PORT,

  databaseUrl: e.DATABASE_URL,
  redisUrl: e.REDIS_URL,

  queuePrefix: e.QUEUE_PREFIX,
  ticksQueue: e.TICKS_QUEUE,
  pubsubChannel: e.PUBSUB_CHANNEL,

  logLevel: e.LOG_LEVEL,
  logPretty: e.LOG_PRETTY === '1',

  batch: { max: e.BATCH_MAX, flushMs: e.BATCH_FLUSH_MS },
  workerConcurrency: e.WORKER_CONCURRENCY,
} as const;