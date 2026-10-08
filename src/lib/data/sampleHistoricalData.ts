// ─────────────────────────────────────────────────────
// Sample Historical Forex Data Generator
// Provides realistic multi-timeframe candles with ICT patterns
// used for:
// 1. Standalone pattern demonstration (Build order step 2)
// 2. Fallback / demo simulation when live API keys are not supplied
// ─────────────────────────────────────────────────────

import type { Candle, NewsEvent, Timeframe } from '../types';

/**
 * Generate a realistic synthetic candle series with configurable trend and volatility.
 */
function generateSeries(
  startPrice: number,
  count: number,
  intervalMs: number,
  trendFactor: number,
  volatility: number,
  seed: number,
): Candle[] {
  const candles: Candle[] = [];
  let price = startPrice;
  const now = Date.now();
  const startTime = now - count * intervalMs;

  for (let i = 0; i < count; i++) {
    const timestamp = startTime + i * intervalMs;
    // Pseudo-random deterministic walk
    const pseudoRand = Math.sin(seed + i * 0.3) * Math.cos(seed * 0.7 + i * 0.15);
    const noise = pseudoRand * volatility;
    const delta = trendFactor + noise;

    const open = price;
    const close = +(open + delta).toFixed(5);
    const high = +(Math.max(open, close) + Math.abs(pseudoRand) * volatility * 0.6).toFixed(5);
    const low = +(Math.min(open, close) - Math.abs(Math.sin(seed + i)) * volatility * 0.6).toFixed(5);

    candles.push({ timestamp, open, high, low, close });
    price = close;
  }

  return candles;
}

/**
 * Generate multi-timeframe data for EUR/USD with complete ICT confluence:
 * - 1D: Bullish bias (clear fractal swings with BOS)
 * - 4H: Bullish FVG
 * - 1H: Equal lows liquidity pool + aligned 1H FVG
 * - 15M: Liquidity sweep of lows + bullish breaker block + 15M FVG retest
 */
export function getSampleEURUSDData(): {
  daily: Candle[];
  fourHour: Candle[];
  oneHour: Candle[];
  fifteenMin: Candle[];
} {
  const dayMs = 86400000;
  const fourHourMs = 14400000;
  const oneHourMs = 3600000;
  const fifteenMinMs = 900000;
  const now = Date.now();

  // 1. 1D Daily candles: ~60 days, forming higher-low and breaking higher-high
  const daily: Candle[] = [];
  let basePrice = 1.0750;
  for (let i = 0; i < 40; i++) {
    const t = now - (40 - i) * dayMs;
    // First 15 candles: swing high at 1.0880
    // Middle 15 candles: pull back to swing low at 1.0790
    // Last 10 candles: break above 1.0880 swing high -> Bullish BOS!
    let o = basePrice;
    let c = basePrice;
    if (i < 12) {
      basePrice += 0.0010;
      o = basePrice - 0.0005;
      c = basePrice + 0.0005;
    } else if (i === 12) {
      // Swing high peak
      o = 1.0870;
      c = 1.0885;
      basePrice = 1.0885;
    } else if (i > 12 && i < 25) {
      // Pullback
      basePrice -= 0.0007;
      o = basePrice + 0.0004;
      c = basePrice - 0.0003;
    } else if (i === 25) {
      // Swing low
      o = 1.0795;
      c = 1.0800;
      basePrice = 1.0800;
    } else {
      // Bullish surge breaking 1.0885
      basePrice += 0.0012;
      o = basePrice - 0.0005;
      c = basePrice + 0.0007;
    }
    const h = +(Math.max(o, c) + 0.0012).toFixed(5);
    const l = +(Math.min(o, c) - 0.0012).toFixed(5);
    daily.push({
      timestamp: t,
      open: +o.toFixed(5),
      high: h,
      low: l,
      close: +c.toFixed(5),
    });
  }

  // 2. 4H Candles: ~60 candles with a distinct bullish FVG
  const fourHour = generateSeries(1.0820, 60, fourHourMs, 0.0003, 0.0010, 42);
  // Inject bullish FVG at candles 50, 51, 52:
  // candle[50].high < candle[52].low
  if (fourHour.length >= 53) {
    fourHour[50].high = 1.0910;
    fourHour[50].close = 1.0905;

    fourHour[51].open = 1.0908;
    fourHour[51].high = 1.0965;
    fourHour[51].low = 1.0905;
    fourHour[51].close = 1.0960; // impulse candle

    fourHour[52].open = 1.0962;
    fourHour[52].low = 1.0935; // gap is 1.0910 to 1.0935 (25 pips)
    fourHour[52].high = 1.0980;
    fourHour[52].close = 1.0975;
  }

  // 3. 1H Candles: ~80 candles with Equal Lows liquidity pool near 1.0915 and 1H FVG
  const oneHour = generateSeries(1.0860, 80, oneHourMs, 0.00015, 0.0007, 108);
  if (oneHour.length >= 75) {
    // Equal lows at candle 60 and candle 68 at 1.0920
    oneHour[60].low = 1.0920;
    oneHour[68].low = 1.0920;

    // Aligned 1H FVG near 1.0920 at candle 70
    oneHour[70].high = 1.0922;
    oneHour[71].open = 1.0924;
    oneHour[71].close = 1.0950;
    oneHour[71].high = 1.0955;
    oneHour[72].low = 1.0932; // gap 1.0922 to 1.0932 (10 pips)
    oneHour[72].high = 1.0960;
    oneHour[72].close = 1.0955;
  }

  // 4. 15M Candles: ~100 candles with sweep of 1.0920, breaker block, and FVG
  const fifteenMin = generateSeries(1.0935, 100, fifteenMinMs, 0.00008, 0.0004, 305);
  if (fifteenMin.length >= 95) {
    // Candle 88: Last bearish candle before move down to sweep (origin candle for breaker)
    fifteenMin[88].open = 1.0928;
    fifteenMin[88].high = 1.0930;
    fifteenMin[88].low = 1.0922;
    fifteenMin[88].close = 1.0924; // Bearish

    // Candle 90: Liquidity sweep candle! Wicks below 1.0920 to 1.0912, closes inside at 1.0923
    fifteenMin[90].open = 1.0922;
    fifteenMin[90].high = 1.0926;
    fifteenMin[90].low = 1.0912; // 8 pip wick sweep below 1.0920
    fifteenMin[90].close = 1.0923; // Closes back inside

    // Candle 91-92: Impulse reversal move creating 15M FVG
    fifteenMin[91].high = 1.0925;
    fifteenMin[92].open = 1.0926;
    fifteenMin[92].close = 1.0945;
    fifteenMin[92].high = 1.0950;
    fifteenMin[93].low = 1.0930; // 15M FVG from 1.0925 to 1.0930 (overlaps breaker zone!)
    fifteenMin[93].high = 1.0955;
    fifteenMin[93].close = 1.0950;

    // Candle 94: Current candle retesting breaker / FVG area
    fifteenMin[94].open = 1.0950;
    fifteenMin[94].high = 1.0952;
    fifteenMin[94].low = 1.0926; // Retesting breaker (1.0924-1.0928)
    fifteenMin[94].close = 1.0935;
  }

  return { daily, fourHour, oneHour, fifteenMin };
}

