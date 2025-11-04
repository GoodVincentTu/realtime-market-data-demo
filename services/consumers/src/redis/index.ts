import { Redis } from 'ioredis';
import { cfg } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Single shared client (for BullMQ connection, general commands),
// and dedicated dupes for pub/sub
let primary: Redis | null = null;
let publisher: Redis | null = null;
let subscriber: Redis | null = null;

function attachLoggers(client: Redis, label: string) {
  client.on('connect',    () => logger.info({ label }, 'redis connect'));
  client.on('ready',      () => logger.info({ label }, 'redis ready'));
  client.on('reconnecting', (delay: number) => logger.warn({ label, delay }, 'redis reconnecting'));
  client.on('end',        () => logger.warn({ label }, 'redis end'));
  client.on('close',      () => logger.warn({ label }, 'redis close'));
  client.on('error',      (err) => logger.error({ label, err }, 'redis error'));
}

export function getRedis(): Redis {
  if (!primary) {
    primary = new Redis(cfg.redisUrl, {
      maxRetriesPerRequest: null,
      enableAutoPipelining: true,
      lazyConnect: false,
    });
    attachLoggers(primary, 'primary');
  }
  return primary;
}

// BullMQ accepts an ioredis instance as "connection"
export function getBullConnection(): Redis {
  return getRedis();
}

export function getPublisher(): Redis {
  if (!publisher) {
    publisher = getRedis().duplicate();
    attachLoggers(publisher, 'publisher');
  }
  return publisher;
}

export function getSubscriber(): Redis {
  if (!subscriber) {
    subscriber = getRedis().duplicate();
    attachLoggers(subscriber, 'subscriber');
  }
  return subscriber;
}

export async function shutdownRedis(): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  if (subscriber) { tasks.push(subscriber.quit().catch(() => subscriber!.disconnect())); subscriber = null; }
  if (publisher)  { tasks.push(publisher.quit().catch(() => publisher!.disconnect()));  publisher  = null; }
  if (primary)    { tasks.push(primary.quit().catch(() => primary!.disconnect()));      primary    = null; }
  await Promise.all(tasks);
}
