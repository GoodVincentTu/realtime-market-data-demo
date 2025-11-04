import type { UTCTimestamp } from 'lightweight-charts';

export const toUtc = (ts: number): UTCTimestamp => (Math.floor(ts) as UTCTimestamp);

// Replace last if same time; append if newer; binary insert if out of order.
export function upsertAsc<T extends { time: UTCTimestamp }>(arr: T[], next: T): T[] {
  if (arr.length === 0) return [next];

  const last = arr[arr.length - 1];
  if (next.time === last.time) {
    const copy = arr.slice(0, -1);
    copy.push(next as T);
    return copy;
  }
  if (next.time > last.time) {
    return [...arr, next as T];
  }

  // Rare: out-of-order insert
  const copy = arr.slice();
  let lo = 0, hi = copy.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (copy[mid].time < next.time) lo = mid + 1; else hi = mid - 1;
  }
  copy.splice(lo, 0, next as T);
  if (lo + 1 < copy.length && copy[lo + 1].time === next.time) copy.splice(lo + 1, 1);
  return copy;
}