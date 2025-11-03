# Data Storage & Algorithms — Market Data

## 0. Principles
- **Write path**: API accepts ticks → **Redis queue first** (or Kafka later) → consumers **batch‑flush** to Postgres. API does **not** write raw directly (reduces DB pressure). *DB remains the Source of Truth after flush*.
- **Read path**: UI hits HTTP for history/metrics; SSE fanout for live. Data served from **in‑memory ring buffer → Redis ZSET → Postgres** (hot→warm→cold).
- **Idempotency** everywhere; late/out‑of‑order tolerated within a bounded lateness `MAX_LAG_SEC`.
- **Isolation/locking**: row/unique constraints enforce integrity; **PG advisory transaction locks** serialize per‑(symbol,bucket) upserts (calc‑b).

## 1. Postgres Schema
```sql
CREATE TABLE IF NOT EXISTS symbols (
  symbol TEXT PRIMARY KEY,
  base   TEXT NOT NULL,
  quote  TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Raw ticks (append-only via consumers; API doesn't write here)
CREATE TABLE IF NOT EXISTS ticks_raw (
  symbol TEXT NOT NULL REFERENCES symbols(symbol),
  ts     TIMESTAMPTZ NOT NULL,
  price  DOUBLE PRECISION NOT NULL,
  volume DOUBLE PRECISION,             -- optional if source provides
  source TEXT NOT NULL DEFAULT 'feeder',
  id_key TEXT NOT NULL,                -- e.g. 'binance:BTCUSDT:1730425200'
  PRIMARY KEY (id_key)
);

-- Recent deduped ticks (fast lookup for history)
CREATE TABLE IF NOT EXISTS ticks_recent (
  symbol TEXT NOT NULL,
  ts     TIMESTAMPTZ NOT NULL,
  price  DOUBLE PRECISION NOT NULL,
  volume DOUBLE PRECISION,
  PRIMARY KEY (symbol, ts)
);
CREATE INDEX IF NOT EXISTS idx_ticks_recent_sym_ts_desc
  ON ticks_recent(symbol, ts DESC);

-- OHLC, 1-minute tumbling window (calc-b)
CREATE TABLE IF NOT EXISTS ticks_agg_1m (
  symbol       TEXT NOT NULL,
  bucket_start TIMESTAMPTZ NOT NULL,   -- minute start (UTC)
  open   DOUBLE PRECISION NOT NULL,
  high   DOUBLE PRECISION NOT NULL,
  low    DOUBLE PRECISION NOT NULL,
  close  DOUBLE PRECISION NOT NULL,
  volume DOUBLE PRECISION,
  PRIMARY KEY (symbol, bucket_start)
);
CREATE INDEX IF NOT EXISTS idx_agg_1m_sym_bucket
  ON ticks_agg_1m(symbol, bucket_start DESC);
```

**Retention (future):** monthly partitions for `ticks_raw`, archive to S3/Parquet; `ticks_recent` keep 24–72h rolling; `ticks_agg_1m` long‑term.

## 2. Redis Structures (queue + cache; Kafka later)
- **Queue:** `x:ticks` (Streams) *or* `q:ticks` (List). Batch size `BATCH=500` or flush by timer `<=250ms`.
- **Idempotency:** `idem:{yyyy-mm-dd}` (SET), TTL 15d; optional Bloom `bf:idem` (1% FP) to short‑circuit `SADD`.
- **Hot history:** `z:ticks:{symbol}` (ZSET; score=epochSec; member=compact JSON), TTL 12–24h.
- **Pub/Sub:** `ch:ticks` for live fanout; consumers publish both ticks and invalidation events (e.g., `{kind:"agg-1m", symbol, bucket}`).
- **Watermark:** `wm:{symbol}` = max event time seen; used to drop pathological late data beyond `MAX_LAG_SEC`.

## 3. In‑memory (per instance)
- **Ring buffer per symbol**: fixed capacity `RB_CAP` (e.g., 5k–20k ticks). Keep items **sorted by ts**; binary search for range queries.
- **Sliding window state (calc‑a)**: constant‑time aggregates for last **W seconds** (e.g., 60s/300s/1800s). See §4.2.
- **Last‑tick map**: to answer `/ticks/:symbol` instantly.

**Invalidation:** pub/sub → apply delta to ring buffer & window state; cold start prewarms from Postgres/Redis for `W + ε` seconds.

## 4. Algorithms

### 4.1 Idempotent ingest & batch flush
1. **API** computes `id_key = "<source>:<symbol>:<epochSec>"` (or upstream id if provided).
2. `SADD idem:{day} id_key` → if return `1`, enqueue to `x:ticks` with payload `{symbol, ts, price, volume?, source, id_key}`; else count as duplicate.
3. **Consumers** pop batches; within a single DB transaction:
   - `INSERT INTO ticks_raw ... ON CONFLICT DO NOTHING`
   - Upsert into `ticks_recent` (keep latest price per `(symbol, ts)`).
   - Update aggregates via **calc‑a** and **calc‑b** below.
