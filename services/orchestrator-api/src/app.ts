// services/orchestrator-api/src/app.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import swaggerUi from 'swagger-ui-express';
import { requestId } from './middleware/request-id.js';
import { errorHandler } from './middleware/error.js';
import { apiRouter } from './routes/index.js';
import { config } from './config.js';
import { maybeApiKey } from './middleware/auth.js';
import { logger } from './logger.js';

// ---- robust pino-http import under ESM ----
import * as pinoHttpNS from 'pino-http';
const pinoHttpFactory: any =
  // support both CJS and ESM shapes
  (pinoHttpNS as any).default ?? (pinoHttpNS as any);

export function buildApp() {
  const app = express();

  app.use(helmet());
  const configuredOrigins =
    config.cors.origins === '*'
      ? '*'
      : config.cors.origins && config.cors.origins.length
        ? config.cors.origins
        : true;
  app.use(cors({ origin: configuredOrigins, credentials: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);

  if (process.env.NODE_ENV !== 'production') {
    // dev-friendly HTTP logs
    app.use(
      pinoHttpFactory({
        logger,
        autoLogging: true
      })
    );

    // ---- Swagger UI in development (mounted at /docs) ----
    const candidates = [
      path.resolve('src/openapi/openapi.yaml'),
      path.resolve('dist/openapi/openapi.yaml')
    ];
    const found = candidates.find((p) => fs.existsSync(p));
    if (found) {
      try {
        const raw = fs.readFileSync(found, 'utf8');
        const doc = YAML.parse(raw);
        app.get('/docs.json', (_req, res) => res.json(doc));
        app.use('/docs', swaggerUi.serve, swaggerUi.setup(doc));
        // eslint-disable-next-line no-console
        console.log(`[swagger] UI mounted at /docs (spec: ${found})`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[swagger] failed to parse openapi:', e);
      }
    } else {
      // eslint-disable-next-line no-console
      console.warn('[swagger] openapi file not found, skipping UI');
    }
  }

  // ---- API subtree; auth only applies here (webhooks etc.) ----
  app.use(config.apiPrefix, maybeApiKey, apiRouter());

  // Global error handler
  app.use(errorHandler);

  return app;
}
