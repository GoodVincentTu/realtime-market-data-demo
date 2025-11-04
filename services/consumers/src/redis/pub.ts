import { getPublisher } from './index.js';
import { cfg } from '../config/index.js';

export async function publishTicksLatest(items: { symbol:string; ts:number; price:number }[]) {
  if (!items.length) return;
  const ch = cfg.pubsubChannel;

  // keep only the latest per symbol
  const latest = new Map<string, { symbol:string; ts:number; price:number }>();
  for (const t of items) {
    const cur = latest.get(t.symbol);
    if (!cur || t.ts >= cur.ts) latest.set(t.symbol, t);
  }

  const pub = getPublisher();
  for (const v of latest.values()) {
    await pub.publish(ch, JSON.stringify(v));
  }
}