4. Publish to `ch:ticks` for SSE + cache invalidation.

### 4.2 calc‑a — **Sliding window (rolling metrics)**
- Goal: metrics over last **W seconds** (configurable presets, e.g., 60s / 300s / 1800s), feeding `/metrics/:symbol` and dashboard tiles.
- Structures per symbol:
  - **Deque for min**, **Deque for max** (monotone queues).
  - **Rolling counters**: `count`, `sum`, `sumSq` (for variance), `vSum` (volume sum) to compute avg, stdev, VWAP.
- On tick `{t, p, v}`:
  1. **Evict** while `head.ts < t - W` from ring buffer and all deques; decrement counters with evicted values.
  2. **Insert** tick: push to ring buffer; push‑pop on deques to maintain monotonicity.
  3. Update counters in O(1).
- **Out‑of‑order within lag**: if `t` < current tail but `>= (now - MAX_LAG_SEC)`, **binary‑insert** into ring buffer and **rebuild** deques/counters over just the affected suffix (bounded work). Otherwise drop or route to correction path.
- Persist **checkpoint** every N seconds (optional) to survive restarts with minimal recompute.
- Complexity: **O(1)** per in‑order tick; amortized **O(log n)** insert + small rebuild for slightly late ticks.

### 4.3 calc‑b — **OHLC tumbling windows (1‑minute)**
- Compute `bucket_start = floor(ts to 60s)`. Under **transaction** with **advisory tx‑lock** on key `(symbol,bucket_start)`:
  ```sql
  -- deterministic 64-bit key
  WITH k AS (
    SELECT ((hashtext($1)::bigint & x'FFFFFFFF'::bigint) << 32)
         |  (EXTRACT(EPOCH FROM $2)::bigint & x'FFFFFFFF'::bigint) AS key64
  )
  SELECT pg_advisory_xact_lock((SELECT key64 FROM k));

  INSERT INTO ticks_agg_1m(symbol, bucket_start, open, high, low, close, volume)
  VALUES ($1, $2, $3, $3, $3, $3, $4)
  ON CONFLICT (symbol, bucket_start) DO UPDATE SET
    high   = GREATEST(EXCLUDED.high,  ticks_agg_1m.high),
    low    = LEAST   (EXCLUDED.low,   ticks_agg_1m.low),
    close  = EXCLUDED.close,
    volume = COALESCE(ticks_agg_1m.volume,0) + COALESCE(EXCLUDED.volume,0);
  ```
- **Late ticks** within `MAX_LAG_SEC` recompute the same bucket (idempotent upsert). Beyond lag: ignore or append to `raw` only (config).

### 4.4 History query (hot + warm + cold)
- Try **ring buffer** → if insufficient range, merge with **Redis ZSET** → fall back to **Postgres**:
  - Keyset pagination by `(symbol, ts)`:
    ```sql
    SELECT symbol, ts, price
    FROM ticks_recent
    WHERE symbol = $1
      AND ts < $2
    ORDER BY ts DESC
    LIMIT $3;
    ```
- Merge/dedupe on the server; return stable order. Avoid heavy tree structures — **binary search** over the ring buffer is sufficient for demo throughput.

## 5. Cache invalidation & consistency
- On consumer commit: publish to `ch:ticks`. Connection‑service pushes SSE; orchestrator may evict/refresh symbol scopes for history/metrics caches.
- Guarantees: 
  - **Live** (SSE) is real‑time.
  - **HTTP** eventually consistent with a **sub‑second** target after batch flush.

## 6. Observability
- **Prometheus counters**: accepted, duplicates, rejected, queue depth, batch size; DB latency histograms; window rebuild count.
- **Logs**: JSON (`rid`, `component`, `symbol`, `op`, `dur_ms`, `error?`).
- Suggested alerts: consumer lag, DB write latency p95, advisory‑lock contention, drop rate for late ticks.

## 7. Upgrade path — Kafka + ClickHouse/Druid
- **Kafka topics**: `ticks.raw`, `ticks.metrics`, `ticks.ohlc`. Exactly‑once via transactional producers or Flink.
- **ClickHouse** for time‑series queries (MergeTree, TTL, materialized views); **Druid** if you need multi‑tenant OLAP slices and sub‑second rollups.
- REST remains stable; Orchestrator reads from ClickHouse/Druid for history/metrics, Postgres keeps metadata and minimal recent cache.

## 8. Tunables (defaults for demo)
- `RB_CAP=10000`, `W=1800` (30m), `MAX_LAG_SEC=120`, `BATCH=500`, `FLUSH_INTERVAL_MS=250`.
- Redis ZSET TTL: 24h; Idempotency SET TTL: 15d.
- Isolation: `READ COMMITTED`; lock timeouts: `lock_timeout = '2s'`, `deadlock_timeout = '200ms'`.
