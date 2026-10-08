// ─────────────────────────────────────────────────────
// detectBreaker() — Breaker Block Detection
//
// A breaker block forms after a liquidity sweep:
// 1. Price sweeps a liquidity level (wick beyond, close inside)
// 2. The last opposite-direction candle before the reversal
//    becomes the breaker block
// 3. When price retests the breaker zone, it's a potential entry
//
// Bullish breaker: after sweeping lows, the last bearish candle
//   before the move up = breaker. Zone = that candle's open→close range.
// Bearish breaker: after sweeping highs, the last bullish candle
//   before the move down = breaker. Zone = that candle's open→close range.
// ─────────────────────────────────────────────────────

import type { Candle, BreakerBlock, LiquiditySweep, Timeframe } from '../types';

/**
 * Detect breaker blocks following liquidity sweeps.
 *
 * @param candles   - Ordered oldest-first
 * @param sweeps    - Previously detected liquidity sweeps
 * @param timeframe - Timeframe label
 * @returns Array of BreakerBlock objects
 */
export function detectBreaker(
  candles: Candle[],
  sweeps: LiquiditySweep[],
  timeframe: Timeframe,
): BreakerBlock[] {
  const breakers: BreakerBlock[] = [];

  for (const sweep of sweeps) {
    const sweepIdx = sweep.sweepCandleIndex;
    const sweepedLows = sweep.level.type === 'equal_lows' || sweep.level.type === 'swing_low';
    const sweepedHighs = sweep.level.type === 'equal_highs' || sweep.level.type === 'swing_high';

    if (sweepedLows) {
      // Bullish breaker: find the last bearish candle before/at the sweep
      const breakerCandle = findLastOppositeCandle(candles, sweepIdx, 'bearish');
      if (breakerCandle) {
        breakers.push({
          direction: 'bullish',
          top: Math.max(breakerCandle.candle.open, breakerCandle.candle.close),
          bottom: Math.min(breakerCandle.candle.open, breakerCandle.candle.close),
          originCandle: breakerCandle.candle,
          originCandleIndex: breakerCandle.index,
          timestamp: breakerCandle.candle.timestamp,
          timeframe,
        });
      }
    }

    if (sweepedHighs) {
      // Bearish breaker: find the last bullish candle before/at the sweep
      const breakerCandle = findLastOppositeCandle(candles, sweepIdx, 'bullish');
      if (breakerCandle) {
        breakers.push({
          direction: 'bearish',
          top: Math.max(breakerCandle.candle.open, breakerCandle.candle.close),
          bottom: Math.min(breakerCandle.candle.open, breakerCandle.candle.close),
          originCandle: breakerCandle.candle,
          originCandleIndex: breakerCandle.index,
          timestamp: breakerCandle.candle.timestamp,
          timeframe,
        });
      }
    }
  }

  return breakers;
}

/**
 * Find the last candle of a given direction (bullish or bearish) at or before a given index.
 *
 * @param candles   - Candle array
 * @param fromIndex - Start searching backwards from this index
 * @param type      - 'bullish' to find last green candle, 'bearish' to find last red candle
 * @param maxLookback - Maximum candles to look back (default 10)
 */
function findLastOppositeCandle(
  candles: Candle[],
  fromIndex: number,
  type: 'bullish' | 'bearish',
  maxLookback: number = 10,
): { candle: Candle; index: number } | null {
  const startIdx = Math.max(0, fromIndex - maxLookback);

  for (let i = fromIndex; i >= startIdx; i--) {
    const c = candles[i];
    if (type === 'bearish' && c.close < c.open) {
      return { candle: c, index: i };
    }
    if (type === 'bullish' && c.close > c.open) {
      return { candle: c, index: i };
    }
  }

  return null;
}

/**
 * Check if price is currently retesting a breaker block zone.
 *
 * @param currentPrice - Current market price
 * @param breaker      - BreakerBlock to check
 * @param tolerance    - Extra zone around the breaker (in price units)
 * @returns true if price is within the breaker zone (± tolerance)
 */
export function isPriceAtBreaker(
  currentPrice: number,
  breaker: BreakerBlock,
  tolerance: number = 0,
): boolean {
  return (
    currentPrice >= breaker.bottom - tolerance &&
    currentPrice <= breaker.top + tolerance
  );
}
