// ─────────────────────────────────────────────────────
// analyzePair() — Multi-Timeframe Confluence Analysis
//
// Orchestrates all detection functions across timeframes
// and determines the final setup status for a currency pair.
// ─────────────────────────────────────────────────────

import type {
  Candle,
  PairAnalysis,
  StrategySettings,
  Bias,
  FVG,
  LiquidityLevel,
  LiquiditySweep,
  BreakerBlock,
  NewsEvent,
} from '../types';
import { determineBias } from '../detection/determineBias';
import { detectFVG, filterAlignedFVGs, findFVGsNearLevel } from '../detection/detectFVG';
import { detectLiquidityLevels, detectLiquiditySweeps } from '../detection/detectLiquiditySweep';
import { detectBreaker } from '../detection/detectBreaker';
import { detectSwingPoints } from '../detection/determineBias';
import { calculateATR } from '../detection/atr';

interface MultiTimeframeData {
  daily: Candle[];
  fourHour: Candle[];
  oneHour: Candle[];
  fifteenMin: Candle[];
}

/**
 * Perform full multi-timeframe confluence analysis on a single pair.
 *
 * @param pair     - Currency pair symbol (e.g. "EUR/USD")
 * @param data     - OHLC candle data for all 4 timeframes
 * @param settings - User-configurable strategy parameters
 * @param news     - Upcoming economic calendar events for the pair's currencies
 * @returns PairAnalysis result
 */
