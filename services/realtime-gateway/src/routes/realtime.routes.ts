import type { Router } from 'express';
import { addClient, removeClient } from '../sse/clients.js';

export function realtimeRoutes(r: Router) {
  // GET /realtime/ticks?symbol=BTCUSDT
  r.get('/realtime/ticks', (req, res) => {
    const symbol = typeof req.query.symbol === 'string' ? req.query.symbol : undefined;

    // Allow cross-origin SSE (Vite dev, etc.)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // If you use compression middleware elsewhere, make sure it’s DISABLED for this route.

    const id = addClient(res, symbol);

    const cleanup = () => removeClient(id);
    req.on('close', cleanup);
    req.on('end', cleanup);
    req.on('error', cleanup);
  });
}