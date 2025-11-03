# Market Data Demo — Architecture (Scale / Interview)

## Objective
Show how the current 4-service layout evolves when:
- ingest becomes truly write-heavy
- we add more consumers (dashboards, analytics)
- we want better durability guarantees than “Redis + best-effort flush”

## Current layout (recap)
- **feeder** → **orchestrator-api** (webhook)
- orchestrator-api → **Redis/BullMQ** (queue)
- **consumers** (calc-a, calc-b) → orchestrator-api → **realtime-gateway** → **frontend**
- orchestrator-api → **Postgres** (batched flush)

## Observation 1 — calc-a / calc-b are not always necessary
In the minimal demo, all we actually need is:
1. Normalize/validate the tick
2. Maintain per-symbol, in-memory state
3. Push to clients
4. Persist in batch

So in small loads, having **two** consumer layers (calc-a then calc-b) is **structural overkill**.

### Better (simpler) structure for small/medium load
- Keep **one** worker group: `calc-worker`
- Worker does:
  - per-symbol window calculations (what was calc-a)
  - any cross-symbol aggregations needed (simple ones)
  - writes/publishes final view
- orchestrator-api still fans out & flushes
- This reduces queue fan-out and number of moving parts

### When to split into calc-a / calc-b again
Split when one of these happens:
- you need **very different SLAs** (per-symbol calcs must be fast, cross-symbol can be slower)
- you need **different scaling axes** (many symbols vs heavy global calc)
- you want to **deploy them on different node types** (CPU vs memory optimized)

Documenting this tells the reviewer you’re not blindly adding services.

## Observation 2 — DB should not be in the hot path
In the scaled version, we make this a rule:

> **Rule:** The ingestion SLA is determined by Redis/BullMQ, not by Postgres.

Concretely:
1. Webhook receives tick → enqueue to Redis
2. Return 200 to feeder
3. Async workers:
   - compute + publish to realtime
   - **buffer** to an “outbox” (in Redis or in-memory)
   - write to Postgres in **transactional batches**

## Batching to Postgres (with GiST / locking)
- For per-symbol historical storage we can use:
  - table `md_ticks(symbol text, ts timestamptz, price numeric, volume numeric, source text, PRIMARY KEY(symbol, ts))`
  - GiST or BRIN index for time range queries if volume grows
- Batched write flow:
  1. worker pulls N messages from Redis (e.g. 200–500)
  2. starts a transaction
  3. upserts/inserts rows
  4. commits
  5. on success, delete from Redis batch key

- If we start doing **range merges** (like your original diagram with A/B), we can:
  - use `tstzrange` columns
  - create GiST index on that
  - and in the merge step acquire an **advisory lock** per symbol to avoid two workers rewriting overlapping ranges

We probably **won’t code** the GiST part in an 8–10h window, so we document it here.

## Notifications (final)
To avoid service-to-service HTTP discovery, we standardize on:

- **Redis pub/sub** as the **notification** bus:
  - channel: `realtime:updates`
  - payload: `{type: "symbol.updated", symbol: "BTC", ts: "...", view: {...}}`
- orchestrator-api publishes to it **after** it gets updates from the worker
- realtime-gateway subscribes and pushes to clients
- multiple realtime-gateway replicas can subscribe → good for k8s + Helm

## K8s / Helm notes
- Each service has its own chart: `deploy/helm/<service>/`
- Values include:
  - `image.repository`, `image.tag`
  - `env.REDIS_URL`, `env.PG_URL`
  - `resources.requests/limits`
  - `autoscaling.enabled: true`
- For realtime-gateway we document that:
  - WS requires sticky sessions at LB **or**
  - we keep it SSE-only → then stickiness isn’t required