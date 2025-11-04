import { buildApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { pg } from './db/pool.js';
import { redis, redisPub } from './redis/index.js';
import { logStartupBanner } from './utils/log-startup.js';

const app = buildApp();
const server = app.listen(config.port, () => {
  logger.info({ port: config.port, prefix: config.apiPrefix }, 'orchestrator-api listening');
  // Print routes + health after listener is ready
  void logStartupBanner();
});

// ---- global process error traps ----
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
  shutdown(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection');
  shutdown(1);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

let closing = false;
async function shutdown(code: number) {
  if (closing) return;
  closing = true;
  logger.info('shutting down...');
  server.close(async () => {
    await Promise.allSettled([pg.end(), redis.quit(), redisPub.quit()]);
    logger.info('bye');
    process.exit(code);
  });
}