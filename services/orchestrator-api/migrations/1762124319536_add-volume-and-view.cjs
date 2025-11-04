/* eslint-disable */
exports.up = (pgm) => {
  // 1) Ensure ticks_history has a volume column
  pgm.addColumn('ticks_history', {
    volume: { type: 'double precision', notNull: true, default: 0 },
  });

  // 2) If legacy TABLEs exist for ticks_recent / ticks_agg_1m, drop them
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND n.nspname = 'public' AND c.relname = 'ticks_recent'
      ) THEN
        EXECUTE 'DROP TABLE public.ticks_recent CASCADE';
      END IF;

      IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND n.nspname = 'public' AND c.relname = 'ticks_agg_1m'
      ) THEN
        EXECUTE 'DROP TABLE public.ticks_agg_1m CASCADE';
      END IF;
    END$$;
  `);

  // 3) Drop existing *views*, regardless of kind (view or materialized view)
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'ticks_recent' AND c.relkind = 'm'
      ) THEN
        EXECUTE 'DROP MATERIALIZED VIEW public.ticks_recent CASCADE';
      ELSIF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'ticks_recent' AND c.relkind = 'v'
      ) THEN
        EXECUTE 'DROP VIEW public.ticks_recent CASCADE';
      END IF;

      IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'ticks_agg_1m' AND c.relkind = 'm'
      ) THEN
        EXECUTE 'DROP MATERIALIZED VIEW public.ticks_agg_1m CASCADE';
      ELSIF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'ticks_agg_1m' AND c.relkind = 'v'
      ) THEN
        EXECUTE 'DROP VIEW public.ticks_agg_1m CASCADE';
      END IF;
    END$$;
  `);

  // 4) Recreate the canonical views (volume from metrics_1m.volume_sum)
  pgm.sql(`
    CREATE OR REPLACE VIEW public.ticks_recent AS
    SELECT symbol, ts, price, volume
    FROM public.ticks_history;

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
  // Drop the views we created
  pgm.sql(`
    DROP VIEW IF EXISTS public.ticks_agg_1m CASCADE;
    DROP VIEW IF EXISTS public.ticks_recent CASCADE;
  `);

  // Recreate "minimal" views without real volume (fallback)
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

  // Remove the volume column we added on up()
  pgm.dropColumn('ticks_history', 'volume');
};