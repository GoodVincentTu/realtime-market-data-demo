import { Pool } from 'pg';
import { config } from '../config.js';
export const pg = new Pool({ connectionString: config.databaseUrl });

export async function dbHealth() {
  const r = await pg.query('SELECT 1 AS ok');
  return r.rows[0]?.ok === 1;
}