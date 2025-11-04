import type { SymbolRow } from '../types/domain.js';
import { listActiveSymbols, upsertSymbols } from '../repositories/symbols.repo.js';

export async function listSymbolsSvc() {
  return listActiveSymbols();
}

export async function upsertSymbolsSvc(items: SymbolRow[]) {
  const upserted = await upsertSymbols(items);
  return { upserted, skipped: 0 };
}