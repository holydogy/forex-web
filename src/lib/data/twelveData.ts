// ─────────────────────────────────────────────────────
// Twelve Data API Client
// Fully throttled and cached to strictly respect the 8 calls/min limit
// ─────────────────────────────────────────────────────

import type { Candle, Timeframe, TwelveDataTimeSeries } from '../types';
import { getCachedCandles, setCachedCandles } from './candleCache';
import { twelveDataQueue } from './twelveDataQueue';
import { getSamplePairData } from './sampleHistoricalData';

const BASE_URL = 'https://api.twelvedata.com';

const TIMEFRAME_MAP: Record<Timeframe, string> = {
  '1day': '1day',
  '4h': '4h',
  '1h': '1h',
  '15min': '15min',
};

const OUTPUT_SIZE: Record<Timeframe, number> = {
  '1day': 120,   // ~6 months of daily
  '4h': 180,     // ~4.5 weeks of 4H
  '1h': 240,     // ~10 days of 1H
  '15min': 300,  // ~3 days of 15M
};

/**
 * Fetch OHLC candles with transparent caching and rate limiting.
 *
 * @param symbol       - Pair e.g. "EUR/USD"
 * @param timeframe    - Timeframe
 * @param apiKey       - Twelve Data API Key
 * @param forceRefresh - Force ignore cache
 */
export async function fetchCandles(
  symbol: string,
  timeframe: Timeframe,
  apiKey: string,
  forceRefresh: boolean = false,
): Promise<Candle[]> {
  // 1. Check cache first
  const cached = getCachedCandles(symbol, timeframe);
  if (!forceRefresh && cached && !cached.isStale && cached.candles.length > 0) {
    return cached.candles;
  }

  // 2. Fetch through the throttler queue
  try {
    const candles = await twelveDataQueue.execute(async () => {
      const interval = TIMEFRAME_MAP[timeframe];
      const size = OUTPUT_SIZE[timeframe];

      const url = new URL(`${BASE_URL}/time_series`);
      url.searchParams.set('symbol', symbol);
      url.searchParams.set('interval', interval);
      url.searchParams.set('outputsize', String(size));
      url.searchParams.set('apikey', apiKey);
      url.searchParams.set('format', 'JSON');
      url.searchParams.set('timezone', 'UTC');

      console.log(`[TwelveData] Requesting live API: ${symbol} (${timeframe})...`);
      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Twelve Data API error: ${response.status} ${response.statusText}`);
      }

      const data: TwelveDataTimeSeries = await response.json();

      if (data.status === 'error') {
        const errorMsg = JSON.stringify(data);
        if (errorMsg.includes('429') || errorMsg.includes('API credits')) {
          throw new Error(`Twelve Data 429: API credits limit reached`);
        }
        throw new Error(`Twelve Data API error: ${errorMsg}`);
      }

      if (!data.values || data.values.length === 0) {
        return [];
      }

      const parsed: Candle[] = data.values
        .map((v) => ({
          timestamp: new Date(v.datetime + (v.datetime.includes('T') ? '' : 'T00:00:00Z')).getTime(),
          open: parseFloat(v.open),
          high: parseFloat(v.high),
          low: parseFloat(v.low),
          close: parseFloat(v.close),
          volume: v.volume ? parseFloat(v.volume) : undefined,
        }))
        .reverse();

      return parsed;
    });

    if (candles.length > 0) {
      setCachedCandles(symbol, timeframe, candles);
    }
    return candles;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[TwelveData] Fetch failed for ${symbol} ${timeframe}: ${msg}`);

    // If we have stale cache, serve it rather than failing!
    if (cached && cached.candles.length > 0) {
      console.log(`[TwelveData] Serving stale cached data for ${symbol} ${timeframe}`);
      return cached.candles;
    }

    // Otherwise fallback to sample data
    console.warn(`[TwelveData] Falling back to sample data for ${symbol} ${timeframe}`);
    const sample = getSamplePairData(symbol);
    if (timeframe === '1day') return sample.daily;
    if (timeframe === '4h') return sample.fourHour;
    if (timeframe === '1h') return sample.oneHour;
    return sample.fifteenMin;
  }
}

/**
 * Fetch all 4 timeframes for a pair.
 * Checks each timeframe in cache first; only queries API for missing/stale timeframes.
 */
export async function fetchAllTimeframes(
  symbol: string,
  apiKey: string,
): Promise<{
  daily: Candle[];
  fourHour: Candle[];
  oneHour: Candle[];
  fifteenMin: Candle[];
}> {
  // Fetch sequentially through the throttled queue
  const daily = await fetchCandles(symbol, '1day', apiKey);
  const fourHour = await fetchCandles(symbol, '4h', apiKey);
  const oneHour = await fetchCandles(symbol, '1h', apiKey);
  const fifteenMin = await fetchCandles(symbol, '15min', apiKey);

  return { daily, fourHour, oneHour, fifteenMin };
}

/**
 * Get current price for a symbol.
 */
export async function fetchCurrentPrice(
  symbol: string,
  apiKey: string,
): Promise<number> {
  // Try to use latest candle close first to save API credit
  const cached15m = getCachedCandles(symbol, '15min');
  if (cached15m && cached15m.candles.length > 0) {
    return cached15m.candles[cached15m.candles.length - 1].close;
  }

  try {
    return await twelveDataQueue.execute(async () => {
      const url = new URL(`${BASE_URL}/price`);
      url.searchParams.set('symbol', symbol);
      url.searchParams.set('apikey', apiKey);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`Twelve Data price error: ${response.status}`);
      const data = await response.json();
      return parseFloat(data.price);
    });
  } catch (err) {
    console.warn(`[TwelveData] fetchCurrentPrice error for ${symbol}:`, err);
    return 0;
  }
}
