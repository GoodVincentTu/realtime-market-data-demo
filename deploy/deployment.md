# Render Deployment

> Services: **orchestrator-api**, **realtime-gateway**, **consumers** (worker), **feeder**, **dashboard** (frontend).  
> Managed dependencies: **Render Postgres**, **Render Redis**.  
> Default API prefix: `/api/v1`.

---

## 0) Prep & Assumptions

- Your repo’s default branch is `main`, connected to Render.
- You will provision **Render Postgres** and **Render Redis** first.
- All services use **Docker** except the frontend which is a **Static Site** (built by Render).
- The Postgres URL must include `?sslmode=require` for both **migrations** and **runtime**.

**Monorepo layout (excerpt):**
```
project_root/
├─ deploy/
│  ├─ docker/
│  │  ├─ consumers/
│  │  ├─ dashboard/
│  │  ├─ feeder/
│  │  ├─ orchestrator-api/
│  │  └─ realtime-gateway/
│  └─ helm/               # (k8s charts for future prod)
├─ frontend/
│  └─ dashboard/
├─ services/
│  ├─ consumers/
│  ├─ feeder/
│  ├─ orchestrator-api/
│  └─ realtime-gateway/
└─ pnpm-workspace.yaml
```

---

## 1) Provision Managed DB & Cache

1. **Render Postgres** → create a new instance. Copy its **External Connection String** and append `?sslmode=require`. Example:
   ```
   DATABASE_URL=postgres://<user>:<pass>@<host>:5432/<db>?sslmode=require
   ```
2. **Render Redis** → create a new instance. Copy the `REDIS_URL`, e.g.:
   ```
   REDIS_URL=redis://:<password>@<host>:6379
   ```

Keep these values handy; you’ll re‑use them across services.

---

## 2) Shared Environment & Queue Conventions

All queue/publish settings must be consistent across services:

```
QUEUE_PREFIX=realtime
TICKS_QUEUE=ticks
PUBSUB_CHANNEL=ch:ticks
```

Optional logging:
```
LOG_LEVEL=info
LOG_PRETTY=0
```

CORS (restrict to your dashboard & gateway origins in production):
```
CORS_ALLOW_ORIGINS=https://your-dashboard.onrender.com,https://your-gateway.onrender.com
```

---

## 3) Database Migrations (run once per schema change)

Run locally (or from a CI runner) **before** bringing workers online:

```bash
# From project root with Node 20+ and pnpm enabled
export DATABASE_URL="postgres://.../market?sslmode=require"

pnpm install --frozen-lockfile
pnpm --filter @realtime/orchestrator-api exec node-pg-migrate up -m migrations
```

**Idempotent:** safe to re-run; it will only apply pending migrations.

---

## 4) Service Deployments on Render

### 4.1 Orchestrator API (Docker Web Service)

- **Dockerfile:** `deploy/docker/orchestrator-api/Dockerfile`
- **Health Check:** `GET /api/v1/health/readiness`

**Env (required):**
```
DATABASE_URL=postgres://.../market?sslmode=require
REDIS_URL=redis://...

API_PREFIX=/api/v1
API_KEY=<strong-secret-for-webhooks>

QUEUE_PREFIX=realtime
TICKS_QUEUE=ticks
PUBSUB_CHANNEL=ch:ticks
```

**Env (optional):**
```
CORS_ALLOW_ORIGINS=*
LOG_LEVEL=info
LOG_PRETTY=0
```

> The API exposes:
> - `GET /api/v1/symbols`
> - `GET /api/v1/ticks/{symbol}`
> - `GET /api/v1/ticks/{symbol}/history` (raw ticks)  
> - `GET /api/v1/ticks/{symbol}/history?view=ohlc1m` (candles + volume + `sma10`)  
> - `GET /api/v1/metrics/{symbol}` (aggregated snapshot)  
> - `POST /api/v1/webhooks/symbols` (requires `x-api-key`)  
> - `POST /api/v1/webhooks/ticks` (requires `x-api-key`)

---

### 4.2 Realtime Gateway (Docker Web Service)

- **Dockerfile:** `deploy/docker/realtime-gateway/Dockerfile`
- **Health Check:** `GET /health/readiness`
- **Purpose:** SSE fan‑out from Redis Pub/Sub to browsers.

**Env:**
```
REDIS_URL=redis://...
PUBSUB_CHANNEL=ch:ticks

# CORS/same-site hardening
ALLOW_ORIGINS=https://your-dashboard.onrender.com

# SSE tuning (optional)
SSE_KEEPALIVE_MS=15000
SSE_CLIENT_BUFFER=256
LOG_LEVEL=info
```

**Public endpoint:** `GET /realtime/ticks?symbol=BTCUSDT` (SSE).

---

### 4.3 Consumers Worker (Docker Web Service)

- **Dockerfile:** `deploy/docker/consumers/Dockerfile`
- **Health Check:** `GET /ops/health/readiness`
- **Purpose:** batch ingest → write `ticks_raw`, `ticks_history`, update `ticks_recent`, compute `metrics_1m` & `ohlc_1m`, and publish latest ticks.

