// Batch RAW ticks (idempotent, dedup within the same statement, volume-aware)
export const INSERT_TICKS_BATCH = `
  WITH input AS (
    SELECT
      unnest($1::text[])               AS symbol,
      to_timestamp(unnest($2::bigint[])) AS ts,
      unnest($3::double precision[])   AS price,
      unnest($4::double precision[])   AS volume
  ),
  rows AS (
    -- collapse duplicates in the same batch to ONE row per (symbol, ts)
    SELECT
      symbol,
      ts,
      COALESCE(MAX(price), 0)                           AS price,
      COALESCE(SUM(volume), 0)::double precision        AS volume
    FROM input
    GROUP BY symbol, ts
  )
  INSERT INTO ticks_history(symbol, ts, price, volume)
  SELECT symbol, ts, price, volume
  FROM rows
  ON CONFLICT (symbol, ts) DO UPDATE
    SET price  = EXCLUDED.price,
        volume = ticks_history.volume + EXCLUDED.volume
`;

/* Batch OHLC upsert (1-minute buckets) — aggregated input
   We expect arrays representing *one* row per (symbol,bucket_start):
   - price_open, open_ts, high, low, price_close, close_ts, count
*/
export const UPSERT_OHLC_1M_BATCH = `
  WITH rows AS (
    SELECT
      unnest($1::text[])              AS symbol,
      to_timestamp(unnest($2::bigint[])) AS bucket_start,
      unnest($3::double precision[])  AS open,
      to_timestamp(unnest($4::bigint[])) AS open_ts,
      unnest($5::double precision[])  AS high,
      unnest($6::double precision[])  AS low,
      unnest($7::double precision[])  AS close,
      to_timestamp(unnest($8::bigint[])) AS close_ts,
      unnest($9::integer[])           AS count
  )
  INSERT INTO ohlc_1m (symbol, bucket_start, open, open_ts, high, low, close, close_ts, count)
  SELECT symbol, bucket_start, open, open_ts, high, low, close, close_ts, count
  FROM rows
  ON CONFLICT (symbol, bucket_start) DO UPDATE SET
    open     = CASE WHEN EXCLUDED.open_ts  <  ohlc_1m.open_ts  THEN EXCLUDED.open  ELSE ohlc_1m.open  END,
    open_ts  = LEAST(ohlc_1m.open_ts, EXCLUDED.open_ts),
    high     = GREATEST(ohlc_1m.high, EXCLUDED.high),
    low      = LEAST(ohlc_1m.low, EXCLUDED.low),
    close    = CASE WHEN EXCLUDED.close_ts >= ohlc_1m.close_ts THEN EXCLUDED.close ELSE ohlc_1m.close END,
    close_ts = GREATEST(ohlc_1m.close_ts, EXCLUDED.close_ts),
    count    = ohlc_1m.count + EXCLUDED.count
`;

// batch insert raw ticks (append-only audit; dedup by id_key)
export const INSERT_TICKS_RAW_BATCH = `
  WITH rows AS (
    SELECT
      unnest($1::text[])                AS id_key,
      unnest($2::text[])                AS symbol,
      to_timestamp(unnest($3::bigint[])) AS ts,
      unnest($4::double precision[])    AS price,
      unnest($5::double precision[])    AS volume,
      unnest($6::text[])                AS source
  )
  INSERT INTO ticks_raw (id_key, symbol, ts, price, volume, source)
  SELECT id_key, symbol, ts, price, volume, source
  FROM rows
  ON CONFLICT (id_key) DO NOTHING
`;

// RAW ticks (idempotent) WITH volume
export const INSERT_TICKS_BATCH_VOL = `
  WITH input AS (
    SELECT
      unnest($1::text[])                AS symbol,
      to_timestamp(unnest($2::bigint[])) AS ts,
      unnest($3::double precision[])    AS price,
      unnest($4::double precision[])    AS volume
  ),
  rows AS (
    -- collapse duplicates inside the same batch
    SELECT
      symbol,
      ts,
      COALESCE(MAX(price), 0) AS price,
      COALESCE(SUM(volume),0)::double precision AS volume
    FROM input
    GROUP BY symbol, ts
  )
  INSERT INTO ticks_history(symbol, ts, price, volume)
  SELECT symbol, ts, price, volume
  FROM rows
  ON CONFLICT (symbol, ts) DO UPDATE
    SET price  = EXCLUDED.price,
        volume = ticks_history.volume + EXCLUDED.volume
`;

/** metrics_1m upsert WITH true traded volume */
export const UPSERT_METRICS_1M_BATCH_VOL = `
  WITH rows AS (
    SELECT
      unnest($1::text[])                 AS symbol,
      to_timestamp(unnest($2::bigint[])) AS bucket_start,
      unnest($3::integer[])              AS count,
      unnest($4::double precision[])     AS sum,
      unnest($5::double precision[])     AS min,
      unnest($6::double precision[])     AS max,
      unnest($7::double precision[])     AS last,
      to_timestamp(unnest($8::bigint[])) AS last_ts,
      unnest($9::double precision[])     AS volume_sum
  )
  INSERT INTO metrics_1m
    (symbol, bucket_start, count, sum, min, max, last, last_ts, volume_sum)
  SELECT symbol, bucket_start, count, sum, min, max, last, last_ts, volume_sum
  FROM rows
  ON CONFLICT (symbol, bucket_start) DO UPDATE SET
    count      = metrics_1m.count      + EXCLUDED.count,
    sum        = metrics_1m.sum        + EXCLUDED.sum,
    min        = LEAST(metrics_1m.min, EXCLUDED.min),
    max        = GREATEST(metrics_1m.max, EXCLUDED.max),
    last       = CASE WHEN EXCLUDED.last_ts >= metrics_1m.last_ts THEN EXCLUDED.last ELSE metrics_1m.last END,
    last_ts    = GREATEST(metrics_1m.last_ts, EXCLUDED.last_ts),
    volume_sum = metrics_1m.volume_sum + EXCLUDED.volume_sum
`;