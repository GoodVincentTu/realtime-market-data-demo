import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

// IMPORTANT: mock paths must match the SUT import specifiers (".js")
vi.mock('../../src/redis/index.js', () => {
  return {
    redis: {
      sadd: vi.fn(),                 // will set per test
      expire: vi.fn(),               // NEW: service calls expire now
    },
    redisPub: {
      publish: vi.fn(),              // used for realtime fanout
    },
  };
});

vi.mock('../../src/queue/bull.js', () => {
  return {
    enqueueTicks: vi.fn(async (jobs: unknown[]) => jobs), // echo back the jobs
  };
});

import { ingestTicksSvc } from '../../src/services/ingest.service.js';
import { redis, redisPub } from '../../src/redis/index.js';
import { enqueueTicks } from '../../src/queue/bull.js';

describe('ingest.service', () => {
  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    // default happy-path mocks
    (redis.sadd as unknown as Mock).mockResolvedValue(1);     // "new" in SADD set
    (redis.expire as unknown as Mock).mockResolvedValue(1);   // ok
    (redisPub.publish as unknown as Mock).mockResolvedValue(1);
    (enqueueTicks as unknown as Mock).mockImplementation(async (jobs: unknown[]) => jobs);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('accepts and enqueues new ticks', async () => {
    const res = await ingestTicksSvc('feeder', [
      { symbol: 'BTCUSDT', price: 1, ts: 1704067200, volume: 0.5 },
    ]);

    expect(res.accepted).toBe(1);
    expect(res.queued).toBe(1);
    expect(res.duplicates).toBe(0);
    expect(res.rejected).toBe(0);
    expect(res.skipped).toBe(0);

    // sanity checks on mocks
    expect(redis.sadd).toHaveBeenCalledTimes(1);
    expect(redis.expire).toHaveBeenCalledTimes(1);
    expect(redisPub.publish).toHaveBeenCalledTimes(1);
    expect(enqueueTicks).toHaveBeenCalledTimes(1);

    const jobsArg = (enqueueTicks as unknown as Mock).mock.calls[0][0];
    expect(Array.isArray(jobsArg)).toBe(true);
    expect(jobsArg[0]).toMatchObject({
      symbol: 'BTCUSDT',
      price: 1,
      ts: 1704067200,
      volume: 0.5,
      source: 'feeder',
    });
  });

  it('dedupes duplicates when SADD returns 0', async () => {
    (redis.sadd as unknown as Mock).mockResolvedValue(0);

    const res = await ingestTicksSvc('feeder', [
      { symbol: 'BTCUSDT', price: 1, ts: 1704067200 },
    ]);

    expect(res.accepted).toBe(0);
    expect(res.duplicates).toBe(1);
    expect(res.queued).toBe(0);
    expect(enqueueTicks).not.toHaveBeenCalled();
  });

  it('skips invalid price inputs', async () => {
    const res = await ingestTicksSvc('feeder', [
      // invalid
      { symbol: 'BTCUSDT', price: Number.NaN, ts: 1704067200 },
      // valid
      { symbol: 'BTCUSDT', price: 123, ts: 1704067260 },
    ]);

    expect(res.skipped).toBe(1);
    expect(res.accepted).toBe(1);
    expect(res.queued).toBe(1);
  });
});