import { buildApp } from './app.js';
import { cfg } from './config.js';
import { logger } from './logger.js';
import { subscribe } from './redis.js';
import { broadcastTick } from './sse/clients.js';

async function main() {
  // Subscribe to Redis Pub/Sub and fan out to clients
  await subscribe(cfg.pubsubChannel, broadcastTick);

  const app = buildApp();
  const server = app.listen(cfg.port, () => {
    logger.info({
      env: cfg.env,
      port: cfg.port,
      pubsubChannel: cfg.pubsubChannel
    }, 'realtime-gateway listening');
    logger.info('GET /health/liveness');
    logger.info('GET /health/readiness');
    logger.info('GET /realtime/ticks?symbol=BTCUSDT');
    logger.info('GET /ops/metrics');
  });

  // Graceful shutdown
  const shutdown = (sig: string) => async () => {
    logger.warn({ sig }, 'shutting down');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('fatal:', e);
  process.exit(1);
});