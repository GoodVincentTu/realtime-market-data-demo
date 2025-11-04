# Realtime Market Data Demo – Monorepo

A full demo stack for real‑time market data with **REST + SSE**, a **batching consumer**, and a **React dashboard**.

- **orchestrator-api** — REST API (ingest webhooks, query endpoints, Swagger)
- **realtime-gateway** — SSE fanout (subscribes Redis pub/sub and streams to browsers)
- **consumers** — batches ticks, writes `ticks_raw` / `ticks_history` / `ticks_recent` and rolls **metrics_1m** + **ohlc_1m**
- **feeder** — synthetic tick generator (POSTs to orchestrator-api webhooks)
- **dashboard** — React/Vite app (candles + **SMA10** overlay + volume histogram) with live updates via SSE

---

## Folder structure

```
project_root/
├─ deploy/
│  ├─ docker/
│  │  ├─ consumers/               # Dockerfile + runtime scripts (if any)
│  │  ├─ dashboard/
│  │  ├─ feeder/
│  │  ├─ orchestrator-api/
│  │  └─ realtime-gateway/
│  └─ helm/                       # Charts per service (k8s deploy) - demo only
├─ frontend/
│  └─ dashboard/                  # React/Vite app
├─ services/
│  ├─ consumers/                  # worker: batcher + calc-a/b modules
│  ├─ feeder/                     # simple generator -> POST /webhooks/ticks
│  ├─ orchestrator-api/           # Express API, Swagger, repo layer
│  └─ realtime-gateway/           # Express SSE -> subscribes Redis channel
├─ pnpm-workspace.yaml
└─ package.json
```

---

## Data model (key tables/views)

- `ticks_raw` — audit stream (optional but useful for forensics)
- `ticks_history` — deduped tick stream with `volume`; **`ticks_recent`** view for latest rows
- `metrics_1m` — minute rollups (min/max/avg/vwap/volume/last)
- `ohlc_1m` — candle per minute (open/high/low/close/volume)

> **SMA10** is computed **at query time** from `ohlc_1m` via SQL window functions and returned by `GET /ticks/:symbol/history?view=ohlc1m`.

### Live flow

```
feeder ──POST /api/v1/webhooks/ticks──► orchestrator-api
   │                                      │
   │                                      ├─► Redis pub/sub (ch:ticks)
   │                                      └─► enqueue/batch (BullMQ/queue)
consumers ◄───────── batched ticks ◄──────┘
   ├─► ticks_raw / ticks_history / ticks_recent
   ├─► metrics_1m / ohlc_1m
   └─► publish latest per symbol → Redis pub/sub

realtime-gateway subscribes Redis pub/sub → serves SSE to dashboard
```

---

## Prerequisites

- Docker + Docker Compose
- Node 20 + pnpm (needed to run database migrations; recommended even if you mainly run with Docker)

---

## Quick start (Docker Compose)

> From `project_root/`

```bash
# Build everything
docker compose -f deploy/docker/docker-compose.yaml build
```

### First run (migrations + service order)

1. Start infra only (Postgres + Redis):
   ```bash
   docker compose -f deploy/docker/docker-compose.yaml up -d postgres redis
   ```
2. Install dependencies once if you have not already:
   ```bash
   corepack enable
   pnpm i
   ```
3. Run the orchestrator migrations against the compose database:
   ```bash
   DATABASE_URL=postgres://app:app@localhost:5432/market \
     pnpm -C services/orchestrator-api exec node-pg-migrate up -m migrations
   ```
4. Start the core app services (orchestrator, realtime gateway, consumers, dashboard):
   ```bash
   docker compose -f deploy/docker/docker-compose.yaml up -d orchestrator-api realtime-gateway consumers dashboard
   ```
5. Start the feeder last so it can upsert the active symbols once:
   ```bash
   docker compose -f deploy/docker/docker-compose.yaml up -d feeder
   ```

For subsequent restarts (after migrations are in place), you can bring the stack back with:

```bash
docker compose -f deploy/docker/docker-compose.yaml up -d
```

Tail logs anytime with:

```bash
docker compose -f deploy/docker/docker-compose.yaml logs -f
```

Open **http://localhost:8080** for the dashboard.

Stop & wipe volumes:

