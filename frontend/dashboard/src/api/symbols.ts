import api from "./client";
import type { Tick, SymbolInfo, CandleItem } from "../domain/types";
import {
  isArrayOfSymbolInfo,
  isArrayOfTick,
  isHistoryEnvelope,
  isListSymbolsResp,
  isTickHistoryResp,
} from "../domain/guards";

export async function getLatestTick(symbol: string): Promise<Tick> {
  const { data } = await api.get(`/ticks/${encodeURIComponent(symbol)}`);
  // If needed, validate: if (!isTick(data)) throw new Error("Unexpected tick shape");
  return data as Tick;
}

export async function listSymbols(): Promise<SymbolInfo[]> {
  const { data } = await api.get("/symbols", { params: { active: true } });
  const d: unknown = data;
  if (isListSymbolsResp(d)) return d.items;
  if (isArrayOfSymbolInfo(d)) return d;
  throw new Error("Unexpected symbols payload shape");
}

// previous version
export async function getTickHistory(symbol: string, limit = 200): Promise<Tick[]> {
  const { data } = await api.get(`/ticks/${encodeURIComponent(symbol)}/history`, { params: { limit } });
  const d: unknown = data;

  const items: Tick[] =
    isTickHistoryResp(d) ? d.items :
    isArrayOfTick(d)     ? d :
    [];

  // Ensure ASC for chart
  items.sort((a, b) => a.ts - b.ts);
  return items;
}

export async function getTickHistoryV2(symbol: string, limit = 500): Promise<CandleItem[]> {
  const { data } = await api.get(
    `/ticks/${encodeURIComponent(symbol)}/history`,
    { params: { limit, view: 'ohlc1m' } } // backend returns { items: [...], nextCursor? }
  );

  const rawItems: unknown[] =
    isHistoryEnvelope(data) ? (data.items as unknown[]) :
    Array.isArray(data)     ? data :
    [];

  const items: CandleItem[] = rawItems.flatMap((row) => {
    if (typeof row !== 'object' || row === null) return [];
    const r = row as Record<string, unknown>;

    const tsVal = r.ts ?? r.bucket_start ?? r.time;
    const tsNum =
      typeof tsVal === 'number' ? tsVal :
      typeof tsVal === 'string' ? Number(tsVal) : NaN;
    if (!Number.isFinite(tsNum)) return [];

    const open = r.open, high = r.high, low = r.low, close = r.close;
    if (![open, high, low, close].every((v) => typeof v === 'number')) return [];

    const volume = typeof r.volume === 'number' ? r.volume : 0;
    const sma10  = typeof r.sma10  === 'number' ? r.sma10  : null;

    return [{
      symbol: typeof r.symbol === 'string' ? r.symbol : symbol,
      ts: Math.floor(tsNum),
      open: open as number,
      high: high as number,
      low:  low  as number,
      close: close as number,
      volume,
      sma10,
    }];
  });

  items.sort((a, b) => a.ts - b.ts);
  return items;
}

export type Metrics = {
  windowStart?: string | number;
  windowEnd?: string | number;
  count?: number;
  min?: number;
  max?: number;
  avg?: number;
  vwap?: number;
  volume?: number;
  last?: number;
  [k: string]: unknown;
};

export async function getMetrics(symbol: string): Promise<Metrics> {
  const { data } = await api.get(`/metrics/${encodeURIComponent(symbol)}`);
  return data as Metrics;
}