import client from 'prom-client';
export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const httpReqDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'code'],
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2000, 5000]
});
registry.registerMetric(httpReqDuration);

export const ingestAccepted   = new client.Counter({ name: 'ingest_accepted',   help: 'accepted webhook items' });
export const ingestDuplicates = new client.Counter({ name: 'ingest_duplicates', help: 'duplicate webhook items' });
export const ingestQueued     = new client.Counter({ name: 'ingest_queued',     help: 'queued items' });
registry.registerMetric(ingestAccepted);
registry.registerMetric(ingestDuplicates);
registry.registerMetric(ingestQueued);