**Env:**
```
DATABASE_URL=postgres://.../market?sslmode=require
REDIS_URL=redis://...
QUEUE_PREFIX=realtime
TICKS_QUEUE=ticks
PUBSUB_CHANNEL=ch:ticks

# Batching knobs
BATCH_MAX=500
BATCH_FLUSH_MS=200
WORKER_CONCURRENCY=1

LOG_LEVEL=info
LOG_PRETTY=0
```

> The worker binds an ops server to Render’s injected `PORT` for health checks.

---

### 4.4 Feeder (Docker Web Service)

- **Dockerfile:** `deploy/docker/feeder/Dockerfile`
- **Health Check:** `GET /ops/health/readiness`
- **Purpose:** demo tick generator that calls the API webhook (`/webhooks/ticks`) with `x-api-key`.

**Env:**
```
ORCHESTRATOR_BASE_URL=https://<your-api-host>/api/v1
ORCHESTRATOR_API_KEY=<same-as-API_KEY>

# Workload
SYMBOLS=BTCUSDT,ETHUSDT
RPS=5
BATCH_SIZE=20
FLUSH_MS=500
JITTER=0.1

# Price model
PRICE_BASE=68000
VOLATILITY=0.02

# Retries (optional)
RETRY_ATTEMPTS=3
RETRY_BACKOFF_MS=500
LOG_LEVEL=info
```

---

### 4.5 Dashboard (Static Site)

- **Type:** Static Site (not Docker)
- **Build Command:**
  ```bash
  corepack enable pnpm
  pnpm install --frozen-lockfile
  pnpm --filter @realtime/dashboard build
  ```
- **Publish Directory:** `frontend/dashboard/dist`

**Build‑time env:**
```
VITE_API_BASE_URL=https://<your-api-host>/api/v1
VITE_REALTIME_URL=https://<your-gateway-host>/realtime/ticks
```

> The static site will call the API and subscribe to the gateway SSE using these URLs.

---

## 5) DNS & TLS

- Keep Render subdomains for a first pass. Later, add **Custom Domains** per service.
- For production, prefer **HTTPS‑only** endpoints and pin CORS to your public origins.

---

## 6) Verification Checklist

**Health:**
```bash
# API
curl -fsS https://<api>/api/v1/health/readiness | jq

# Gateway
curl -fsSI https://<gateway>/health/readiness

# Consumers
curl -fsS https://<consumers>/ops/health/readiness | jq

# Feeder
curl -fsS https://<feeder>/ops/health/readiness | jq
```

**Symbols:**
```bash
curl -fsS https://<api>/api/v1/symbols | jq
```

**Ingest (requires x-api-key):**
```bash
curl -fsS -X POST https://<api>/api/v1/webhooks/ticks \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{"source":"demo","items":[{"symbol":"BTCUSDT","price":68001.23,"ts":1730425200,"volume":0.5}]}' | jq
```

**SSE:**
```bash
curl -N https://<gateway>/realtime/ticks?symbol=BTCUSDT
# Expect data: {"symbol":"BTCUSDT","price":...,"ts":...,"volume":...,"sma10":...,"candle1m":{...}}
```

**Candles (with SMA10 & volume):**
```bash
curl -fsS \
  "https://<api>/api/v1/ticks/BTCUSDT/history?view=ohlc1m&limit=50" | jq
```

---

## 7) Troubleshooting

- **DB migrations failed:** Ensure `?sslmode=require` is appended; check DB IP allowlist.
- **API 401 on webhooks:** Missing or wrong `x-api-key`; verify `API_KEY` secret on Render.
- **SSE not streaming:** Verify `realtime-gateway` can reach Redis, and that **consumers** are publishing.
- **CORS errors:** Tighten/loosen `CORS_ALLOW_ORIGINS`/`ALLOW_ORIGINS` to include your frontend & gateway.
- **High latency:** Increase `BATCH_MAX` or reduce `BATCH_FLUSH_MS`; scale out **consumers** and **realtime-gateway**.
- **Volume/SMA mismatch:** Confirm **consumers** are updating `metrics_1m`/`ohlc_1m`; API `view=ohlc1m` should reflect those.

---

## 8) Rollback & Zero‑Downtime

- Use Render’s **Manual Rollback** from the previous successful build.
- For Docker services, keep image tags immutable and roll forward with a new tag.
- The SSE gateway can run **multiple instances**; use Render autoscaling for resilience.

---

## 9) Maintenance

- Rerun migrations on schema changes.
- Periodic DB VACUUM/ANALYZE (Render Postgres performs routine maintenance; monitor size & IOPS).
- Configure log retention and metrics scraping; consider exporting Prometheus to external storage.

---

## 10) Quick Reference (per service)

| Service            | Type            | Dockerfile                                        | Health Path                         |
|--------------------|-----------------|----------------------------------------------------|-------------------------------------|
| orchestrator-api   | Docker Web      | `deploy/docker/orchestrator-api/Dockerfile`       | `/api/v1/health/readiness`          |
| realtime-gateway   | Docker Web      | `deploy/docker/realtime-gateway/Dockerfile`       | `/health/readiness`                 |
| consumers          | Docker Web (wrk)| `deploy/docker/consumers/Dockerfile`              | `/ops/health/readiness`             |
| feeder             | Docker Web      | `deploy/docker/feeder/Dockerfile`                 | `/ops/health/readiness`             |
| dashboard          | Static Site     | *(Render build using pnpm)*                        | *(N/A — static)*                    |