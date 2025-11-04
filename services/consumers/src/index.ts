import { startWorker } from './queue/worker.js';
import { flushBatchNow } from './queue/batcher.js';
import { shutdownRedis, getRedis } from './redis/index.js';
import { pool } from './db/pool.js';
import { logger } from './utils/logger.js';
import { cfg } from './config/index.js';
import { startOpsServer } from './server/http.js';

const worker = startWorker();

// Optionally start a tiny ops server for liveness/readiness if OPS_PORT is set
const opsPort = Number(process.env.OPS_PORT || 0);
const opsServer = opsPort ? startOpsServer(opsPort) : null;

logger.info(
  {
    env: cfg.env,
    queue: cfg.ticksQueue,
    prefix: cfg.queuePrefix,
    opsPort: opsPort || undefined,
  },
  'consumers service started'
);

async function drainInMemoryBatch() {
  try {
    await flushBatchNow();
  } catch (e) {
    logger.error({ e }, 'failed draining in-memory batch');
  }
}

async function shutdown(sig: string) {
  logger.warn({ sig }, 'consumers shutting down');
  try {
    await drainInMemoryBatch();
    await worker.close(); // stop fetching new jobs
  } catch (e) {
    logger.error({ e }, 'error closing worker');
  }

  if (opsServer) {
    await new Promise<void>((res) => opsServer.close(() => res()));
  }

  // Close Redis & PG
  try {
    await shutdownRedis();
  } catch (e) {
    logger.error({ e }, 'error shutting down redis');
  }
  try {
    await pool.end();
  } catch (e) {
    logger.error({ e }, 'error closing pg pool');
  }

  logger.info('bye');
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// Optional: early readiness warmup (touch Redis once)
getRedis().ping().catch((e) => logger.warn({ e }, 'redis ping on boot failed'));