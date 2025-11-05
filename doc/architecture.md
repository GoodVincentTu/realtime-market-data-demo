
# Realtime Market Data Demo — Architecture & Developer Guide

> **Scope:** Explains the current design, what’s shipped, what’s deferred, and how to run, test, and deploy.

## Contents
- [System Overview](#1-system-overview)
- [Technology Choices](#2-technology-choices)
- [Scaling Considerations](#3-scaling-considerations)
- [Trade‑offs](#4-tradeoffs)
- [API Contracts (Current)](#5-api-contracts-current)
- [Data Model (Simplified ER)](#6-data-model-simplified-er)
- [Folder Structure](#7-folder-structure)
- [Local Development](#8-local-development)
- [Tests](#9-tests)
- [Docker & Compose](#10-docker--compose)
- [CI/CD (GitHub Actions)](#11-cicd-github-actions)
- [Render Deployment (Reference)](#12-render-deployment-reference)
- [Security](#13-security)
- [Observability](#14-observability)
- [Assumptions](#15-assumptions)
- [Deferred Work / Future Improvements](#16-deferred-work--future-improvements)
- [Appendix — SQL (SMA10 Window)](#17-appendix--sql-sma10-window)
- [Review Notes](#18-review-notes)

---

## 1) System Overview

This system ingests trade ticks, deduplicates and batches them, writes **raw** and **aggregated** data to Postgres, broadcasts **realtime** updates via SSE, and serves **HTTP APIs** to a React dashboard. Redis is used for both idempotency (ingest) and pub/sub (realtime).

### High‑level Architecture
![high level](./submission/tick_data_pipeline.svg)

### Data Flow (End‑to‑end)
![Data flow](./submission/tick_data_processing.svg)

---

## 2) Technology Choices

- **Backend:** Node.js + Express (simplicity, ecosystem, fast iteration).  
- **Frontend:** React + Vite + TanStack Query (fast HMR, robust data fetching/caching).  
- **Realtime:** Server‑Sent Events (SSE) via an independent Realtime Gateway (HTTP‑friendly, simple fanout).  
- **Storage:** Postgres (row + time‑bucket aggregates) and Redis (idempotency sets, pub/sub).  
- **Why:** The workload is write‑heavy but structured; Postgres handles raw + aggregate tables well (CQs and window funcs). SSE is trivial to scale behind a gateway and reverse proxy. Redis is the right hammer for lightweight dedupe and pub/sub.

---

## 3) Scaling Considerations

- **100 symbols:** Keep one shared batcher; key‑aggregate in memory when possible; tune batch size/flush window.  
- **1,000 ticks/sec:** First bottleneck is DB write IOPS. Mitigations:
  - Bulk copy (multi‑values), connection pooling, partition tables by date.
  - Async aggregation via Consumers only; no sync aggregation in API path.
  - Use Redis streams for back‑pressure; shard consumers by symbol hash.
- **What breaks first:** DB contention on upserts and view refresh if abused; SSE fanout CPU if message rate spikes.  
- **For production:** Table partitioning; pgbouncer; vectorized inserts; move to TimescaleDB/PG hypertables; shard Redis; horizontally scale RGW; add circuit‑breakers; SLOs with load‑shedding.

---

## 4) Trade‑offs

- **Prioritized developer speed** (plain Express + SSE) over advanced brokers (Kafka/NATS).  
- **Chose Postgres** instead of specialized TSDB to simplify ops; accept need for partitioning and careful indexes.  
- **Kept SSE stateless** in gateway; punted on presence/rewind semantics.  
- **Deferred cross‑region replication** and historical backfill service to keep scope focused.

---

## 5) API Contracts
![api current](./submission/symbol_data_realtime.svg)

**Auth:**  
- Public `GET` endpoints are open.  
- Write‑path webhooks require header **`x-api-key`**.  
- Optional: set `CORS_ALLOW_ORIGINS` in API and `ALLOW_ORIGINS` in RGW.

---

## 6) Data Model (Simplified ER)
![data model](./submission/market_data_schema.svg)

---

## 7) Folder Structure

```text
project_root/
├─ deploy/
│  ├─ docker/
│  │  ├─ consumers/
│  │  ├─ dashboard/
│  │  ├─ feeder/
│  │  ├─ orchestrator-api/
│  │  └─ realtime-gateway/
│  └─ helm/                  # Helm charts per service
├─ frontend/
│  └─ dashboard/             # React + Vite app (static build)
├─ services/
│  ├─ consumers/             # Batcher + calc-A/B + DB writers + pub
│  ├─ feeder/                # Synthetic/webhook feed generator
│  ├─ orchestrator-api/      # Public APIs + webhooks (write-path)
│  └─ realtime-gateway/      # SSE fanout from Redis pub/sub
├─ .dockerignore
├─ .gitignore
├─ pnpm-workspace.yaml
└─ package.json
```

---

## 8) Local Development
- Please refer the README.md file directly under the project root folder.

### Dependencies
- **Node 20+** and **pnpm 9+** (`corepack enable`).
- **Docker** (for local Postgres/Redis via compose).

### Quick Start (Dev without Docker)
```bash
corepack enable pnpm
pnpm i

# start infra locally (compose)
docker compose -f deploy/docker/compose.local.yml up -d pg redis

# run orchestrator-api in dev
pnpm --filter @realtime/orchestrator-api dev

# run realtime-gateway in dev
pnpm --filter @realtime/realtime-gateway dev

# run consumers
pnpm --filter @realtime/consumers dev

# run feeder (optional)
pnpm --filter @realtime/feeder dev

# run dashboard
pnpm --filter @realtime/dashboard dev
```

### Environment (Common)
```
DATABASE_URL=postgres://user:pass@localhost:5432/market
REDIS_URL=redis://localhost:6379
QUEUE_PREFIX=realtime
TICKS_QUEUE=ticks
PUBSUB_CHANNEL=ch:ticks
```

---

## 9) Tests

**Where:** `services/orchestrator-api/tests/unit/`  
**What:**  
- `ingest.service.test.ts` — dedupe + enqueue happy path.  
- `symbols.service.test.ts` — list & upsert.  
- `ticks.service.test.ts` — `latestTickSvc`, `tickHistorySvc`, `tickHistorySvcV2` (OHLC+SMA10), `aggMetricsSvc`.

**Run:**
```bash
pnpm --filter @realtime/orchestrator-api test:unit
```

---

## 10) Docker & Compose

- Each service has a Dockerfile under `deploy/docker/<service>/`.  
- Build & run locally:
```bash
# build all
pnpm docker:build:all

# start full stack
docker compose -f deploy/docker/compose.local.yml up -d

# logs (follow)
docker compose -f deploy/docker/compose.local.yml logs -f
```

---

## 11) CI/CD (GitHub Actions)

- Lint + Typecheck + Unit tests per package.  
- Docker build & (optionally) push to GHCR.  
- Workflows live in `.github/workflows/*.yml` (see `mono-ci.yml`).

---

## 12) Render Deployment (Reference)

See the **Render Deployment** document in the deploy folder for step‑by‑step env setup, health checks, and build commands. Key URLs:
- API: `/api/v1/health/readiness`  
- Gateway: `/health/readiness`  
- Consumers: `/ops/health/readiness`  
- Feeder: `/ops/health/readiness`

---

## 13) Security

- `x-api-key` required for `/webhooks/*`.  
- CORS restricted via env (`CORS_ALLOW_ORIGINS`, `ALLOW_ORIGINS`).  
- All services expose minimal health/metrics; avoid leaking internals.

---

## 14) Observability

- **Metrics:** Prometheus‑formatted `/ops/metrics` (where enabled).  
- **Health:** `/health/liveness`, `/health/readiness`.  
- **Logs:** JSON by default; `LOG_PRETTY=1` locally.

---

## 15) Assumptions

- Ticks are second‑granularity; minute OHLC and SMA10 derived in DB queries.  
- Volumes may be synthetic or exchange‑provided; aggregation rules are additive per (symbol,bucket).  
- No rewind on SSE; clients reconnect and refill via `/history`.

---

## 16) Deferred Work / Future Improvements

- Table partitioning & Timescale hypertables.  
- Replay/rewind via Redis Streams or Kafka.  
- Snapshot cache for `/history` per `(symbol, cursor, limit)` with TTL.  
- Rate limiting on webhooks.  
- Multi‑region active/active.

---

## 17) Appendix — SQL (SMA10 Window)

The **SMA10** is computed over the **last 10 candles** (inclusive) using a window function:

```sql
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
  AVG(c.close) OVER (
    ORDER BY c.bucket_start
    ROWS BETWEEN 9 PRECEDING AND CURRENT ROW
  ) AS sma10
FROM cand c
ORDER BY c.bucket_start DESC;
```

Interpretation: for each row (most recent minute), take the average of the `close` across that row and its **previous 9**, i.e., a 10‑point moving average.
