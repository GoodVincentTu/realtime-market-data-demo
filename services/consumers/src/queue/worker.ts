import { Worker, QueueEvents } from 'bullmq';
import { cfg } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { addToBatch, type Tick } from './batcher.js';
import { getBullConnection } from '../redis/index.js';

export function startWorker() {
  // IMPORTANT: queueName has NO colon; namespacing via `prefix`
  const queueName = cfg.ticksQueue;
  const connection = getBullConnection();

  const worker = new Worker<Tick | Tick[]>(
    queueName,
    async (job) => {
      const items = Array.isArray(job.data) ? job.data : [job.data];
      await addToBatch(items);
    },
    {
      connection,
      concurrency: cfg.workerConcurrency,
      // optional: give a bit more time to avoid false stalls under heavy load
      lockDuration: 30000,
      prefix: cfg.queuePrefix,
    }
  );

  worker.on('completed', (job) => logger.debug({ id: job.id }, '[worker] completed'));
  worker.on('failed', (job, err) => logger.error({ id: job?.id, err }, '[worker] failed'));

  const qevents = new QueueEvents(queueName, {
    connection,
    prefix: cfg.queuePrefix,
  });
  qevents.on('error', (e) => logger.error({ err: e }, '[queueEvents] error'));

  return worker;
}