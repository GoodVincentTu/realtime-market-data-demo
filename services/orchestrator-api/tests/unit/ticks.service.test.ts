import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

// ---- Mocks (MUST match import specifiers used by the SUT) ----
vi.mock('../../src/utils/pagination.js', () => {
  return {
    // Default behavior: Number(val) || def
    parseLimit: vi.fn((val: unknown, _min: number, _max: number, def: number) =>
      typeof val === 'string' || typeof val === 'number'
        ? Number(val) || def
        : def
    ),
  };
});

vi.mock('../../src/repositories/ticks.repo.js', () => {
  return {
    getLatestTick: vi.fn(),
    getHistory: vi.fn(),
    getAgg1mLatest: vi.fn(),
    getOhlc1mHistoryWithSMA: vi.fn(),
  };
});

// ---- Import SUT after mocks ----
import {
  latestTickSvc,
  tickHistorySvc,
  tickHistorySvcV2,
  aggMetricsSvc,
} from '../../src/services/ticks.service.js';

// ---- Import mocked fns for assertions ----
import { parseLimit } from '../../src/utils/pagination.js';
import {
  getLatestTick,
  getHistory,
  getAgg1mLatest,
  getOhlc1mHistoryWithSMA,
} from '../../src/repositories/ticks.repo.js';

