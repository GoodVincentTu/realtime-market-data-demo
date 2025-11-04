import { fetch } from 'undici';
import { cfg } from '../config/index.js';
import { httpLatency, postAttempts } from '../metrics/metrics.js';


export type WebhookTickItem = {
  symbol: string;
  ts: number;        // epoch seconds
  price: number;
  volume?: number;   // real size if you have it (default: 0)
  idempotencyKey?: string;
};

export async function postTicksBatch(items: WebhookTickItem[]) {
  const body = JSON.stringify({ source: cfg.source, items });
  const url = `${cfg.baseUrl}/webhooks/ticks`;

  let attempt = 0;
  const endTimer = httpLatency.startTimer();
  for (;;) {
    attempt++;
    try {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), cfg.timeoutMs);

      const res = await fetch(url, {
        method: 'POST',
        body,
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.apiKey,
        },
        signal: ac.signal,
      });
      clearTimeout(to);

      if (res.ok || res.status === 202) {
        postAttempts.inc({ status: 'ok' });
        endTimer();
        return;
      }
      // treat 4xx as terminal
      postAttempts.inc({ status: `http_${res.status}` });
      endTimer();
      if (res.status >= 400 && res.status < 500) return;

      // 5xx → retry
      if (attempt > cfg.retry) return;
    } catch {
      // network/abort → retry
      if (attempt > cfg.retry) return;
    }
    // backoff
    const sleep = cfg.retryBaseMs * Math.pow(2, attempt - 1);
    await new Promise(r => setTimeout(r, sleep));
  }
}