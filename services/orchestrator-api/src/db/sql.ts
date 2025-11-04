// services/orchestrator-api/src/db/sql.ts
export const SQL = {
  symbols: {
    listActive: `
      SELECT symbol, base, quote, active
      FROM symbols
      WHERE active = TRUE
      ORDER BY symbol ASC
    `,
    upsertMany: (count: number) => `
      INSERT INTO symbols(symbol, base, quote, active)
      VALUES ${Array.from({ length: count }, (_, i) => {
      const o = i * 4;
      return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4})`;
    }).join(',')}
      ON CONFLICT (symbol) DO UPDATE
        SET base = EXCLUDED.base,
            quote = EXCLUDED.quote,
            active = EXCLUDED.active
    `
  },
  ticks: {
    latestBySymbol: `
      SELECT symbol, EXTRACT(EPOCH FROM ts)::int AS ts, price
      FROM ticks_recent
      WHERE symbol = $1
      ORDER BY ts DESC
      LIMIT 1
    `,
    historyBySymbol: `
      SELECT symbol, EXTRACT(EPOCH FROM ts)::int AS ts, price
      FROM ticks_recent
      WHERE symbol = $1 AND ts < to_timestamp($2)
      ORDER BY ts DESC
      LIMIT $3
    `,
    selectTickHistory: `
      SELECT symbol, ts, price, volume
      FROM public.ticks_recent
      WHERE symbol = $1
      ORDER BY ts DESC
      LIMIT $2
    `,
    agg1mLatest: `
      SELECT
        symbol,
        EXTRACT(EPOCH FROM bucket_start)::int                       AS "windowStart",
        EXTRACT(EPOCH FROM (bucket_start + interval '1 minute'))::int AS "windowEnd",
        open                                                        AS "open",
        high                                                        AS "max",
        low                                                         AS "min",
        close                                                       AS "last",
        COALESCE(volume, 0)::float8                                 AS "volume",
        ((open+high+low+close)/4.0)::float8                         AS "avg"
      FROM ticks_agg_1m
      WHERE symbol = $1
      ORDER BY bucket_start DESC
      LIMIT 1;
    `
  },
  candle: {
    selectCandles1m: `
      SELECT
        symbol,
        EXTRACT(EPOCH FROM bucket_start)::int AS ts,
        open, high, low, close,
        volume
      FROM public.ticks_agg_1m
      WHERE symbol = $1
        AND bucket_start < to_timestamp($2)
      ORDER BY bucket_start ASC
      LIMIT $3
    `,
    getOhlc1mHistoryWithSMA: `
      WITH cand AS (
        SELECT
          o.symbol,
          o.bucket_start,
          o.open, o.high, o.low, o.close,
          COALESCE(m.volume_sum, 0)::double precision AS volume
        FROM public.ohlc_1m o
        LEFT JOIN public.metrics_1m m
          ON m.symbol = o.symbol AND m.bucket_start = o.bucket_start
        WHERE o.symbol = $1
          AND o.bucket_start < TO_TIMESTAMP($2)
        ORDER BY o.bucket_start DESC
        LIMIT $3
      )
      SELECT
        c.symbol,
        EXTRACT(EPOCH FROM c.bucket_start)::bigint AS ts,
        c.open, c.high, c.low, c.close, c.volume,
        AVG(c.close) OVER (ORDER BY c.bucket_start ROWS BETWEEN 9 PRECEDING AND CURRENT ROW) AS sma10
      FROM cand c
      ORDER BY c.bucket_start DESC
    `,
  }
} as const;