export function analyzePair(
  pair: string,
  data: MultiTimeframeData,
  settings: StrategySettings,
  news: NewsEvent[] = [],
): PairAnalysis {
  const now = Date.now();

  // ──── Step 1: 1D Bias ────
  const biasResult = determineBias(data.daily, settings.swingLookback);
  const bias = biasResult.bias;
  const dailyBiasMet = bias !== 'neutral';

  // ──── Step 2: 4H FVG aligned with 1D bias ────
  const fourHourFVGs = detectFVG(
    data.fourHour,
    '4h',
    settings.fvgMinAtrPercent,
    settings.fvgAtrPeriod,
  );
  const aligned4hFVGs = bias !== 'neutral'
    ? filterAlignedFVGs(fourHourFVGs, bias)
    : [];
  const fourHourFVGMet = aligned4hFVGs.length > 0;
  const latest4hFVG = aligned4hFVGs.length > 0
    ? aligned4hFVGs[aligned4hFVGs.length - 1]
    : null;

  // ──── Step 3: 1H Liquidity + FVG ────
  // Detect 1H swing points for liquidity analysis
  const oneHourSwings = detectSwingPoints(data.oneHour, settings.swingLookback);

  // Convert pip tolerance to price units (for JPY pairs, 1 pip = 0.01; others = 0.0001)
  const pipSize = pair.includes('JPY') ? 0.01 : 0.0001;
  const priceTolerance = settings.equalLevelTolerance * pipSize;

  const oneHourLiquidityLevels = detectLiquidityLevels(
    oneHourSwings,
    priceTolerance,
    '1h',
  );

  // Find liquidity levels near the 4H FVG zone
  let relevantLiquidityLevel: LiquidityLevel | null = null;
  if (latest4hFVG && oneHourLiquidityLevels.length > 0) {
    // Look for liquidity levels near the FVG zone
    const fvgCenter = latest4hFVG.midpoint;
    const atr4h = calculateATR(data.fourHour, settings.fvgAtrPeriod);
    const searchRadius = isNaN(atr4h) ? priceTolerance * 100 : atr4h;

    for (const level of oneHourLiquidityLevels) {
      if (Math.abs(level.price - fvgCenter) <= searchRadius) {
        relevantLiquidityLevel = level;
        break; // Take the most relevant (highest touches)
      }
    }
  }

  // Detect 1H FVGs near the liquidity level
  const oneHourFVGs = detectFVG(
    data.oneHour,
    '1h',
    settings.fvgMinAtrPercent,
    settings.fvgAtrPeriod,
  );
  const aligned1hFVGs = bias !== 'neutral'
    ? filterAlignedFVGs(oneHourFVGs, bias)
    : [];

  let nearby1hFVG: FVG | null = null;
  if (relevantLiquidityLevel && aligned1hFVGs.length > 0) {
    const atr1h = calculateATR(data.oneHour, settings.fvgAtrPeriod);
    const searchRadius = isNaN(atr1h) ? priceTolerance * 50 : atr1h * 0.5;
    const nearbyFVGs = findFVGsNearLevel(aligned1hFVGs, relevantLiquidityLevel.price, searchRadius);
    nearby1hFVG = nearbyFVGs.length > 0 ? nearbyFVGs[nearbyFVGs.length - 1] : null;
  }

  const oneHourLiquidityMet = relevantLiquidityLevel !== null && nearby1hFVG !== null;

  // ──── Step 4: 15M Breaker + FVG Entry Trigger ────
  // Look for liquidity sweeps on the 15M chart near the 1H levels
  const fifteenMinSwings = detectSwingPoints(data.fifteenMin, settings.swingLookback);
  const fifteenMinLiqLevels = detectLiquidityLevels(fifteenMinSwings, priceTolerance, '15min');

  // Also include 1H liquidity levels in 15M sweep detection
  const allLevelsFor15M = [...fifteenMinLiqLevels];
  if (relevantLiquidityLevel) {
    allLevelsFor15M.push(relevantLiquidityLevel);
  }

  const fifteenMinSweeps = detectLiquiditySweeps(
    data.fifteenMin,
    allLevelsFor15M,
    settings.sweepWickAtrPercent,
    settings.fvgAtrPeriod,
  );

  // Detect breaker blocks from sweeps
  const fifteenMinBreakers = detectBreaker(data.fifteenMin, fifteenMinSweeps, '15min');
  const alignedBreakers = fifteenMinBreakers.filter(b => b.direction === bias);

  // Detect 15M FVGs near breaker zones
  const fifteenMinFVGs = detectFVG(
    data.fifteenMin,
    '15min',
    settings.fvgMinAtrPercent,
    settings.fvgAtrPeriod,
  );
  const aligned15mFVGs = bias !== 'neutral'
    ? filterAlignedFVGs(fifteenMinFVGs, bias)
    : [];

  let triggerBreaker: BreakerBlock | null = null;
  let triggerFVG: FVG | null = null;
  let triggerSweep: LiquiditySweep | null = null;

  if (alignedBreakers.length > 0 && aligned15mFVGs.length > 0) {
    // Check if any aligned FVG is near any breaker block
    for (const breaker of alignedBreakers.reverse()) { // most recent first
      const nearbyFVGs = findFVGsNearLevel(
        aligned15mFVGs,
        (breaker.top + breaker.bottom) / 2,
        breaker.top - breaker.bottom, // use breaker size as tolerance
      );
      if (nearbyFVGs.length > 0) {
        triggerBreaker = breaker;
        triggerFVG = nearbyFVGs[nearbyFVGs.length - 1];
        // Find the sweep that created this breaker
        triggerSweep = fifteenMinSweeps.length > 0
          ? fifteenMinSweeps[fifteenMinSweeps.length - 1]
          : null;
        break;
      }
    }
  }

  const fifteenMinTriggerMet = triggerBreaker !== null && triggerFVG !== null;

  // ──── Determine overall status ────
  let status: PairAnalysis['status'];
  if (dailyBiasMet && fourHourFVGMet && oneHourLiquidityMet && fifteenMinTriggerMet) {
    status = 'ENTRY_TRIGGERED';
  } else if (dailyBiasMet && fourHourFVGMet) {
    status = 'SETUP_FORMING';
  } else {
    status = 'NO_SETUP';
  }

  // ──── Current price and distance ────
  const currentPrice = data.fifteenMin.length > 0
    ? data.fifteenMin[data.fifteenMin.length - 1].close
    : 0;

  let distanceToZone: number | null = null;
  if (latest4hFVG) {
    distanceToZone = Math.abs(currentPrice - latest4hFVG.midpoint) / pipSize;
  } else if (relevantLiquidityLevel) {
    distanceToZone = Math.abs(currentPrice - relevantLiquidityLevel.price) / pipSize;
  }

  // ──── News filter ────
  const pairCurrencies = extractCurrencies(pair);
  const upcomingNews = news.filter(event => {
    const isRelevantCurrency = pairCurrencies.some(
      c => event.currency?.toUpperCase() === c,
    );
    const isHighImpact = event.impact === 'high';
    const isWithinWindow = event.datetime - now <= settings.newsWarningMinutes * 60 * 1000
      && event.datetime > now;
    return isRelevantCurrency && isHighImpact && isWithinWindow;
  });

  return {
    pair,
    status,
    bias,
    lastEvaluated: now,
    conditions: {
      dailyBias: { met: dailyBiasMet, direction: bias },
      fourHourFVG: { met: fourHourFVGMet, fvg: latest4hFVG },
      oneHourLiquidity: {
        met: oneHourLiquidityMet,
        level: relevantLiquidityLevel,
        nearbyFVG: nearby1hFVG,
      },
      fifteenMinTrigger: {
        met: fifteenMinTriggerMet,
        sweep: triggerSweep,
        breaker: triggerBreaker,
        fvg: triggerFVG,
      },
    },
    distanceToZone,
    currentPrice,
    newsWarning: upcomingNews.length > 0,
    upcomingNews,
  };
}

/**
 * Extract the two 3-letter currency codes from a pair symbol.
 * Handles formats like "EUR/USD", "EURUSD", "EUR_USD".
 */
function extractCurrencies(pair: string): string[] {
  const clean = pair.replace(/[/_-]/g, '');
  if (clean.length >= 6) {
    return [clean.slice(0, 3).toUpperCase(), clean.slice(3, 6).toUpperCase()];
  }
  return [clean.toUpperCase()];
}
