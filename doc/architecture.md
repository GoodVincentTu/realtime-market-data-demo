# Market Data Demo — Architecture (Implementation / Demo)

## Overview
This repo demonstrates a simplified market-data style pipeline with separate responsibilities:

- **services/feeder**: simulates multiple exchange-like sources and POSTs ticks to the backend (env-driven).
- **services/orchestrator-api** (previously “api-server”): receives webhook ticks, validates, pushes them to Redis/BullMQ, exposes normal REST endpoints for dashboards, and publishes change events to the realtime service.
- **services/realtime-gateway** (previously “connection-service”): maintains SSE / WebSocket connections to browser clients and receives update events from orchestrator-api via **Redis pub/sub**.
- **services/consumers**: BullMQ workers that read from Redis queues, perform domain calculations (calc-a, calc-b), and notify orchestrator-api about new aggregate values.
- **frontend/dashboard**: Vite/React dashboard that shows live updates and can fetch history via REST.

We deploy everything as separate services so we can scale the hot paths independently.

## Dataflow (demo)
1. **feeder → orchestrator-api**  
   - `POST /ingest/tick` with `{ symbol, price, volume, ts, source, event_id }`
   - orchestrator-api **does NOT** write raw ticks directly to Postgres in the fast path to avoid DB IOPS spikes.
   - orchestrator-api enqueues the tick to Redis/BullMQ (`queue: ticks.received`)

2. **orchestrator-api → realtime-gateway**  
   - orchestrator-api also publishes an event to Redis pub/sub `md.events` (or `realtime:updates`) so connected clients can see “something changed” immediately.
   - this is a *soft* fast-path; real aggregates will arrive after calc.

3. **consumers (calc-a, calc-b)**  
   - calc-a: consumes `ticks.received`, runs per-symbol/per-window logic, and emits `calcA.done`.
   - calc-b: consumes `calcA.done` (and/or the original tick) to produce a final view `W`.
   - calc-b calls **orchestrator-api** `POST /internal/agg-update` so the API can store/update canonical state.

4. **orchestrator-api → Postgres (batched)**  
   - instead of writing every tick 1-by-1, the service keeps **small batches in Redis** and flushes to Postgres on:
     - timer (e.g. every 1–5s), or
     - batch size reached (e.g. 200 ticks)
   - this **risks losing the last batch** if the service dies → we **document** it as a demo trade-off.

5. **orchestrator-api → realtime-gateway → browser**  
   - after it receives `agg-update`, orchestrator-api publishes again to Redis pub/sub.
   - realtime-gateway fans out via SSE/WS to all connected dashboards.

## Why buffer in Redis first?
During napkin estimation we saw that even a modest “5–20 ticks/sec × few symbols” can **burst** if:
- feeder rate is increased
- we add more symbols
- we run multiple feeders

Writing **every** tick to Postgres would associate our ingest SLA with DB write performance. To keep the demo responsive, we:
- **enqueue ticks in Redis first**
- **flush to Postgres in batches**
- **accept that we may lose the last batch** (documented)

This is acceptable for the take-home, and we can point to the scalable version in `architecture-scale.md`.

## APIs (demo)
- `POST /ingest/tick`
- `POST /internal/agg-update`
- `GET /symbols`
- `GET /tickets/:symbol`
- `GET /tickets/:symbol/history?limit=1000`
- `GET /health/liveness`
- `GET /health/readiness`
- `GET /metrics`

## Auth (demo)
- We will keep a simple `INGEST_USERNAME` / `INGEST_PASSWORD` in env.
- `POST /ingest/tick` requires basic auth with those credentials.
- This is enough to show we thought about the trust boundary.