import { parseLimit } from '../utils/pagination.js';
import { getLatestTick, getHistory, getAgg1mLatest, getOhlc1mHistoryWithSMA } from '../repositories/ticks.repo.js';

type HistoryQuery = { limit?: unknown; before?: unknown; cursor?: unknown; view?: unknown; agg?: unknown; shape?: unknown };


export async function latestTickSvc(symbol: string) {
  const row = await getLatestTick(symbol);
  if (!row) throw Object.assign(new Error('no data'), { status: 404, code: 'NOT_FOUND' as const });
  return row;
}

export async function tickHistorySvc(symbol: string, q: HistoryQuery) {
  const limit = parseLimit(q.limit, 1, 1000, 200);

  // accept both ?before= and legacy ?cursor= (both are epoch seconds)
  const raw = q.before ?? q.cursor;
  const before =
    typeof raw === 'string' || typeof raw === 'number'
      ? Number(raw)
      : Math.floor(Date.now() / 1000) + 1;

  const items = await getHistory(symbol, before, limit);
  const nextCursor = items.length ? items[items.length - 1].ts : null;
  return { items, nextCursor };
}

export async function tickHistorySvcV2(symbol: string, q: HistoryQuery) {
  const limit = parseLimit(q.limit, 1, 2000, 200);

  const raw = q.before ?? q.cursor;
  const before =
    typeof raw === 'string' || typeof raw === 'number'
      ? Number(raw)
      : Math.floor(Date.now() / 1000) + 1;

  const wantOhlc =
    (typeof q.view === 'string'  && q.view.toLowerCase()  === 'ohlc1m') ||
    (typeof q.agg === 'string'   && q.agg.toLowerCase()   === '1m')     ||
    (typeof q.shape === 'string' && q.shape.toLowerCase() === 'candle');

  if (!wantOhlc) {
    // legacy: raw ticks
    const items = await getHistory(symbol, before, limit);
    const nextCursor = items.length ? items[items.length - 1].ts : null;
    return { items, nextCursor };
  }

  // candle mode: include SMA10 & volume
  const rows = await getOhlc1mHistoryWithSMA(symbol, before, limit + 9); // +9 for SMA lookback
  rows.reverse(); // make ASC by time

  const trimmed = rows.length > limit ? rows.slice(rows.length - limit) : rows;
  const nextCursor = trimmed.length ? trimmed[0].ts : null;
  return { items: trimmed, nextCursor };
}

export async function aggMetricsSvc(symbol: string) {
  const row = await getAgg1mLatest(symbol);
  if (!row) throw Object.assign(new Error('no data'), { status: 404, code: 'NOT_FOUND' as const });
  return row;
}