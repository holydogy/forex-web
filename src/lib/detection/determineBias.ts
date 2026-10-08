// ─────────────────────────────────────────────────────
// determineBias() — 1D Market Structure Bias Detection
//
// Algorithm:
// 1. Identify fractal-based swing points (swing highs/lows)
//    using a configurable lookback N. A swing high needs N lower
//    highs on each side; a swing low needs N higher lows on each side.
// 2. Track the sequence of swing highs and swing lows.
// 3. Detect Break of Structure (BOS) and Change of Character (CHoCH):
//    - BOS (bullish): price closes above the last swing high while
//      bias is already bullish → continuation
//    - BOS (bearish): price closes below the last swing low while
//      bias is already bearish → continuation
//    - CHoCH (bullish): price closes above the last swing high while
//      bias was bearish → reversal to bullish
//    - CHoCH (bearish): price closes below the last swing low while
//      bias was bullish → reversal to bearish
// 4. Return the current bias based on the most recent structure event.
// ─────────────────────────────────────────────────────

import type { Candle, Bias, SwingPoint, StructureBreak } from '../types';

/**
 * Detect fractal-based swing points.
 * A swing high at index i requires that for j in [i-N, i+N], candles[j].high <= candles[i].high.
 * A swing low at index i requires that for j in [i-N, i+N], candles[j].low >= candles[i].low.
 *
 * @param candles  - Ordered oldest-first
 * @param lookback - N candles on each side (default 2)
 * @returns Array of SwingPoint, ordered by index
 */
export function detectSwingPoints(candles: Candle[], lookback: number = 2): SwingPoint[] {
  const swings: SwingPoint[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= lookback; j++) {
      // Check left side
      if (candles[i - j].high > candles[i].high) isSwingHigh = false;
      if (candles[i - j].low < candles[i].low) isSwingLow = false;
      // Check right side
      if (candles[i + j].high > candles[i].high) isSwingHigh = false;
      if (candles[i + j].low < candles[i].low) isSwingLow = false;
    }

    if (isSwingHigh) {
      swings.push({
        index: i,
        type: 'high',
        price: candles[i].high,
        timestamp: candles[i].timestamp,
      });
    }
    if (isSwingLow) {
      swings.push({
        index: i,
        type: 'low',
        price: candles[i].low,
        timestamp: candles[i].timestamp,
      });
    }
  }

  return swings.sort((a, b) => a.index - b.index);
}

/**
 * Detect BOS / CHoCH structure breaks from a sequence of swing points and candles.
 *
 * @param candles - Ordered oldest-first
 * @param swings  - Swing points detected from the same candle array
 * @returns Array of StructureBreak events, ordered chronologically
 */
export function detectStructureBreaks(candles: Candle[], swings: SwingPoint[]): StructureBreak[] {
  const breaks: StructureBreak[] = [];
  let currentBias: Bias = 'neutral';

  // Track the most recent unbroken swing high and swing low
  let lastSwingHigh: SwingPoint | null = null;
  let lastSwingLow: SwingPoint | null = null;

  for (const swing of swings) {
    if (swing.type === 'high') {
      lastSwingHigh = swing;
    } else {
      lastSwingLow = swing;
    }
  }

  // Reset and walk through candles, checking for breaks after each swing is established
  lastSwingHigh = null;
  lastSwingLow = null;

  let swingIdx = 0;

  for (let i = 0; i < candles.length; i++) {
    // Register any swings that are now confirmed (at index i)
    while (swingIdx < swings.length && swings[swingIdx].index <= i) {
      const sw = swings[swingIdx];
      if (sw.type === 'high') {
        lastSwingHigh = sw;
      } else {
        lastSwingLow = sw;
      }
      swingIdx++;
    }

    // Check for bullish break: close above last swing high
    if (lastSwingHigh && candles[i].close > lastSwingHigh.price && i > lastSwingHigh.index) {
      const breakType: StructureBreak['type'] = currentBias === 'bearish' ? 'CHoCH' : 'BOS';
      const newBias: Bias = 'bullish';

      breaks.push({
        type: breakType,
        direction: newBias,
        breakCandle: candles[i],
        brokenSwing: lastSwingHigh,
        timestamp: candles[i].timestamp,
      });

      currentBias = newBias;
      // After breaking, we need a new swing high to break next
      lastSwingHigh = null;
    }

    // Check for bearish break: close below last swing low
    if (lastSwingLow && candles[i].close < lastSwingLow.price && i > lastSwingLow.index) {
      const breakType: StructureBreak['type'] = currentBias === 'bullish' ? 'CHoCH' : 'BOS';
      const newBias: Bias = 'bearish';

      breaks.push({
        type: breakType,
        direction: newBias,
        breakCandle: candles[i],
        brokenSwing: lastSwingLow,
        timestamp: candles[i].timestamp,
      });

      currentBias = newBias;
      lastSwingLow = null;
    }
  }

  return breaks;
}

/**
 * Determine the current directional bias from daily candle data.
 *
 * @param candles  - Daily OHLC candles, ordered oldest-first
 * @param lookback - Fractal swing lookback N (default 2)
 * @returns Object with current bias, swing points, and structure breaks
 */
export function determineBias(
  candles: Candle[],
  lookback: number = 2,
): {
  bias: Bias;
  swings: SwingPoint[];
  structureBreaks: StructureBreak[];
} {
  if (candles.length < lookback * 2 + 1) {
    return { bias: 'neutral', swings: [], structureBreaks: [] };
  }

  const swings = detectSwingPoints(candles, lookback);
  const structureBreaks = detectStructureBreaks(candles, swings);

  // Current bias = direction of the most recent structure break
  const bias: Bias = structureBreaks.length > 0
    ? structureBreaks[structureBreaks.length - 1].direction
    : 'neutral';

  return { bias, swings, structureBreaks };
}
