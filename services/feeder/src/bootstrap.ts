import axios from 'axios';

export async function upsertSymbolsOnce(): Promise<void> {
  const base = process.env.ORCHESTRATOR_BASE_URL || 'http://localhost:3030/api/v1';
  const apiKey = process.env.ORCHESTRATOR_API_KEY || 'dev-key';
  const symbols = (process.env.SYMBOLS ?? 'BTCUSDT,ETHUSDT')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const items = symbols.map(s => ({
    symbol: s,
    base: s.replace(/USDT|USD$/,'') || s,          // naive split ok for demo
    quote: /USDT$/.test(s) ? 'USDT' : (/USD$/.test(s) ? 'USD' : ''),
    active: true,
  }));

  try {
    await axios.post(`${base}/webhooks/symbols`, { items }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,              // ← use API key header
      },
      timeout: 15000,
    });
    console.log(`[feeder] upserted ${items.length} symbols`);
  } catch (err: any) {
    const msg = err?.response?.data ?? err?.message ?? err;
    console.error('[feeder] upsert symbols failed:', msg);
    throw err;
  }
}