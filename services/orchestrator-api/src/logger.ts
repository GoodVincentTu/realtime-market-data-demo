import pino from 'pino';

const pretty = process.env.LOG_PRETTY === '1';
export const logger = pino(
  pretty
    ? { level: process.env.LOG_LEVEL || 'info',
        transport: { target: 'pino-pretty', options: { colorize: true } } }
    : { level: process.env.LOG_LEVEL || 'info' }
);