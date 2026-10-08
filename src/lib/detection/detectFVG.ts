// ─────────────────────────────────────────────────────
// detectFVG() — Fair Value Gap Detection
//
// A bullish FVG occurs when candle[i].high < candle[i+2].low
//   → The gap is between candle[i].high (bottom) and candle[i+2].low (top)
//
// A bearish FVG occurs when candle[i].low > candle[i+2].high
//   → The gap is between candle[i+2].high (bottom) and candle[i].low (top)
//
// Note on FVG indexing: using ICT convention where we look at
// candle 1, candle 2 (impulse), candle 3 of a 3-candle sequence.
// In array terms: candle[i], candle[i+1], candle[i+2].
// ─────────────────────────────────────────────────────

import type { Candle, FVG, Timeframe } from '../types';
import { calculateATR } from './atr';

/**
 * Detect all Fair Value Gaps in a candle series.
 *
 * @param candles       - Ordered oldest-first
 * @param timeframe     - Timeframe label for tagging
 * @param minAtrPercent - Minimum gap size as a percentage of ATR (default 20%)
 * @param atrPeriod     - ATR calculation period (default 14)
 * @returns Array of FVG objects
 */
export function detectFVG(
  candles: Candle[],
  timeframe: Timeframe,
  minAtrPercent: number = 20,
  atrPeriod: number = 14,
): FVG[] {
  const fvgs: FVG[] = [];

  if (candles.length < 3) return fvgs;

  // Pre-calculate ATR for threshold
  const atr = calculateATR(candles, atrPeriod);
  const minGapSize = isNaN(atr) ? 0 : atr * (minAtrPercent / 100);

  for (let i = 0; i < candles.length - 2; i++) {
    const c1 = candles[i];
    const c2 = candles[i + 1]; // impulse candle
    const c3 = candles[i + 2];

    // Bullish FVG: gap between c1.high and c3.low
    if (c3.low > c1.high) {
      const gapSize = c3.low - c1.high;
      if (gapSize >= minGapSize) {
        fvgs.push({
          direction: 'bullish',
          top: c3.low,
          bottom: c1.high,
          midpoint: (c3.low + c1.high) / 2,
          gapSize,
          startTimestamp: c1.timestamp,
          candleIndices: [i, i + 1, i + 2],
          timeframe,
          mitigated: false,
        });
      }
    }

    // Bearish FVG: gap between c3.high and c1.low
    if (c1.low > c3.high) {
      const gapSize = c1.low - c3.high;
      if (gapSize >= minGapSize) {
        fvgs.push({
          direction: 'bearish',
          top: c1.low,
          bottom: c3.high,
          midpoint: (c1.low + c3.high) / 2,
          gapSize,
          startTimestamp: c1.timestamp,
          timeframe,
          candleIndices: [i, i + 1, i + 2],
          mitigated: false,
        });
      }
    }
  }

  // Check which FVGs have been mitigated (price traded through them)
  for (const fvg of fvgs) {
    const lastCandleIdx = fvg.candleIndices[2];
    for (let i = lastCandleIdx + 1; i < candles.length; i++) {
      if (fvg.direction === 'bullish') {
        // Mitigated if price trades down into the gap (low reaches below the midpoint)
        if (candles[i].low <= fvg.bottom) {
          fvg.mitigated = true;
          break;
        }
      } else {
        // Mitigated if price trades up into the gap (high reaches above the midpoint)
        if (candles[i].high >= fvg.top) {
          fvg.mitigated = true;
          break;
        }
      }
    }
  }

  return fvgs;
}

/**
 * Filter FVGs to only those matching a given bias direction and not yet mitigated.
 */
export function filterAlignedFVGs(
  fvgs: FVG[],
  bias: 'bullish' | 'bearish',
): FVG[] {
  return fvgs.filter(fvg => fvg.direction === bias && !fvg.mitigated);
}

/**
 * Find FVGs near a specific price level within a given tolerance.
 *
 * @param fvgs      - FVGs to search
 * @param price     - Reference price level
 * @param tolerance - Maximum distance from the FVG zone to count as "nearby"
 */
export function findFVGsNearLevel(
  fvgs: FVG[],
  price: number,
  tolerance: number,
): FVG[] {
  return fvgs.filter(fvg => {
    const distToTop = Math.abs(fvg.top - price);
    const distToBottom = Math.abs(fvg.bottom - price);
    const distToMid = Math.abs(fvg.midpoint - price);
    const minDist = Math.min(distToTop, distToBottom, distToMid);
    return minDist <= tolerance || (price >= fvg.bottom && price <= fvg.top);
  });
}
