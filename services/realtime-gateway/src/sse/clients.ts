import type { Response } from 'express';
import { sseConnections, sseEventsSent, sseEventsDropped } from '../metrics/metrics.js';
import { enrichTick } from './agg_ohlc.js';

type TickMsg = { symbol: string; price: number; ts: number | string; volume?: number };

type Client = {
  id: string;
  res: Response;
  filterSymbol?: string;
  keepalive: NodeJS.Timeout;
};

const clients = new Map<string, Client>();

function write(res: Response, obj: unknown) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

export function addClient(res: Response, filterSymbol?: string): string {
  const id = Math.random().toString(36).slice(2);
  const keepalive = setInterval(() => {
    // comment lines are valid SSE keepalives
    res.write(`: ping ${Date.now()}\n\n`);
  }, 15000);

  clients.set(id, { id, res, filterSymbol, keepalive });
  sseConnections.inc();

  // send initial ack
  write(res, { ok: true, connectedAt: Date.now(), filterSymbol: filterSymbol ?? null });
  return id;
}

export function removeClient(id: string) {
  const c = clients.get(id);
  if (!c) return;
  clearInterval(c.keepalive);
  try { c.res.end(); } catch {}
  clients.delete(id);
  sseConnections.dec();
}

export function broadcastTick(raw: string) {
  try {
    const enriched = enrichTick(JSON.parse(raw));
    for (const [, c] of clients) {
      if (c.filterSymbol && enriched.symbol !== c.filterSymbol) continue;
      if (c.res.writableEnded) { sseEventsDropped.inc(); continue; }
      c.res.write(`data: ${JSON.stringify(enriched)}\n\n`);
      try {
        sseEventsSent.inc();
      } catch {
        sseEventsDropped.inc();
      }
    }
  } catch {
    // drop silently
    console.warn('failed to enrich tick');
  }
}

export function size() { return clients.size; }