# Storage & DB Notes

This document explains **how** we store ticks, **why** we don’t write every tick straight to Postgres, and **what** to do later if we need stronger guarantees.

---

## 1. Goals

- Keep the **ingest path fast** even when tick rate spikes.
- Avoid **DB write amplification** from per-tick inserts.
- Keep data **queryable** (recent history, per-symbol views).
- Be honest about **demo-level data loss risk**.

---

## 2. Current Approach (demo)

**Rule:** the webhook **does not** write every tick to Postgres.

Flow:

1. `feeder` → `orchestrator-api` (`POST /ingest/tick`)
2. `orchestrator-api`:
   - validates/authenticates
   - **pushes tick to Redis/BullMQ** (`queue: ticks.received`)
   - returns 200 to the feeder
3. A background task (in API or in a dedicated worker) **flushes to Postgres in batches**.

Why: the napkin estimate showed that per-tick inserts could saturate the DB sooner than Redis, so we put Redis in front.

---

## 3. Batch Flush to Postgres

- Trigger: **interval** (e.g. every 1–5 seconds) **or** **batch size** (e.g. 200 ticks).
- For each batch:
  1. start a **transaction**
  2. insert / upsert ticks
  3. commit
  4. delete/ack the batch in Redis

Example target table:

```sql
CREATE TABLE md_ticks (
    symbol      text        NOT NULL,
    ts          timestamptz NOT NULL,
    price       numeric     NOT NULL,
    volume      numeric     NOT NULL,
    source      text        NOT NULL,
    PRIMARY KEY (symbol, ts)
);
CREATE INDEX md_ticks_symbol_ts_desc ON md_ticks (symbol, ts DESC);
```

**Important:** because the data sits in Redis until flush, **a crash can lose the last batch**. This is acceptable for the demo and must be stated in the main architecture doc.

---

## 4. Data-Loss Risk (and how to reduce it)

**Risk:** last N ticks (N = batch size or time window) may be lost.

Ways to reduce:

- lower the flush interval (1s instead of 5s)
- lower the batch size (50 instead of 200)
- run **two** flushers (competing consumers) to reduce time-in-queue
- use **Redis Streams** with ACKs instead of plain lists/queues
- persist “pending batch” to Postgres in a separate table (outbox pattern)

For this project we only **document** these options — we don’t implement them.

---

## 5. Queries & Indexing

Typical queries:

1. **latest per symbol**  
   - keep in memory / Redis hash  
   - fallback: `SELECT * FROM md_ticks WHERE symbol = $1 ORDER BY ts DESC LIMIT 1;`

2. **recent history (N = 1000)**  
   ```sql
   SELECT * FROM md_ticks
   WHERE symbol = $1
   ORDER BY ts DESC
   LIMIT 1000;
   ```

3. **time-range** (for chart):
   ```sql
   SELECT * FROM md_ticks
   WHERE symbol = $1 AND ts BETWEEN $2 AND $3
   ORDER BY ts;
   ```

Indexes to support this:

```sql
CREATE INDEX md_ticks_symbol_ts ON md_ticks (symbol, ts);
-- or for large time-based scans:
-- CREATE INDEX md_ticks_symbol_ts_brin ON md_ticks USING brin (symbol, ts);
```

---

## 6. Ranges, Merges, and GiST (future)

If we later fold many ticks into **time ranges** (what calc-b might do), we can store them like this:

```sql
CREATE TABLE md_ranges (
    symbol text NOT NULL,
    window tstzrange NOT NULL,
    agg    jsonb NOT NULL
);
CREATE INDEX md_ranges_symbol_window_gist
    ON md_ranges USING gist (symbol, window);
```

This allows queries like “what aggregate covers `2025-10-31 10:00:00Z` for BTC?”

Because two workers could try to update the same symbol/range, wrap the merge in a **transaction + advisory lock**:

```sql
SELECT pg_advisory_xact_lock(hashtext($1)); -- $1 = symbol
-- do upserts / merges on md_ranges
COMMIT;
```

We **document** this; we don’t build it in the 8–10h version.

---

## 7. Consistency Level (demo statement)

- **Ingest path**: fast, Redis-first → **eventual** in Postgres
- **Realtime path**: fresh (pushed over SSE/WS)
- **DB path**: slightly behind (by the flush interval)
- This is acceptable for a demo / take-home, and we explain how to harden it in `architecture-scale.md`.

---