/**
 * Get multi-timeframe candles for any watchlist pair.
 */
export function getSamplePairData(pair: string): {
  daily: Candle[];
  fourHour: Candle[];
  oneHour: Candle[];
  fifteenMin: Candle[];
} {
  if (pair.includes('EUR/USD') || pair === 'EURUSD') {
    return getSampleEURUSDData();
  }

  const dayMs = 86400000;
  const fourHourMs = 14400000;
  const oneHourMs = 3600000;
  const fifteenMinMs = 900000;

  let basePrice = 1.3000;
  let trend = 0.0002;
  let seed = 123;

  if (pair.includes('GBP')) {
    basePrice = 1.3050;
    trend = 0.0003;
    seed = 456;
  } else if (pair.includes('JPY')) {
    basePrice = 148.50;
    trend = 0.04;
    seed = 789;
  } else if (pair.includes('AUD')) {
    basePrice = 0.6720;
    trend = -0.00005;
    seed = 321;
  } else if (pair.includes('CAD')) {
    basePrice = 1.3600;
    trend = -0.0002;
    seed = 654;
  } else if (pair.includes('NZD')) {
    basePrice = 0.6150;
    trend = 0.00002;
    seed = 987;
  } else if (pair.includes('CHF')) {
    basePrice = 0.8520;
    trend = -0.0001;
    seed = 111;
  }

  const vol = pair.includes('JPY') ? 0.35 : 0.0008;

  const daily = generateSeries(basePrice * 0.98, 45, dayMs, trend * 10, vol * 2.5, seed);
  const fourHour = generateSeries(basePrice * 0.99, 60, fourHourMs, trend * 2, vol * 1.5, seed + 1);
  const oneHour = generateSeries(basePrice, 80, oneHourMs, trend, vol, seed + 2);
  const fifteenMin = generateSeries(basePrice, 100, fifteenMinMs, trend * 0.3, vol * 0.5, seed + 3);

  // For GBP/USD, inject 4H FVG to create SETUP_FORMING
  if (pair.includes('GBP') && fourHour.length >= 55) {
    fourHour[50].high = 1.3040;
    fourHour[51].open = 1.3042;
    fourHour[51].close = 1.3090;
    fourHour[51].high = 1.3095;
    fourHour[52].low = 1.3060; // 4H FVG
    fourHour[52].close = 1.3080;
  }

  // For USD/JPY, inject full confluence for ENTRY_TRIGGERED
  if (pair.includes('JPY') && fourHour.length >= 55 && fifteenMin.length >= 95) {
    fourHour[50].high = 148.20;
    fourHour[51].open = 148.25;
    fourHour[51].close = 149.30;
    fourHour[51].high = 149.40;
    fourHour[52].low = 148.70; // 4H FVG: 148.20 - 148.70
    fourHour[52].close = 149.20;

    // 15M sweep & breaker
    fifteenMin[88].open = 148.80;
    fifteenMin[88].close = 148.70; // Bearish origin
    fifteenMin[90].low = 148.15;   // Sweep of 148.20
    fifteenMin[90].close = 148.35;
    fifteenMin[91].high = 148.40;
    fifteenMin[92].close = 149.10;
    fifteenMin[93].low = 148.65;  // 15M FVG
  }

  return { daily, fourHour, oneHour, fifteenMin };
}

/**
 * Sample upcoming economic calendar events (Finnhub format).
 */
export const SAMPLE_NEWS_EVENTS: NewsEvent[] = [
  {
    title: 'Non-Farm Payrolls (NFP)',
    country: 'US',
    currency: 'USD',
    impact: 'high',
    datetime: Date.now() + 45 * 60 * 1000, // 45 minutes from now! (triggers warning)
    estimate: '180K',
    previous: '142K',
  },
  {
    title: 'ECB Monetary Policy Statement',
    country: 'EU',
    currency: 'EUR',
    impact: 'high',
    datetime: Date.now() + 90 * 60 * 1000, // 90 minutes from now (triggers warning)
    previous: '3.65%',
  },
  {
    title: 'BOJ Interest Rate Decision',
    country: 'JP',
    currency: 'JPY',
    impact: 'high',
    datetime: Date.now() + 6 * 3600 * 1000, // 6 hours away
    previous: '0.25%',
  },
];
