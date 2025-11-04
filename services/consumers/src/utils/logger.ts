import pino from 'pino';
import { cfg } from '../config/index.js';
export const logger = pino(
  cfg.logPretty
    ? { level: cfg.logLevel, transport: { target: 'pino-pretty', options: { colorize: true } } }
    : { level: cfg.logLevel }
);