// src/agg/ohlc.ts
export type RawTick = { symbol: string; price: number; ts: number | string; volume?: number };

export type EnrichedTick = RawTick & {
  ts: number; // normalized to number
  sma10: number;
  candle1m: {
    bucket_start: number; // epoch seconds at minute start
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
};

type CandleState = {
  bucketStart: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const candles = new Map<string, CandleState>();      // per symbol current 1m
const lastNPrices = new Map<string, number[]>();     // per symbol ring buffer (N=10)
const N = 10;

export function enrichTick(t: RawTick): EnrichedTick {
  const tsNum =
    typeof t.ts === 'number'
      ? Math.floor(t.ts)
      : Number(t.ts) || Math.floor(Date.now() / 1000);

  const vol = t.volume ?? 1;
  const b = tsNum - (tsNum % 60); // minute bucket start
  const key = t.symbol;

  // update candle
  let c = candles.get(key);
  if (!c || c.bucketStart !== b) {
    c = {
      bucketStart: b,
      open: t.price,
      high: t.price,
      low: t.price,
      close: t.price,
      volume: vol,
    };
  } else {
    c.high = Math.max(c.high, t.price);
    c.low = Math.min(c.low, t.price);
    c.close = t.price;
    c.volume += vol;
  }
  candles.set(key, c);

  // SMA10 over last 10 ticks (prices)
  const arr = lastNPrices.get(key) ?? [];
  arr.push(t.price);
  if (arr.length > N) arr.shift();
  lastNPrices.set(key, arr);
  const sma10 = arr.reduce((a, b) => a + b, 0) / arr.length;

  return {
    symbol: t.symbol,
    price: t.price,
    ts: tsNum,
    volume: vol,
    sma10: Number(sma10.toFixed(8)),
    candle1m: {
      bucket_start: c.bucketStart,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    },
  };
}