import { Pool } from 'pg';
import { cfg } from '../config/index.js';

export const pool = new Pool({ connectionString: cfg.databaseUrl });

export async function dbHealth(): Promise<boolean> {
  const c = await pool.connect();
  try { await c.query('SELECT 1'); return true; }
  finally { c.release(); }
}