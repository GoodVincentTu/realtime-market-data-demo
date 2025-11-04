import { pg } from '../db/pool.js';
import { SQL } from '../db/sql.js';
import type { TickRow, CandleRow } from '../types/domain.js';

export type Agg1mRow = {
  symbol: string;
  windowStart: number;
  windowEnd: number;
  open: number;
  max: number;
  min: number;
  last: number;
  volume: number;
  avg: number;
};

export async function getLatestTick(symbol: string): Promise<TickRow | null> {
  const { rows } = await pg.query(SQL.ticks.latestBySymbol, [symbol]);
  return (rows[0] as TickRow) ?? null;
}

// `before` is epoch seconds (exclusive upper bound). `limit` 1..1000
export async function getHistory(symbol: string, before: number, limit: number): Promise<TickRow[]> {
  const { rows } = await pg.query(SQL.ticks.historyBySymbol, [symbol, before, limit]);
  return rows as TickRow[];
}

export async function selectTickHistory(symbol: string, limit = 200): Promise<TickRow[]> {
  const { rows } = await pg.query(SQL.ticks.selectTickHistory, [symbol, limit]);
  return rows.reverse(); // ASC for chart
}

export async function getAgg1mLatest(symbol: string): Promise<Agg1mRow | null> {
  const { rows } = await pg.query(SQL.ticks.agg1mLatest, [symbol]);
  return (rows[0] as Agg1mRow) ?? null;
}

// not used
export async function getCandles1m(symbol: string, before: number, limit: number): Promise<CandleRow[]> {
  const { rows } = await pg.query(SQL.candle.selectCandles1m, [symbol, before, limit]);
  return rows as CandleRow[];
}


export async function getOhlc1mHistoryWithSMA(
  symbol: string,
  beforeTs: number,
  limit: number
): Promise<CandleRow[]> {
  const { rows } = await pg.query(SQL.candle.getOhlc1mHistoryWithSMA, [symbol, beforeTs, limit]);
  return rows.map(r => ({
    symbol: r.symbol,
    ts: Number(r.ts),
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: Number(r.volume),
    sma10: r.sma10 == null ? null : Number(r.sma10),
  }));
}