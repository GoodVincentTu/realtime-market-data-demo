import { describe, it, expect, vi } from 'vitest';

// Mock repo under test
vi.mock('../../src/repositories/symbols.repo.ts', async () => {
  return {
    listActiveSymbols: vi.fn().mockResolvedValue([
      { symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', active: true }
    ]),
    upsertSymbols: vi.fn().mockResolvedValue(1)
  };
});

import { listSymbolsSvc, upsertSymbolsSvc } from '../../src/services/symbols.service.js';

describe('symbols.service', () => {
  it('lists symbols', async () => {
    const rows = await listSymbolsSvc();
    expect(rows[0].symbol).toBe('BTCUSDT');
  });

  it('upserts symbols', async () => {
    const res = await upsertSymbolsSvc([{ symbol: 'ETHUSDT', base: 'ETH', quote: 'USDT', active: true }]);
    expect(res.upserted).toBe(1);
  });
});