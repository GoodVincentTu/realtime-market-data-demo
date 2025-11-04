export function parseLimit(raw: unknown, min = 1, max = 1000, dflt = 200) {
  const n = Number(raw ?? dflt);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, Math.floor(n)));
}