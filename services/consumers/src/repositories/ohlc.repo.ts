import { pool } from '../db/pool.js';
import { UPSERT_OHLC_1M_BATCH } from '../db/sql.js';

export type OhlcAggRow = {
  symbol: string;
  bucketSec: number;
  open: number;
  openTs: number;
  high: number;
  low: number;
  close: number;
  closeTs: number;
  count: number;
};

export async function upsertOhlc1mBatch(rows: OhlcAggRow[]) {
  if (!rows.length) return;
  const sym   = rows.map(r => r.symbol);
  const buck  = rows.map(r => r.bucketSec);
  const open  = rows.map(r => r.open);
  const oTs   = rows.map(r => r.openTs);
  const high  = rows.map(r => r.high);
  const low   = rows.map(r => r.low);
  const close = rows.map(r => r.close);
  const cTs   = rows.map(r => r.closeTs);
  const cnt   = rows.map(r => r.count);
  await pool.query(UPSERT_OHLC_1M_BATCH, [sym, buck, open, oTs, high, low, close, cTs, cnt]);
}