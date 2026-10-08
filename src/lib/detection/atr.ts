// ─────────────────────────────────────────────────────
// ATR (Average True Range) utility
// Used by FVG and liquidity sweep detectors for adaptive thresholds
// ─────────────────────────────────────────────────────

import type { Candle } from '../types';

/**
 * Calculate the True Range for a single candle given the previous close.
 */
export function trueRange(candle: Candle, prevClose: number): number {
  return Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - prevClose),
    Math.abs(candle.low - prevClose),
  );
}

/**
 * Calculate the ATR (Average True Range) over a given period.
 * Returns NaN if there are fewer candles than `period + 1`.
 *
 * @param candles - Ordered oldest-first
 * @param period  - Lookback period (default 14)
 */
export function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return NaN;

  // Calculate initial ATR as simple average of first `period` true ranges
  let atr = 0;
  for (let i = 1; i <= period; i++) {
    atr += trueRange(candles[i], candles[i - 1].close);
  }
  atr /= period;

  // Smooth with Wilder's method for remaining candles
  for (let i = period + 1; i < candles.length; i++) {
    const tr = trueRange(candles[i], candles[i - 1].close);
    atr = (atr * (period - 1) + tr) / period;
  }

  return atr;
}

/**
 * Calculate ATR at a specific candle index using the preceding `period + 1` candles.
 * Returns NaN if there isn't enough history.
 *
 * @param candles - Ordered oldest-first
 * @param index   - The candle index to compute ATR up to (inclusive)
 * @param period  - ATR lookback (default 14)
 */
export function atrAtIndex(candles: Candle[], index: number, period: number = 14): number {
  if (index < period) return NaN;
  const slice = candles.slice(0, index + 1);
  return calculateATR(slice, period);
}
