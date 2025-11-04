import type { Tick } from "../domain/types";

/**
 * Append a live tick while keeping the array:
 * - strictly ascending by ts
 * - replacing the last element if ts is the same second
 * - bounded to `limit` items
 */
export function appendMonotonic(prev: Tick[], msg: Tick, limit = 300): Tick[] {
  if (!prev.length) return [msg];

  const last = prev[prev.length - 1];
  if (msg.ts < last.ts) {
    // drop out-of-order older events
    return prev;
  }
  if (msg.ts === last.ts) {
    const copy = prev.slice();
    copy[copy.length - 1] = msg;   // coalesce same-second tick
    return copy;
  }
  const next = prev.length >= limit ? prev.slice(-(limit - 1)) : prev.slice();
  next.push(msg);
  return next;
}

/**
 * Merge bootstrap history (ASC) with live ticks:
 * - keeps only live ticks with ts > last history ts
 * - sorts the live slice just in case SSE bursts arrive out of order
 */
export function mergeHistoryLive(history: Tick[], live: Tick[]): Tick[] {
  const lastTs = history.length ? history[history.length - 1].ts : 0;
  const fresh = live.filter(t => t.ts > lastTs).sort((a, b) => a.ts - b.ts);
  return [...history, ...fresh];
}