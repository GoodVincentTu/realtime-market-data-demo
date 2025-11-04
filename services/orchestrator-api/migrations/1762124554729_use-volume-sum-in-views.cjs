/* eslint-disable */
exports.up = (pgm) => {
  pgm.sql(`
    -- ticks_recent shows raw ticks (including raw trade size if present)
    CREATE OR REPLACE VIEW public.ticks_recent AS
    SELECT symbol, ts, price, volume
    FROM public.ticks_history;

    -- ticks_agg_1m exposes OHLC + true traded volume per minute
    CREATE OR REPLACE VIEW public.ticks_agg_1m AS
    SELECT
      o.symbol,
      o.bucket_start,
      o.open,
      o.high,
      o.low,
      o.close,
      COALESCE(m.volume_sum, 0)::double precision AS volume
    FROM public.ohlc_1m o
    LEFT JOIN public.metrics_1m m
      ON m.symbol = o.symbol
     AND m.bucket_start = o.bucket_start;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE VIEW public.ticks_recent AS
    SELECT symbol, ts, price, NULL::double precision AS volume
    FROM public.ticks_history;

    CREATE OR REPLACE VIEW public.ticks_agg_1m AS
    SELECT
      o.symbol,
      o.bucket_start,
      o.open,
      o.high,
      o.low,
      o.close,
      COALESCE(m.count::double precision, 0)::double precision AS volume
    FROM public.ohlc_1m o
    LEFT JOIN public.metrics_1m m
      ON m.symbol = o.symbol
     AND m.bucket_start = o.bucket_start;
  `);
};