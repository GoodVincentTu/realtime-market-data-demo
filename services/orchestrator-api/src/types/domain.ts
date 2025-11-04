export type SymbolRow = { symbol: string; base: string; quote: string; active: boolean };
export type TickRow = { symbol:string; ts:number; price:number; volume:number };
export type AggRow = {
  symbol: string;
  windowStart: number;
  windowEnd: number;
  open: number;
  max: number;
  min: number;
  last: number;
  volume: number | null;
  avg: number;
};
export type WebhookTickItem = {
  idempotencyKey?: string;
  symbol: string;
  price: number;
  ts: number | string;
  volume?: number;
  source?: string;
};
export type CandleRow = {
  symbol: string;
  ts: number;        // epoch seconds (bucket_start)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma10: number | null; // 10-bar SMA on close
};