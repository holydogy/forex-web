// ─────────────────────────────────────────────────────
// Unit tests for all detection functions
// ─────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import type { Candle, LiquidityLevel, LiquiditySweep } from '../lib/types';
import { determineBias, detectSwingPoints } from '../lib/detection/determineBias';
import { detectFVG, filterAlignedFVGs, findFVGsNearLevel } from '../lib/detection/detectFVG';
import { detectLiquidityLevels, detectLiquiditySweeps } from '../lib/detection/detectLiquiditySweep';
import { detectBreaker, isPriceAtBreaker } from '../lib/detection/detectBreaker';
import { calculateATR, trueRange } from '../lib/detection/atr';

// ─── Helper: generate mock candles ───
function makeCandle(
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number,
): Candle {
  return { timestamp, open, high, low, close };
}

function makeCandles(prices: [number, number, number, number][]): Candle[] {
  return prices.map(([o, h, l, c], i) =>
    makeCandle(1000000 + i * 86400000, o, h, l, c),
  );
}

// ═══════════════════════════════════════════════════════
// ATR Tests
// ═══════════════════════════════════════════════════════
describe('ATR', () => {
  it('calculates true range correctly', () => {
    const candle = makeCandle(0, 1.1000, 1.1050, 1.0980, 1.1030);
    const tr = trueRange(candle, 1.0990);
    // Max of: H-L=0.0070, |H-prevC|=0.0060, |L-prevC|=0.0010
    expect(tr).toBeCloseTo(0.0070, 4);
  });

  it('returns NaN for insufficient data', () => {
    const candles = makeCandles([[1, 1.1, 0.9, 1.05]]);
    expect(calculateATR(candles, 14)).toBeNaN();
  });

  it('calculates ATR for sufficient data', () => {
    // Create 20 candles with known ranges
    const candles: Candle[] = [];
    for (let i = 0; i < 20; i++) {
      const base = 1.1000 + i * 0.001;
      candles.push(makeCandle(
        i * 86400000,
        base,
        base + 0.005,
        base - 0.003,
        base + 0.002,
      ));
    }
    const atr = calculateATR(candles, 14);
    expect(atr).toBeGreaterThan(0);
    expect(atr).toBeLessThan(0.02);
  });
});