describe('ticks.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------- latestTickSvc ----------------
  describe('latestTickSvc', () => {
    it('returns latest tick when found', async () => {
      (getLatestTick as unknown as Mock).mockResolvedValue({
        symbol: 'BTCUSDT',
        price: 123.45,
        ts: 1111,
      });

      const row = await latestTickSvc('BTCUSDT');
      expect(row).toEqual({ symbol: 'BTCUSDT', price: 123.45, ts: 1111 });
      expect(getLatestTick).toHaveBeenCalledWith('BTCUSDT');
    });

    it('throws NOT_FOUND when no data', async () => {
      (getLatestTick as unknown as Mock).mockResolvedValue(null);

      await expect(latestTickSvc('BTCUSDT')).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });
      expect(getLatestTick).toHaveBeenCalledWith('BTCUSDT');
    });
  });

  // ---------------- tickHistorySvc (v1) ----------------
  describe('tickHistorySvc (raw ticks v1)', () => {
    it('uses explicit before & limit; returns items + nextCursor (last item ts)', async () => {
      (parseLimit as unknown as Mock).mockImplementation((_v, _min, _max, _def) => 3);
      (getHistory as unknown as Mock).mockResolvedValue([
        { symbol: 'BTCUSDT', price: 10, ts: 200 },
        { symbol: 'BTCUSDT', price: 9, ts: 150 },
        { symbol: 'BTCUSDT', price: 8, ts: 120 },
      ]);

      const res = await tickHistorySvc('BTCUSDT', { limit: '3', before: 9999 });
      expect(parseLimit).toHaveBeenCalledWith('3', 1, 1000, 200);
      expect(getHistory).toHaveBeenCalledWith('BTCUSDT', 9999, 3);

      expect(res.items).toHaveLength(3);
      expect(res.nextCursor).toBe(120); // last item's ts
    });

    it('defaults before to now+1s when omitted', async () => {
      // 2024-01-01T00:00:00Z => 1704067200
      vi.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));

      (parseLimit as unknown as Mock).mockImplementation((_v, _min, _max, def) => def);
      (getHistory as unknown as Mock).mockResolvedValue([]);

      const res = await tickHistorySvc('ETHUSDT', {});
      expect(parseLimit).toHaveBeenCalledWith(undefined, 1, 1000, 200);

      // expect before = floor(now/1000)+1
      const expectedBefore = 1704067201;
      expect(getHistory).toHaveBeenCalledWith('ETHUSDT', expectedBefore, 200);
      expect(res).toEqual({ items: [], nextCursor: null });
    });
  });

  // ---------------- tickHistorySvcV2 ----------------
  describe('tickHistorySvcV2', () => {
    it('raw mode when no ohlc flags (uses getHistory)', async () => {
      (parseLimit as unknown as Mock).mockImplementation((_v, _min, _max, def) => 5);
      (getHistory as unknown as Mock).mockResolvedValue([
        { symbol: 'BTCUSDT', price: 10, ts: 300 },
        { symbol: 'BTCUSDT', price: 11, ts: 250 },
        { symbol: 'BTCUSDT', price: 12, ts: 200 },
        { symbol: 'BTCUSDT', price: 13, ts: 150 },
        { symbol: 'BTCUSDT', price: 14, ts: 100 },
      ]);

      const res = await tickHistorySvcV2('BTCUSDT', { limit: 5, before: 7777 });
      expect(parseLimit).toHaveBeenCalledWith(5, 1, 2000, 200);
      expect(getHistory).toHaveBeenCalledWith('BTCUSDT', 7777, 5);
      expect(getOhlc1mHistoryWithSMA).not.toHaveBeenCalled();
      expect(res.items).toHaveLength(5);
      expect(res.nextCursor).toBe(100);
    });

    it('ohlc mode when view=ohlc1m; reverses & trims; uses limit+9 lookback', async () => {
      (parseLimit as unknown as Mock).mockImplementation((_v, _min, _max, _def) => 2);

      // Repo returns DESC (newest→oldest): 120, 110, 100
      (getOhlc1mHistoryWithSMA as unknown as Mock).mockResolvedValue([
        { symbol: 'BTCUSDT', ts: 120, open: 1, high: 3, low: 0.5, close: 2, volume: 10, sma10: 1.8 },
        { symbol: 'BTCUSDT', ts: 110, open: 1.5, high: 2.5, low: 1.2, close: 2.1, volume: 8, sma10: 1.9 },
        { symbol: 'BTCUSDT', ts: 100, open: 0.8, high: 1.7, low: 0.7, close: 1.6, volume: 9, sma10: 1.7 },
      ]);

      const res = await tickHistorySvcV2('BTCUSDT', { limit: 2, before: 5000, view: 'ohlc1m' });

      // lookback: limit + 9
      expect(getOhlc1mHistoryWithSMA).toHaveBeenCalledWith('BTCUSDT', 5000, 11);

      // After reverse → ASC: 100, 110, 120
      // Trim last 2 → 110, 120 (ASC)
      expect(res.items).toEqual([
        { symbol: 'BTCUSDT', ts: 110, open: 1.5, high: 2.5, low: 1.2, close: 2.1, volume: 8, sma10: 1.9 },
        { symbol: 'BTCUSDT', ts: 120, open: 1,   high: 3,   low: 0.5, close: 2,   volume: 10, sma10: 1.8 },
      ]);
      // nextCursor is earliest in returned page (for keyset pagination backward)
      expect(res.nextCursor).toBe(110);
    });

    it('ohlc mode also triggers when agg=1m or shape=candle', async () => {
      (parseLimit as unknown as Mock).mockReturnValue(1);
      (getOhlc1mHistoryWithSMA as unknown as Mock).mockResolvedValue([
        { symbol: 'ETHUSDT', ts: 200, open: 2, high: 3, low: 1, close: 2.5, volume: 5, sma10: 2.2 },
      ]);

      const res1 = await tickHistorySvcV2('ETHUSDT', { agg: '1m' });
      expect(getOhlc1mHistoryWithSMA).toHaveBeenCalledTimes(1);
      expect(res1.items).toHaveLength(1);
      expect(res1.nextCursor).toBe(200);

      (getOhlc1mHistoryWithSMA as unknown as Mock).mockClear();
      (getOhlc1mHistoryWithSMA as unknown as Mock).mockResolvedValue([
        { symbol: 'ETHUSDT', ts: 300, open: 3, high: 4, low: 2.5, close: 3.5, volume: 6, sma10: 3.0 },
      ]);

      const res2 = await tickHistorySvcV2('ETHUSDT', { shape: 'candle' });
      expect(getOhlc1mHistoryWithSMA).toHaveBeenCalledTimes(1);
      expect(res2.items[0].ts).toBe(300);
    });

    it('ohlc mode returns empty when repo returns empty', async () => {
      (parseLimit as unknown as Mock).mockReturnValue(10);
      (getOhlc1mHistoryWithSMA as unknown as Mock).mockResolvedValue([]);

      const res = await tickHistorySvcV2('BTCUSDT', { view: 'ohlc1m' });
      expect(res).toEqual({ items: [], nextCursor: null });
    });
  });

  // ---------------- aggMetricsSvc ----------------
  describe('aggMetricsSvc', () => {
    it('returns metrics when found', async () => {
      (getAgg1mLatest as unknown as Mock).mockResolvedValue({
        symbol: 'BTCUSDT',
        windowStart: 1000,
        windowEnd: 2000,
        count: 123,
        min: 1,
        max: 10,
        avg: 5.5,
        vwap: 5.7,
        volume: 12.3,
        last: 9,
      });

      const out = await aggMetricsSvc('BTCUSDT');
      expect(out.symbol).toBe('BTCUSDT');
      expect(getAgg1mLatest).toHaveBeenCalledWith('BTCUSDT');
    });

    it('throws NOT_FOUND when empty', async () => {
      (getAgg1mLatest as unknown as Mock).mockResolvedValue(null);
      await expect(aggMetricsSvc('BTCUSDT')).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });
    });
  });
});