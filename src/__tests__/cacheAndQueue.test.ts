import { describe, it, expect, beforeEach } from 'vitest';
import { getCachedCandles, setCachedCandles, getCacheStats } from '../lib/data/candleCache';
import { twelveDataQueue } from '../lib/data/twelveDataQueue';
import type { Candle } from '../lib/types';

describe('CandleCache', () => {
  const dummyCandles: Candle[] = [
    { timestamp: 1000, open: 1.08, high: 1.09, low: 1.07, close: 1.085 },
    { timestamp: 2000, open: 1.085, high: 1.095, low: 1.08, close: 1.09 },
  ];

  it('stores and retrieves cached candles correctly', () => {
    setCachedCandles('EUR/USD', '1h', dummyCandles);
    const result = getCachedCandles('EUR/USD', '1h');

    expect(result).not.toBeNull();
    expect(result?.candles.length).toBe(2);
    expect(result?.isStale).toBe(false);
    expect(result?.candles[0].close).toBe(1.085);
  });

  it('handles symbol casing and slash normalization', () => {
    setCachedCandles('GBP/USD', '4h', dummyCandles);
    const result = getCachedCandles('gbpusd', '4h');

    expect(result).not.toBeNull();
    expect(result?.candles.length).toBe(2);
  });

  it('reports cache statistics', () => {
    const stats = getCacheStats();
    expect(stats.totalEntries).toBeGreaterThan(0);
    expect(stats.validEntries).toBeGreaterThan(0);
  });
});

describe('TwelveDataQueue', () => {
  it('executes tasks asynchronously through the throttler', async () => {
    let executed = false;
    const result = await twelveDataQueue.execute(async () => {
      executed = true;
      return 42;
    });

    expect(executed).toBe(true);
    expect(result).toBe(42);
  });
});

