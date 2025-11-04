// src/queue/batcher.ts
import { cfg } from '../config/index.js';
import { consumerBatches, consumerBatchSize } from '../metrics/metrics.js';

import { insertTicksHistoryAndRecent, insertTicksRawBatch } from '../repositories/ticks.repo.js';
import { calcA_applyMetrics } from '../services/calc-a.service.js';
import { calcB_applyOhlc } from '../services/calc-b.service.js';
import { publishTicksLatest } from '../redis/pub.js';

export type Tick = { symbol: string; price: number; ts: number; idKey?: string; source?: string; volume?: number };

type Pending = { items: Tick[]; resolvers: Array<(v: void) => void> };
const state: Pending = { items: [], resolvers: [] };

let timer: NodeJS.Timeout | null = null;

export async function flushBatchNow(): Promise<void> {
  const items = state.items;
  const resolvers = state.resolvers;
  state.items = [];
  state.resolvers = [];
  if (timer) { clearTimeout(timer); timer = null; }

  if (items.length === 0) { resolvers.forEach(r => r()); return; }

  consumerBatchSize.set(items.length);

  // 1) raw audit (optional) – write to ticks_raw using idKey/source if present
  await insertTicksRawBatch(items);

  // 2) history (with volume de-dupe/aggregation per (symbol, ts))
  await insertTicksHistoryAndRecent(items);

  // 2) aggregated minute metrics + OHLC (both aggregated per key in memory)
  await calcA_applyMetrics(items);
  await calcB_applyOhlc(items);

  // 3) publish only latest per symbol to Redis Pub/Sub
  await publishTicksLatest(items);

  consumerBatches.inc();
  resolvers.forEach(r => r());
}

function armTimer() {
  if (timer) return;
  timer = setTimeout(() => { void flushBatchNow(); }, cfg.batch.flushMs).unref();
}

export function addToBatch(items: Tick[]): Promise<void> {
  return new Promise<void>((resolve) => {
    state.items.push(...items);
    state.resolvers.push(resolve);
    if (state.items.length >= cfg.batch.max) void flushBatchNow();
    else armTimer();
  });
}