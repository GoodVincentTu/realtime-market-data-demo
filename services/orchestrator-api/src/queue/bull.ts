import { Queue } from 'bullmq';
import { config } from '../config.js';

function buildBullConnection(urlStr: string) {
  const u = new URL(urlStr);
  const tls = u.protocol === 'rediss:';
  const db = u.pathname && u.pathname !== '/' ? Number(u.pathname.slice(1)) : undefined;

  const conn: Record<string, unknown> = {
    host: u.hostname,
    port: u.port ? Number(u.port) : (tls ? 6380 : 6379),
  };
  if (u.username) conn.username = u.username;
  if (u.password) conn.password = u.password;
  if (tls) conn.tls = {};
  if (Number.isFinite(db)) conn.db = db;
  return conn;
}

// IMPORTANT: queue name must NOT contain ":"; use prefix for namespacing
export const ticksQueue = new Queue(config.queue.ticksQueue, {
  connection: buildBullConnection(config.redisUrl),
  prefix: config.queue.prefix,
});

// ---- Optional helpers (use only if you want queue-level de-dupe) ----
export type TickJob = {
  symbol: string;
  price: number;
  ts: number;
  source: string;
  volume?: number;
  idKey: string; // may contain ':' from your upstream idempotency key
};

// BullMQ v5 forbids ":" in customId; encode if you pass customId
export function safeCustomId(id: string): string {
  return Buffer.from(id).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Bulk enqueue with sanitized customId (optional) */
export async function enqueueTicks(items: TickJob[]) {
  return ticksQueue.addBulk(
    items.map((it) => ({
      name: 'tick',
      data: it,
      opts: {
        removeOnComplete: true,
        removeOnFail: 100,
        // If you rely ONLY on Redis SADD for idempotency, delete the next line.
        customId: safeCustomId(it.idKey),
      },
    })),
  );
}