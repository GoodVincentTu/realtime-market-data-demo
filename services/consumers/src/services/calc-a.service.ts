import type { MetricsAggRow } from '../repositories/metrics.repo.js';
import { upsertMetrics1mBatch } from '../repositories/metrics.repo.js';

export function bucketStartSec(tsSec: number): number {
  return Math.floor(tsSec / 60) * 60;
}

export async function calcA_applyMetrics(items: { symbol: string; ts: number; price: number; volume?: number }[]) {
  if (!items.length) return;

  const by = new Map<string, MetricsAggRow>();
  for (const t of items) {
    const bucketSec = bucketStartSec(t.ts);
    const k = `${t.symbol}|${bucketSec}`;
    const vol = t.volume ?? 1; // fallback if feeder/webhook didn’t send size
    const cur = by.get(k);

    if (!cur) {
      by.set(k, {
        symbol: t.symbol, bucketSec,
        count: 1,
        sum: t.price,
        min: t.price,
        max: t.price,
        last: t.price,
        lastTs: t.ts,
        volumeSum: vol,
      });
    } else {
      cur.count += 1;
      cur.sum   += t.price;
      cur.min    = Math.min(cur.min, t.price);
      cur.max    = Math.max(cur.max, t.price);
      if (t.ts >= cur.lastTs) { cur.last = t.price; cur.lastTs = t.ts; }
      cur.volumeSum += vol;
    }
  }

  await upsertMetrics1mBatch([...by.values()]);
}