// ═══════════════════════════════════════════════════════
// determineBias Tests
// ═══════════════════════════════════════════════════════
describe('determineBias', () => {
  it('returns neutral for insufficient data', () => {
    const candles = makeCandles([[1, 1.1, 0.9, 1]]);
    const result = determineBias(candles, 2);
    expect(result.bias).toBe('neutral');
    expect(result.swings).toHaveLength(0);
  });

  it('detects bullish bias with higher-highs and higher-lows', () => {
    // Create an uptrending series with clear swing points
    const candles = makeCandles([
      // Swing low area
      [1.0500, 1.0520, 1.0480, 1.0510],
      [1.0510, 1.0530, 1.0490, 1.0500],
      [1.0500, 1.0510, 1.0470, 1.0490], // potential swing low
      [1.0490, 1.0520, 1.0485, 1.0510],
      [1.0510, 1.0540, 1.0500, 1.0530],
      // Swing high area
      [1.0530, 1.0560, 1.0520, 1.0550],
      [1.0550, 1.0580, 1.0540, 1.0570],
      [1.0570, 1.0590, 1.0560, 1.0575], // potential swing high
      [1.0575, 1.0580, 1.0550, 1.0560],
      [1.0560, 1.0570, 1.0540, 1.0550],
      // Higher swing low
      [1.0550, 1.0560, 1.0530, 1.0540],
      [1.0540, 1.0550, 1.0520, 1.0530],
      [1.0530, 1.0540, 1.0510, 1.0520], // higher swing low
      [1.0520, 1.0550, 1.0515, 1.0540],
      [1.0540, 1.0570, 1.0530, 1.0560],
      // Break above swing high → bullish BOS
      [1.0560, 1.0580, 1.0550, 1.0575],
      [1.0575, 1.0600, 1.0570, 1.0595], // closes above swing high = BOS
      [1.0595, 1.0620, 1.0590, 1.0610],
    ]);

    const result = determineBias(candles, 2);
    expect(result.swings.length).toBeGreaterThan(0);
    // Should detect swing points and structure breaks
  });

  it('detects swing points correctly with N=2', () => {
    // Clear swing high at index 2: candles on either side have lower highs
    const candles = makeCandles([
      [1.0, 1.01, 0.99, 1.005],   // i=0
      [1.005, 1.015, 0.995, 1.01], // i=1
      [1.01, 1.03, 0.998, 1.02],   // i=2 ← swing high (1.03)
      [1.02, 1.025, 0.99, 1.00],   // i=3
      [1.00, 1.02, 0.985, 0.99],   // i=4
      [0.99, 1.01, 0.975, 0.98],   // i=5
      [0.98, 1.00, 0.96, 0.97],    // i=6 ← swing low (0.96)
      [0.97, 0.99, 0.965, 0.985],  // i=7
      [0.985, 1.01, 0.97, 1.00],   // i=8
    ]);

    const swings = detectSwingPoints(candles, 2);
    const swingHighs = swings.filter(s => s.type === 'high');
    const swingLows = swings.filter(s => s.type === 'low');

    expect(swingHighs.length).toBeGreaterThanOrEqual(1);
    expect(swingHighs.some(s => s.price === 1.03)).toBe(true);
    expect(swingLows.length).toBeGreaterThanOrEqual(1);
    expect(swingLows.some(s => s.price === 0.96)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// detectFVG Tests
// ═══════════════════════════════════════════════════════
describe('detectFVG', () => {
  it('detects a bullish FVG', () => {
    // Bullish FVG: c1.high < c3.low (gap between them)
    const candles = makeCandles([
      // Enough preceding candles for ATR
      ...Array.from({ length: 15 }, (_, i) => [
        1.0 + i * 0.001, 1.005 + i * 0.001, 0.995 + i * 0.001, 1.002 + i * 0.001,
      ] as [number, number, number, number]),
      [1.0200, 1.0220, 1.0180, 1.0210],  // c1: high=1.0220
      [1.0210, 1.0300, 1.0200, 1.0290],  // c2: impulse candle
      [1.0280, 1.0320, 1.0260, 1.0310],  // c3: low=1.0260
    ]);

    const fvgs = detectFVG(candles, '4h', 0); // 0% ATR threshold for test
    const bullish = fvgs.filter(f => f.direction === 'bullish');

    // c1.high (1.0220) < c3.low (1.0260) → bullish FVG exists
    expect(bullish.length).toBeGreaterThanOrEqual(1);
    const fvg = bullish[bullish.length - 1]; // The last one matching our setup
    expect(fvg.bottom).toBeCloseTo(1.0220, 3);
    expect(fvg.top).toBeCloseTo(1.0260, 3);
  });

  it('detects a bearish FVG', () => {
    const candles = makeCandles([
      ...Array.from({ length: 15 }, (_, i) => [
        1.1 - i * 0.001, 1.105 - i * 0.001, 1.095 - i * 0.001, 1.098 - i * 0.001,
      ] as [number, number, number, number]),
      [1.0800, 1.0830, 1.0760, 1.0780],  // c1: low=1.0760
      [1.0780, 1.0790, 1.0700, 1.0710],  // c2: impulse down
      [1.0720, 1.0740, 1.0680, 1.0700],  // c3: high=1.0740
    ]);

    const fvgs = detectFVG(candles, '4h', 0);
    const bearish = fvgs.filter(f => f.direction === 'bearish');

    // c1.low (1.0760) > c3.high (1.0740) → bearish FVG exists
    expect(bearish.length).toBeGreaterThanOrEqual(1);
  });

  it('returns no FVG when gap is too small (ATR filter)', () => {
    // Create candles with a tiny gap that should be filtered out
    const candles = makeCandles([
      ...Array.from({ length: 15 }, (_, i) => [
        1.0 + i * 0.005, 1.01 + i * 0.005, 0.99 + i * 0.005, 1.005 + i * 0.005,
      ] as [number, number, number, number]),
      [1.0800, 1.0810, 1.0790, 1.0805],  // c1: high=1.0810
      [1.0805, 1.0850, 1.0800, 1.0840],  // c2: impulse
      [1.0830, 1.0860, 1.0812, 1.0850],  // c3: low=1.0812 (gap = 0.0002, tiny)
    ]);

    const fvgs = detectFVG(candles, '4h', 50); // 50% ATR threshold = very strict
    // With a 50% ATR threshold, a 0.2-pip gap should be filtered
    // (ATR will be much larger than 0.4 pips)
    expect(fvgs.filter(f =>
      f.candleIndices[0] === candles.length - 3 &&
      f.direction === 'bullish'
    ).length).toBe(0);
  });

  it('filters aligned FVGs correctly', () => {
    const candles = makeCandles([
      ...Array.from({ length: 15 }, (_, i) => [
        1.0 + i * 0.001, 1.005 + i * 0.001, 0.995 + i * 0.001, 1.002 + i * 0.001,
      ] as [number, number, number, number]),
      [1.0200, 1.0220, 1.0180, 1.0210],
      [1.0210, 1.0300, 1.0200, 1.0290],
      [1.0280, 1.0320, 1.0260, 1.0310],
    ]);

    const fvgs = detectFVG(candles, '4h', 0);
    const bullish = filterAlignedFVGs(fvgs, 'bullish');
    const bearish = filterAlignedFVGs(fvgs, 'bearish');

    // All bullish FVGs should remain, no bearish should match
    for (const f of bullish) expect(f.direction).toBe('bullish');
    for (const f of bearish) expect(f.direction).toBe('bearish');
  });
});

// ═══════════════════════════════════════════════════════
// detectLiquidityLevels Tests
// ═══════════════════════════════════════════════════════
describe('detectLiquidityLevels', () => {
  it('detects equal highs as liquidity level', () => {
    const swings = [
      { index: 5, type: 'high' as const, price: 1.0500, timestamp: 1000 },
      { index: 15, type: 'high' as const, price: 1.0502, timestamp: 2000 },
      { index: 25, type: 'high' as const, price: 1.0499, timestamp: 3000 },
    ];

    const levels = detectLiquidityLevels(swings, 0.0005, '1h');
    const equalHighs = levels.filter(l => l.type === 'equal_highs');

    expect(equalHighs.length).toBeGreaterThanOrEqual(1);
    expect(equalHighs[0].touches).toBeGreaterThanOrEqual(2);
  });

  it('detects equal lows as liquidity level', () => {
    const swings = [
      { index: 10, type: 'low' as const, price: 1.0300, timestamp: 1000 },
      { index: 20, type: 'low' as const, price: 1.0301, timestamp: 2000 },
    ];

    const levels = detectLiquidityLevels(swings, 0.0005, '1h');
    const equalLows = levels.filter(l => l.type === 'equal_lows');

    expect(equalLows.length).toBe(1);
    expect(equalLows[0].touches).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════
// detectLiquiditySweeps Tests
// ═══════════════════════════════════════════════════════
describe('detectLiquiditySweeps', () => {
  it('detects a sweep of highs (wick above, close below)', () => {
    const candles = makeCandles([
      ...Array.from({ length: 16 }, (_, i) => [
        1.05 + i * 0.001, 1.055 + i * 0.001, 1.045 + i * 0.001, 1.052 + i * 0.001,
      ] as [number, number, number, number]),
      // Sweep candle: wicks above 1.0800 level, closes below
      [1.0750, 1.0830, 1.0740, 1.0760],
    ]);

    const levels: LiquidityLevel[] = [{
      type: 'equal_highs',
      price: 1.0800,
      touches: 2,
      timestamps: [1000, 2000],
      timeframe: '1h',
    }];

    const sweeps = detectLiquiditySweeps(candles, levels, 0, 14); // 0% ATR = any wick
    expect(sweeps.length).toBe(1);
    expect(sweeps[0].wickBeyond).toBeCloseTo(0.0030, 4); // 1.0830 - 1.0800
    expect(sweeps[0].closedInside).toBe(true);
  });

  it('detects a sweep of lows (wick below, close above)', () => {
    const candles = makeCandles([
      ...Array.from({ length: 16 }, (_, i) => [
        1.05 + i * 0.001, 1.055 + i * 0.001, 1.045 + i * 0.001, 1.052 + i * 0.001,
      ] as [number, number, number, number]),
      [1.0350, 1.0370, 1.0280, 1.0340],
    ]);

    const levels: LiquidityLevel[] = [{
      type: 'equal_lows',
      price: 1.0300,
      touches: 2,
      timestamps: [1000, 2000],
      timeframe: '1h',
    }];

    const sweeps = detectLiquiditySweeps(candles, levels, 0, 14);
    expect(sweeps.length).toBe(1);
    expect(sweeps[0].wickBeyond).toBeCloseTo(0.0020, 4); // 1.0300 - 1.0280
  });
});

// ═══════════════════════════════════════════════════════
// detectBreaker Tests
// ═══════════════════════════════════════════════════════
describe('detectBreaker', () => {
  it('detects a bullish breaker after sweep of lows', () => {
    const candles = makeCandles([
      ...Array.from({ length: 10 }, (_, i) => [
        1.05 - i * 0.002, 1.055 - i * 0.002, 1.045 - i * 0.002, 1.048 - i * 0.002,
      ] as [number, number, number, number]),
      // Bearish candle before sweep (this becomes the breaker)
      [1.0320, 1.0330, 1.0290, 1.0300], // bearish: close < open
      // Sweep candle: wicks below lows, closes above
      [1.0300, 1.0340, 1.0250, 1.0330],
      // Recovery candles
      [1.0330, 1.0370, 1.0320, 1.0360],
    ]);

    const sweeps: LiquiditySweep[] = [{
      level: {
        type: 'swing_low',
        price: 1.0280,
        touches: 1,
        timestamps: [0],
        timeframe: '15min',
      },
      sweepCandle: candles[11],
      sweepCandleIndex: 11,
      wickBeyond: 0.0030,
      closedInside: true,
      timestamp: candles[11].timestamp,
    }];

    const breakers = detectBreaker(candles, sweeps, '15min');
    const bullish = breakers.filter(b => b.direction === 'bullish');

    expect(bullish.length).toBe(1);
    expect(bullish[0].originCandleIndex).toBe(10); // the bearish candle before sweep
  });

  it('isPriceAtBreaker returns true when price is in zone', () => {
    const breaker = {
      direction: 'bullish' as const,
      top: 1.0330,
      bottom: 1.0300,
      originCandle: makeCandle(0, 1.0320, 1.0330, 1.0290, 1.0300),
      originCandleIndex: 10,
      timestamp: 0,
      timeframe: '15min' as const,
    };

    expect(isPriceAtBreaker(1.0315, breaker)).toBe(true);
    expect(isPriceAtBreaker(1.0300, breaker)).toBe(true);
    expect(isPriceAtBreaker(1.0330, breaker)).toBe(true);
    expect(isPriceAtBreaker(1.0200, breaker)).toBe(false);
    expect(isPriceAtBreaker(1.0400, breaker)).toBe(false);

    // With tolerance
    expect(isPriceAtBreaker(1.0295, breaker, 0.0010)).toBe(true);
  });
});
