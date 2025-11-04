import { Registry, collectDefaultMetrics, Counter, Gauge } from 'prom-client';
export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const consumerBatches = new Counter({ name: 'consumer_batches_total', help: 'Processed batches', registers: [registry] });
export const consumerBatchSize = new Gauge({ name: 'consumer_batch_size', help: 'Last batch size', registers: [registry] });