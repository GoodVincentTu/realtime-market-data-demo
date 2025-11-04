import type { SymbolInfo, Tick, ListSymbolsResp, TickHistoryResp, CandleItem } from "./types";


function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function isHistoryEnvelope(v: unknown): v is { items: CandleItem[]; nextCursor?: unknown } {
  if (!isObj(v)) return false;
  return Array.isArray(v.items);
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function isSymbolInfo(v: unknown): v is SymbolInfo {
  return (
    isPlainObject(v) &&
    typeof v.symbol === "string" &&
    typeof v.base === "string" &&
    typeof v.quote === "string" &&
    typeof v.active === "boolean"
  );
}

export function isTick(v: unknown): v is Tick {
  return (
    isPlainObject(v) &&
    typeof v.symbol === "string" &&
    typeof v.ts === "number" &&
    typeof v.price === "number" &&
    (v.volume === undefined || typeof v.volume === "number")
  );
}

export function isArrayOfSymbolInfo(v: unknown): v is SymbolInfo[] {
  return Array.isArray(v) && v.every(isSymbolInfo);
}

export function isArrayOfTick(v: unknown): v is Tick[] {
  return Array.isArray(v) && v.every(isTick);
}

export function isListSymbolsResp(v: unknown): v is ListSymbolsResp {
  if (!isPlainObject(v)) return false;
  return isArrayOfSymbolInfo((v as Record<string, unknown>).items);
}

export function isTickHistoryResp(v: unknown): v is TickHistoryResp {
  if (!isPlainObject(v)) return false;
  const rec = v as Record<string, unknown>;
  const itemsOk = isArrayOfTick(rec.items);
  const nc = rec.nextCursor;
  const nextCursorOk =
    nc === undefined || nc === null || typeof nc === "number" || typeof nc === "string";
  return itemsOk && nextCursorOk;
}