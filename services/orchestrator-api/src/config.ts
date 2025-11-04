// services/orchestrator-api/src/config.ts
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3030),
  API_PREFIX: z.string().default('/api/v1'),

  DATABASE_URL: z.string().optional(),
  PGHOST: z.string().optional(),
  PGPORT: z.coerce.number().optional(),
  PGDATABASE: z.string().optional(),
  PGUSER: z.string().optional(),
  PGPASSWORD: z.string().optional(),

  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().optional(),
  REDIS_PASSWORD: z.string().optional(),

  API_KEY: z.string().default('dev-key'),
  API_KEYS: z.string().optional(),
  CORS_ALLOW_ORIGINS: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal','error','warn','info','debug','trace','silent']).default('info'),
  LOG_PRETTY: z.union([z.literal('1'), z.literal('0')]).default('1'),

  // NEW — queue/pubsub
  QUEUE_PREFIX: z.string().default('realtime'),
  TICKS_QUEUE: z.string().default('ticks'),
  PUBSUB_CHANNEL: z.string().default('ch:ticks'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten());
  process.exit(1);
}
const e = parsed.data;

function firstNonEmpty(csv?: string) {
  if (!csv) return undefined;
  const parts = csv
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[0];
}

function buildPgUrl() {
  if (e.DATABASE_URL) return e.DATABASE_URL;
  if (e.PGHOST && e.PGUSER && e.PGDATABASE) {
    const pw = e.PGPASSWORD ? `:${encodeURIComponent(e.PGPASSWORD)}` : '';
    const host = encodeURIComponent(e.PGHOST);
    const port = e.PGPORT ? `:${e.PGPORT}` : '';
    return `postgres://${encodeURIComponent(e.PGUSER)}${pw}@${host}${port}/${encodeURIComponent(e.PGDATABASE)}`;
  }
  return undefined;
}

function buildRedisUrl() {
  if (e.REDIS_URL) return e.REDIS_URL;
  if (e.REDIS_HOST) {
    const port = e.REDIS_PORT ?? 6379;
    const auth = e.REDIS_PASSWORD ? `:${encodeURIComponent(e.REDIS_PASSWORD)}@` : '';
    return `redis://${auth}${e.REDIS_HOST}:${port}`;
  }
  return 'redis://127.0.0.1:6379';
}

function parseCorsOrigins(value?: string) {
  if (!value) return undefined;
  if (value.trim() === '*') return '*';
  const origins = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return origins.length ? origins : undefined;
}

const resolvedApiKey = firstNonEmpty(e.API_KEYS) ?? e.API_KEY;
const corsOrigins = parseCorsOrigins(e.CORS_ALLOW_ORIGINS);

export const config = {
  env: e.NODE_ENV,
  port: e.PORT,
  apiPrefix: e.API_PREFIX,

  databaseUrl: buildPgUrl(),
  redisUrl: buildRedisUrl(),

  apiKey: resolvedApiKey,
  logLevel: e.LOG_LEVEL,
  logPretty: e.LOG_PRETTY === '1',
  cors: {
    origins: corsOrigins,
  },

  // NEW
  queue: {
    prefix: e.QUEUE_PREFIX,          // BullMQ key prefix
    ticksQueue: e.TICKS_QUEUE,       // queue name
    pubsubChannel: e.PUBSUB_CHANNEL, // Redis channel for realtime tick fanout
  },
} as const;
