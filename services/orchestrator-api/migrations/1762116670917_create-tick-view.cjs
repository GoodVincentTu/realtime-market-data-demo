/* Reconcile: ensure ticks_recent / ticks_agg_1m are VIEWS, not tables. */
exports.up = (pgm) => {
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

exports.down = (pgm) => {
  pgm.sql(`
    DROP VIEW IF EXISTS public.ticks_agg_1m CASCADE;
    DROP VIEW IF EXISTS public.ticks_recent CASCADE;
  `);
};