import http from 'node:http';
import { registry } from '../metrics/metrics.js';

export function startOpsServer(port: number) {
  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    if (url === '/ops/health/liveness') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (url === '/ops/health/readiness') {
      // no external deps to probe here; orchestrator reachability is checked on send
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ready', checks: { self: 'ok' } }));
      return;
    }
    if (url === '/ops/metrics') {
      res.writeHead(200, { 'content-type': registry.contentType });
      res.end(await registry.metrics());
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'NOT_FOUND' } }));
  });
  server.listen(port);
  return server;
}