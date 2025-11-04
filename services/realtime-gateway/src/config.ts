import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().default(3200),
  API_PREFIX: z.string().default('/'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  PUBSUB_CHANNEL: z.string().default('ch:ticks'),
  ALLOW_ORIGINS: z.string().optional(),
  CORS_ALLOW_ORIGINS: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal','error','warn','info','debug','trace','silent']).default('info'),
  LOG_PRETTY: z.union([z.literal('1'), z.literal('0')]).default('1'),
  SSE_KEEPALIVE_MS: z.coerce.number().default(15000),
  SSE_CLIENT_BUFFER: z.coerce.number().default(100)
});

const e = Env.parse(process.env);

function parseOrigins(value?: string) {
  if (!value) return undefined;
  if (value.trim() === '*') return '*';
  const list = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

export const cfg = {
  env: e.NODE_ENV,
  port: e.PORT,
  apiPrefix: e.API_PREFIX === '/' ? '' : e.API_PREFIX.replace(/\/$/, ''),
  redisUrl: e.REDIS_URL,
  pubsubChannel: e.PUBSUB_CHANNEL,
  logLevel: e.LOG_LEVEL,
  logPretty: e.LOG_PRETTY === '1',
  cors: {
    origins: parseOrigins(e.ALLOW_ORIGINS ?? e.CORS_ALLOW_ORIGINS),
  },
  sse: {
    keepaliveMs: e.SSE_KEEPALIVE_MS,
    clientBuffer: e.SSE_CLIENT_BUFFER
  }
} as const;