```bash
docker compose -f deploy/docker/docker-compose.yaml down -v
```

### Default ports

| service           | port | purpose                                 |
|-------------------|------|-----------------------------------------|
| dashboard         | 8080 | frontend UI                             |
| orchestrator-api  | 3030 | REST (`/api/v1`) + Swagger dev UI (`/docs`) |
| realtime-gateway  | 4000 | SSE (`/realtime/ticks`)                  |
| postgres          | 5432 | DB                                      |
| redis             | 6379 | cache/pubsub                            |

---

## Environment & build args

Compose sets sensible dev defaults:

- `DATABASE_URL=postgres://app:app@postgres:5432/market`
- `REDIS_URL=redis://redis:6379/0`
- `API_KEY=dev-key` (required for `POST /api/v1/webhooks/*`)
- `PUBSUB_CHANNEL=ch:ticks`

Frontend **build args** (baked into JS at build time):

- `VITE_API_BASE_URL` (default in compose: `http://localhost:3030/api/v1`)
- `VITE_REALTIME_URL` (default in compose: `http://localhost:4000/realtime/ticks`)

> If you change the REST base path, update both build args and the fallback in `frontend/dashboard/src/api/client.ts`.

---

## Verifying the stack

With compose running:

```bash
# Health
curl http://localhost:3030/api/v1/health/liveness
curl http://localhost:3030/api/v1/health/readiness

# (Optional) Seed symbols
curl -X POST http://localhost:3030/api/v1/webhooks/symbols \
  -H 'x-api-key: dev-key' -H 'content-type: application/json' \
  -d '{"items":[{"symbol":"BTCUSDT","base":"BTC","quote":"USDT","active":true}]}'

# Watch SSE (should emit after ticks flow in)
curl -N "http://localhost:4000/realtime/ticks?symbol=BTCUSDT"

# Get candles (OHLC + volume + SMA10)
curl "http://localhost:3030/api/v1/ticks/BTCUSDT/history?view=ohlc1m&limit=30"
```

Open the UI: **http://localhost:8080**

---

## Developing locally (without Docker)

```bash
# Install
corepack enable
pnpm i

# Start only infra using compose
docker compose -f deploy/docker/docker-compose.yaml up -d postgres redis

# Run migrations (uses the compose Postgres URL)
DATABASE_URL=postgres://username:password@localhost:5432/market \
  pnpm -C services/orchestrator-api exec node-pg-migrate up -m migrations

# or
cd services/orchestrator-api && pnpm migrate:up:dev

# Start services (new terminals/tabs)
pnpm -w --filter @realtime/orchestrator-api dev
pnpm -w --filter @realtime/realtime-gateway dev
pnpm -w --filter @realtime/consumers dev
pnpm -w --filter @realtime/feeder dev           # start this last; seeds active symbols once
pnpm -w --filter @realtime/dashboard dev        # dashboard dev server on http://localhost:5173
```

Ensure your dev env points to the same Postgres/Redis as compose (or provide local equivalents).

---

## Troubleshooting

- **Dashboard can’t reach API**  
  Verify `VITE_API_BASE_URL` and `VITE_REALTIME_URL` (they’re compiled into the bundle). When running the built Nginx image locally, they should be `http://localhost:3030/api/v1` and `http://localhost:4000/realtime/ticks`. The Vite dev server (`pnpm -w --filter @realtime/dashboard dev`) runs on `http://localhost:5173`; set `VITE_API_BASE_URL=http://localhost:3030/api/v1` when you need a custom origin.

- **SSE shows nothing**  
  Make sure `feeder` is running _or_ you’re posting ticks to `/api/v1/webhooks/ticks` (with `x-api-key: dev-key`).

- **Candle/SMA gaps**  
  Confirm `consumers` is running; it rolls `ohlc_1m` and `metrics_1m`. The API computes `sma10` from `ohlc_1m` at request time.

- **DB schema not present**  
  Re-run the migration command from the Quick start (`pnpm -C services/orchestrator-api exec node-pg-migrate up -m migrations` with `DATABASE_URL=postgres://app:app@localhost:5432/market`).

- **CORS**  
  The Nginx-hosted dashboard calls `localhost` API/SSE by default. If you proxy through another host, adjust build args accordingly.

---

## License

MIT (demo purposes).
