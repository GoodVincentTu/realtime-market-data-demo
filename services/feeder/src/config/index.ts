function parseMap(input: string | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!input) return out;
  for (const kv of input.split(',')) {
    const [k, v] = kv.split(':');
    if (!k || v === undefined) continue;
    const num = Number(v);
    if (!Number.isFinite(num)) continue;
    out[k.trim()] = num;
  }
  return out;
}

function toArray(csv?: string): string[] {
  return (csv ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export const cfg = {
  env: process.env.NODE_ENV ?? 'development',

  baseUrl:
    process.env.ORCHESTRATOR_BASE_URL ??
    process.env.ORCH_API_BASE ??
    'http://localhost:3030/api/v1',
  apiKey: process.env.ORCHESTRATOR_API_KEY ?? process.env.ORCH_API_KEY ?? 'demo-key',

  source: process.env.FEEDER_SOURCE_NAME ?? 'feeder-sim',

  symbols: toArray(process.env.SYMBOLS ?? process.env.FEED_SYMBOLS).length
    ? toArray(process.env.SYMBOLS ?? process.env.FEED_SYMBOLS)
    : ['BTCUSDT', 'ETHUSDT', 'XAUUSD'],

  rps: (() => {
    const explicit = Number(process.env.RPS ?? '');
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const intervalMs = Number(process.env.FEED_INTERVAL_MS ?? '');
    if (Number.isFinite(intervalMs) && intervalMs > 0) {
      return Math.max(0.1, 1000 / intervalMs);
    }
    return 20;
  })(),
  batchSize: Math.max(1, Number(process.env.BATCH_SIZE ?? 50)),
  flushMs: Math.max(50, Number(process.env.FLUSH_MS ?? 250)),
  jitter: Math.max(0, Math.min(1, Number(process.env.JITTER ?? 0.2))),

  priceSeed: process.env.PRICE_SEED ?? 'auto',
  priceBase: parseMap(process.env.PRICE_BASE),
  vol: parseMap(process.env.VOLATILITY),

  timeoutMs: Math.max(1000, Number(process.env.TIMEOUT_MS ?? 8000)),
  retry: Math.max(0, Number(process.env.RETRY ?? 3)),
  retryBaseMs: Math.max(50, Number(process.env.RETRY_BASE_MS ?? 150)),

  metricsPort: (() => {
    const raw = process.env.METRICS_PORT;
    const val = Number(raw);
    return Number.isFinite(val) ? val : 0;
  })(),
  opsPort: (() => {
    const raw = process.env.OPS_PORT ?? process.env.PORT;
    const val = Number(raw);
    return Number.isFinite(val) ? val : 0;
  })(),
} as const;
