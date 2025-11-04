import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { requestLogger } from './middleware/request-logger.js';
import { healthRoutes } from './routes/health.routes.js';
import { realtimeRoutes } from './routes/realtime.routes.js';
import { opsRoutes } from './routes/ops.routes.js';
import { cfg } from './config.js';

export function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  const corsOrigins =
    cfg.cors.origins === '*'
      ? '*'
      : cfg.cors.origins && cfg.cors.origins.length
        ? cfg.cors.origins
        : true;
  app.use(cors({ origin: corsOrigins, credentials: false }));
  app.use(express.json({ limit: '64kb' }));
  app.use(requestLogger);

  // Attach routes
  healthRoutes(app);
  realtimeRoutes(app);
  opsRoutes(app);

  return app;
}
