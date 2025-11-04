import type { WebhookTickItem, SymbolRow } from '../types/domain.js';
import { redis, redisPub } from '../redis/index.js';
import { enqueueTicks, type TickJob } from '../queue/bull.js';
import { config } from '../config.js';
import { upsertSymbols } from '../repositories/symbols.repo.js';

function dayKey(epochSec: number) {
  const d = new Date(epochSec * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function ingestTicksSvc(source: string, items: WebhookTickItem[]) {
  let accepted = 0, duplicates = 0, queued = 0, rejected = 0, skipped = 0;

  const toEnqueue: TickJob[] = [];

  for (const it of items) {
    // basic validation to avoid NaNs rolling downstream
    if (!it?.symbol || !Number.isFinite(Number(it.price))) { skipped++; continue; }

    const ts = typeof it.ts === 'number' ? it.ts : Math.floor(new Date(it.ts).getTime() / 1000);

    // Keep original for redis SADD; DO NOT use as BullMQ jobId
    const idKey = it.idempotencyKey ?? `${source}:${it.symbol}:${ts}`;
    const kset = `idem:${dayKey(ts)}`;

    try {
      const added = await redis.sadd(kset, idKey);
      // set TTL only when the key is created
      if (added === 1) await redis.expire(kset, 3 * 24 * 3600, 'NX');

      if (added === 0) { duplicates++; continue; }

      accepted++;

      toEnqueue.push({
        symbol: it.symbol,
        price: it.price,
        ts,
        volume: it.volume ?? 0,
        source,
        idKey,       // keep for raw/audit; but NOT as jobId
      });

      await redisPub.publish(
        config.queue.pubsubChannel,
        JSON.stringify({ kind: 'tick', symbol: it.symbol, price: it.price, ts, volume: it.volume ?? 1 }),
      );
    } catch {
      rejected++;
    }
  }

  if (toEnqueue.length) {
    try {
      const res = await enqueueTicks(toEnqueue); // ensure this does NOT set jobId = idKey
      queued += res.length;
    } catch (e) {
      rejected += toEnqueue.length;
      throw Object.assign(new Error('ENQUEUE_FAILED'), { cause: e, status: 500 });
    }
  }

  return { accepted, duplicates, queued, rejected, skipped };
}

export async function upsertSymbolsWebhookSvc(items: SymbolRow[]) {
  const upserted = await upsertSymbols(items);
  return { upserted, skipped: 0 };
}