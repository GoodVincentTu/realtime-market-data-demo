// src/services/calc-b.service.ts
import type { OhlcAggRow } from '../repositories/ohlc.repo.js';
import { upsertOhlc1mBatch } from '../repositories/ohlc.repo.js';

export function bucketStartSec(tsSec: number): number {
  return Math.floor(tsSec / 60) * 60;
}

export async function calcB_applyOhlc(items: { symbol: string; ts: number; price: number }[]) {
  if (!items.length) return;

  // Aggregate one OHLC row per (symbol, bucketSec)
  const byKey = new Map<string, OhlcAggRow>();

  for (const t of items) {
    const bucketSec = bucketStartSec(t.ts);
    const k = `${t.symbol}|${bucketSec}`;
    const cur = byKey.get(k);
    if (!cur) {
      byKey.set(k, {
        symbol: t.symbol,
        bucketSec,
        open: t.price,
        openTs: t.ts,
        high: t.price,
        low: t.price,
        close: t.price,
        closeTs: t.ts,
        count: 1,
      });
    } else {
      // open = earliest ts
      if (t.ts < cur.openTs) {
        cur.open = t.price;
        cur.openTs = t.ts;
      }
      // close = latest ts
      if (t.ts >= cur.closeTs) {
        cur.close = t.price;
        cur.closeTs = t.ts;
      }
      cur.high = Math.max(cur.high, t.price);
      cur.low = Math.min(cur.low, t.price);
      cur.count += 1;
    }
  }

  await upsertOhlc1mBatch([...byKey.values()]);
}