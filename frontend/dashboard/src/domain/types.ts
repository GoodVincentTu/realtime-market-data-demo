export type Tick = { symbol: string; ts: number; price: number; volume?: number };
export type SymbolInfo = { symbol: string; base: string; quote: string; active: boolean };

export type ListSymbolsResp = { items: SymbolInfo[] };
export type TickHistoryResp = { items: Tick[]; nextCursor?: number | string | null };

export type CandleItem = {
  symbol: string;
  ts: number; // epoch seconds (normalized field we use everywhere)
  open: number; high: number; low: number; close: number;
  volume: number;
  sma10: number | null;
};

// SSE payload from realtime-gateway (supports ts OR bucket_start on candle1m)
export type SseCandle1m = {
  ts?: number;
  bucket_start?: number;
  open: number; high: number; low: number; close: number;
  volume: number;
};

export type SseTickMsg = {
  kind?: 'tick' | 'agg';
  symbol: string;
  ts?: number;
  price?: number;
  volume?: number;
  sma10?: number | null;
  candle1m?: SseCandle1m;
};