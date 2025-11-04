import { cfg } from './config/index.js';
import { logger } from './utils/logger.js';
import { generatedTicks } from './metrics/metrics.js';
import { startOpsServer } from './server/ops.js';
import { postTicksBatch } from './http/client.js';
import { upsertSymbolsOnce } from './bootstrap.js';

type PriceState = { s: string; p: number };
type Item = { symbol: string; price: number; ts: number; idempotencyKey: string, volume: number };

const state: Record<string, PriceState> = {};
let running = true;
let buffer: Item[] = [];
let seqPerSecond = 0;
let lastTsSec = Math.floor(Date.now() / 1000);

// servers to close on shutdown
let metricsServer: any | undefined;
let opsServer: any | undefined;

// ---- price model (geometric random walk) ----
function stepPrice(symbol: string): number {
  const vol = cfg.vol[symbol] ?? 0.001; // small per-tick volatility
  const u = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
  const next = (state[symbol].p ?? 1) * Math.exp(vol * z);
  state[symbol].p = Math.max(0.0000001, next);
  return state[symbol].p;
}

function idKey(source: string, symbol: string, tsSec: number, seq: number) {
  return `${source}:${symbol}:${tsSec}:${seq}`;
}

async function flush() {
  if (!buffer.length) return;
  const toSend = buffer;
  buffer = [];
  try {
    await postTicksBatch(toSend);
  } catch (e) {
    logger.error({ err: e }, 'postTicksBatch failed; requeueing current batch');
    // naive retry-once: push back to buffer tail (keeps order-best-effort)
    buffer.push(...toSend);
  }
}

function schedulePacer() {
  if (!running) return;

  const baseIntervalMs = 1000 / Math.max(1, cfg.rps);
  const jitterFactor = 1 + (Math.random() * 2 - 1) * cfg.jitter; // [1-j, 1+j]
  const interval = Math.max(1, Math.floor(baseIntervalMs * jitterFactor));

  setTimeout(() => {
    if (!running) return;

    // uniform pick
    const symbol = cfg.symbols[(Math.random() * cfg.symbols.length) | 0];

    const tsSec = Math.floor(Date.now() / 1000);
    seqPerSecond = tsSec === lastTsSec ? seqPerSecond + 1 : 0;
    lastTsSec = tsSec;

    const price = stepPrice(symbol);
    generatedTicks.inc();

    buffer.push({
      symbol,
      price: Number(price.toFixed(2)),
      ts: tsSec,
      volume: Number((Math.random() * 0.5 + 0.1).toFixed(4)),
      idempotencyKey: idKey(cfg.source, symbol, tsSec, seqPerSecond),
    });

    // batch thresholds
    if (buffer.length >= cfg.batchSize) {
      void flush(); // don’t await to keep cadence smooth
    }

    schedulePacer();
  }, interval);
}

const flusher = setInterval(() => void flush(), cfg.flushMs).unref();

async function shutdown(sig: string) {
  if (!running) return;
  running = false;
  clearInterval(flusher);
  try {
    await flush();
  } catch (e) {
    logger.error({ err: e }, 'flush on shutdown failed');
  }
  await new Promise<void>((r) => (metricsServer as any)?.close?.(() => r()) ?? r());
  await new Promise<void>((r) => (opsServer as any)?.close?.(() => r()) ?? r());
  logger.info({ sig }, 'feeder stopped');
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

async function main() {
  // seed initial prices
  for (const s of cfg.symbols) {
    const base =
      cfg.priceBase[s] ??
      (s.includes('BTC') ? 68_000 : s.includes('ETH') ? 3_200 : 2_000);
    state[s] = { s, p: base };
  }

  // upsert symbols once so /symbols & UI aren’t empty
  try {
    await upsertSymbolsOnce();
  } catch (e) {
    logger.warn({ err: e }, 'symbol upsert skipped');
  }

  // start ops/metrics servers if enabled
  if (cfg.metricsPort > 0) {
    metricsServer = startOpsServer(cfg.metricsPort);
  }
  if (cfg.opsPort > 0) {
    opsServer = startOpsServer(cfg.opsPort);
  }

  logger.info(
    {
      baseUrl: cfg.baseUrl,
      symbols: cfg.symbols,
      rps: cfg.rps,
      batch: cfg.batchSize,
      flushMs: cfg.flushMs,
      jitter: cfg.jitter,
      source: cfg.source,
    },
    'feeder starting'
  );

  // kick off pacer loop
  schedulePacer();
}

main().catch((e) => {
  logger.error({ err: e }, 'feeder fatal');
  process.exit(1);
});
