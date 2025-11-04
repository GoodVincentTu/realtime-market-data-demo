import { pool } from '../db/pool.js';
import { INSERT_TICKS_BATCH_VOL, INSERT_TICKS_RAW_BATCH } from '../db/sql.js';

type TickRow = {symbol:string; ts:number; price:number; volume?:number; idKey?: string; source?: string};

export async function insertTicksRawBatch(rows: TickRow[]) {
  if (!rows.length) return;
  // Only insert those that have an idKey (dedupe)
  const withKey = rows.filter(r => r.idKey);
  if (!withKey.length) return;

  const idk = withKey.map(r => r.idKey!);
  const sym = withKey.map(r => r.symbol);
  const ts  = withKey.map(r => r.ts);
  const pr  = withKey.map(r => r.price);
  const vol = withKey.map(r => r.volume ?? 0);
  const src = withKey.map(r => r.source ?? 'feeder');

  await pool.query(INSERT_TICKS_RAW_BATCH, [idk, sym, ts, pr, vol, src]);
}

export async function insertTicksHistoryAndRecent(
  rows: TickRow[]
) {
  if (!rows.length) return;

  const s = rows.map(r => r.symbol);
  const t = rows.map(r => r.ts);
  const p = rows.map(r => r.price);
  const v = rows.map(r => r.volume ?? 0);

  // Single statement; ticks_recent is a VIEW, so no separate upsert there
  await pool.query(INSERT_TICKS_BATCH_VOL, [s, t, p, v]);
}