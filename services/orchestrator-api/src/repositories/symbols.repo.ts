import { pg } from '../db/pool.js';
import { SQL } from '../db/sql.js';
import type { SymbolRow } from '../types/domain.js';

export async function listActiveSymbols(): Promise<SymbolRow[]> {
  const r = await pg.query(SQL.symbols.listActive);
  return r.rows as SymbolRow[];
}

export async function upsertSymbols(items: SymbolRow[]): Promise<number> {
  if (items.length === 0) return 0;
  const text = SQL.symbols.upsertMany(items.length);
  const values: (string | boolean)[] = [];
  for (const s of items) values.push(s.symbol, s.base, s.quote, s.active);
  const r = await pg.query(text, values);
  // node-pg returns rowCount for INSERT ... ON CONFLICT as number of input rows
  return r.rowCount ?? items.length;
}