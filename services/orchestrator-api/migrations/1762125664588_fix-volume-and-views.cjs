/* eslint-disable */
/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  // 1) Ensure ticks_history.volume exists
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='ticks_history' AND column_name='volume'
      ) THEN
        ALTER TABLE public.ticks_history
          ADD COLUMN volume double precision NOT NULL DEFAULT 0;
      END IF;
    END$$;
  `);

  // 2) Ensure metrics_1m.volume_sum exists
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='metrics_1m' AND column_name='volume_sum'
      ) THEN
        ALTER TABLE public.metrics_1m
          ADD COLUMN volume_sum double precision NOT NULL DEFAULT 0;
      END IF;
    END$$;
  `);

  // 3) If someone accidentally created tables named like the views, drop those tables
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                 WHERE c.relkind='r' AND n.nspname='public' AND c.relname='ticks_recent') THEN
        EXECUTE 'DROP TABLE public.ticks_recent CASCADE';
      END IF;
      IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                 WHERE c.relkind='r' AND n.nspname='public' AND c.relname='ticks_agg_1m') THEN
        EXECUTE 'DROP TABLE public.ticks_agg_1m CASCADE';
      END IF;
    END$$;
  `);

  // 4) Recreate views (drop VIEW only; we never had materialized views)
  pgm.sql(`DROP VIEW IF EXISTS public.ticks_recent CASCADE;`);
  pgm.sql(`DROP VIEW IF EXISTS public.ticks_agg_1m CASCADE;`);

  // 5) ticks_recent is a VIEW over ticks_history (including volume)
  pgm.sql(`
    CREATE OR REPLACE VIEW public.ticks_recent AS
    SELECT symbol, ts, price, volume
    FROM public.ticks_history;
  `);

  // 6) ticks_agg_1m joins OHLC with metrics; expose traded volume from metrics_1m.volume_sum
  pgm.sql(`
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
  pgm.sql(`DROP VIEW IF EXISTS public.ticks_agg_1m CASCADE;`);
  pgm.sql(`DROP VIEW IF EXISTS public.ticks_recent CASCADE;`);
  // do NOT drop columns on down; they’re harmless.
};