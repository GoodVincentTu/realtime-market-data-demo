import { pool } from '../db/pool.js';
import { UPSERT_METRICS_1M_BATCH_VOL } from '../db/sql.js';

export type MetricsAggRow = {
  symbol: string;
  bucketSec: number;
  count: number;
  sum: number;
  min: number;
  max: number;
  last: number;
  lastTs: number;
  volumeSum: number;
};

export async function upsertMetrics1mBatch(rows: MetricsAggRow[]) {
  if (!rows.length) return;
  const sym  = rows.map(r => r.symbol);
  const buck = rows.map(r => r.bucketSec);
  const cnt  = rows.map(r => r.count);
  const sum  = rows.map(r => r.sum);
  const min  = rows.map(r => r.min);
  const max  = rows.map(r => r.max);
  const last = rows.map(r => r.last);
  const lTs  = rows.map(r => r.lastTs);
  const vol  = rows.map(r => r.volumeSum);
  await pool.query(UPSERT_METRICS_1M_BATCH_VOL, [sym, buck, cnt, sum, min, max, last, lTs, vol]);
}