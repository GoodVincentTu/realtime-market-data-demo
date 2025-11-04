import { Counter, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const sseConnections = new Gauge({
  name: 'gateway_sse_connections',
  help: 'Active SSE connections',
  registers: [registry],
});

export const sseEventsSent = new Counter({
  name: 'gateway_sse_events_sent_total',
  help: 'Total SSE events delivered',
  registers: [registry],
});

export const sseEventsDropped = new Counter({
  name: 'gateway_sse_events_dropped_total',
  help: 'Events dropped due to backpressure/client closed',
  registers: [registry],
});