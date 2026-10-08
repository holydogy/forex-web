// ─────────────────────────────────────────────────────
// detectLiquiditySweep() — Liquidity Level & Sweep Detection
//
// Liquidity levels are areas where stop-loss orders cluster:
// 1. Equal highs: multiple swing highs at roughly the same price
// 2. Equal lows: multiple swing lows at roughly the same price
// 3. Significant swing highs/lows (even single, if prominent)
//
// A liquidity sweep occurs when price wicks beyond a liquidity
// level but closes back inside — indicating stop hunting.
// ─────────────────────────────────────────────────────

import type { Candle, LiquidityLevel, LiquiditySweep, SwingPoint, Timeframe } from '../types';
import { calculateATR } from './atr';

/**
 * Identify liquidity levels from swing points.
 *
 * Looks for:
 * - Equal highs (swing highs within `tolerance` pips of each other)
 * - Equal lows (swing lows within `tolerance` pips of each other)
 * - All swing highs/lows as potential single-touch liquidity levels
 *
 * @param swings        - Swing points to analyze
 * @param pipTolerance  - How close prices must be to count as "equal" (in price units, not pips)
 * @param timeframe     - Timeframe label
 * @returns Array of LiquidityLevel objects, sorted by number of touches (descending)
 */
export function detectLiquidityLevels(
  swings: SwingPoint[],
  pipTolerance: number,
  timeframe: Timeframe,
): LiquidityLevel[] {
  const levels: LiquidityLevel[] = [];

  const swingHighs = swings.filter(s => s.type === 'high');
  const swingLows = swings.filter(s => s.type === 'low');

  // Group equal highs
  const highGroups = groupSwingsByPrice(swingHighs, pipTolerance);
  for (const group of highGroups) {
    if (group.length >= 2) {
      const avgPrice = group.reduce((sum, s) => sum + s.price, 0) / group.length;
      levels.push({
        type: 'equal_highs',
        price: avgPrice,
        touches: group.length,
        timestamps: group.map(s => s.timestamp),
        timeframe,
      });
    }
  }

  // Group equal lows
  const lowGroups = groupSwingsByPrice(swingLows, pipTolerance);
  for (const group of lowGroups) {
    if (group.length >= 2) {
      const avgPrice = group.reduce((sum, s) => sum + s.price, 0) / group.length;
      levels.push({
        type: 'equal_lows',
        price: avgPrice,
        touches: group.length,
        timestamps: group.map(s => s.timestamp),
        timeframe,
      });
    }
  }

  // Also add significant single swing points as potential liquidity
  for (const sh of swingHighs) {
    // Check it's not already covered by an equal-highs group
    const alreadyCovered = levels.some(
      l => l.type === 'equal_highs' && Math.abs(l.price - sh.price) <= pipTolerance,
    );
    if (!alreadyCovered) {
      levels.push({
        type: 'swing_high',
        price: sh.price,
        touches: 1,
        timestamps: [sh.timestamp],
        timeframe,
      });
    }
  }

  for (const sl of swingLows) {
    const alreadyCovered = levels.some(
      l => l.type === 'equal_lows' && Math.abs(l.price - sl.price) <= pipTolerance,
    );
    if (!alreadyCovered) {
      levels.push({
        type: 'swing_low',
        price: sl.price,
        touches: 1,
        timestamps: [sl.timestamp],
        timeframe,
      });
    }
  }

  // Sort by relevance: more touches = higher priority
  return levels.sort((a, b) => b.touches - a.touches);
}

/**
 * Group swing points by price proximity.
 */
function groupSwingsByPrice(swings: SwingPoint[], tolerance: number): SwingPoint[][] {
  const used = new Set<number>();
  const groups: SwingPoint[][] = [];

  for (let i = 0; i < swings.length; i++) {
    if (used.has(i)) continue;

    const group: SwingPoint[] = [swings[i]];
    used.add(i);

    for (let j = i + 1; j < swings.length; j++) {
      if (used.has(j)) continue;
      if (Math.abs(swings[i].price - swings[j].price) <= tolerance) {
        group.push(swings[j]);
        used.add(j);
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Detect liquidity sweeps — candles that wick beyond a liquidity level
 * and close back inside.
 *
 * @param candles            - Ordered oldest-first
 * @param levels             - Liquidity levels to check
 * @param sweepWickAtrPercent - Min wick beyond level as % of ATR (default 10%)
 * @param atrPeriod          - ATR period (default 14)
 * @returns Array of LiquiditySweep events
 */
export function detectLiquiditySweeps(
  candles: Candle[],
  levels: LiquidityLevel[],
  sweepWickAtrPercent: number = 10,
  atrPeriod: number = 14,
): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = [];

  const atr = calculateATR(candles, atrPeriod);
  const minWickBeyond = isNaN(atr) ? 0 : atr * (sweepWickAtrPercent / 100);

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];

    for (const level of levels) {
      // Sweep of highs: wick above the level but close below
      if (
        (level.type === 'equal_highs' || level.type === 'swing_high') &&
        candle.high > level.price &&
        candle.close < level.price
      ) {
        const wickBeyond = candle.high - level.price;
        if (wickBeyond >= minWickBeyond) {
          sweeps.push({
            level,
            sweepCandle: candle,
            sweepCandleIndex: i,
            wickBeyond,
            closedInside: true,
            timestamp: candle.timestamp,
          });
        }
      }

      // Sweep of lows: wick below the level but close above
      if (
        (level.type === 'equal_lows' || level.type === 'swing_low') &&
        candle.low < level.price &&
        candle.close > level.price
      ) {
        const wickBeyond = level.price - candle.low;
        if (wickBeyond >= minWickBeyond) {
          sweeps.push({
            level,
            sweepCandle: candle,
            sweepCandleIndex: i,
            wickBeyond,
            closedInside: true,
            timestamp: candle.timestamp,
          });
        }
      }
    }
  }

  return sweeps;
}
