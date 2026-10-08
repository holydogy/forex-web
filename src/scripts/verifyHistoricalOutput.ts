// ─────────────────────────────────────────────────────
// Standalone Verification Script
// Demonstrates determineBias(), detectFVG(), detectLiquiditySweep(), detectBreaker()
// on sample historical EUR/USD multi-timeframe candle data.
//
// Run with: npx tsx src/scripts/verifyHistoricalOutput.ts
// ─────────────────────────────────────────────────────

import { getSampleEURUSDData } from '../lib/data/sampleHistoricalData';
import { determineBias } from '../lib/detection/determineBias';
import { detectFVG } from '../lib/detection/detectFVG';
import { detectLiquidityLevels, detectLiquiditySweeps } from '../lib/detection/detectLiquiditySweep';
import { detectBreaker } from '../lib/detection/detectBreaker';
import { analyzePair } from '../lib/analysis/analyzePair';
import { DEFAULT_SETTINGS } from '../lib/types';
import { SAMPLE_NEWS_EVENTS } from '../lib/data/sampleHistoricalData';

function runVerification() {
  console.log('='.repeat(70));
  console.log('ICT MULTI-TIMEFRAME CONFLUENCE SCANNER — ALGORITHM VERIFICATION');
  console.log('Pair: EUR/USD | Running on Historical Multi-Timeframe Candle Data');
  console.log('='.repeat(70));

  const data = getSampleEURUSDData();
  const settings = DEFAULT_SETTINGS;

  // ──── 1. 1D Bias (determineBias) ────
  console.log('\n[1] 1D MARKET STRUCTURE BIAS (determineBias)');
  const biasResult = determineBias(data.daily, settings.swingLookback);
  console.log(`    Current Bias: ${biasResult.bias.toUpperCase()}`);
  console.log(`    Swing Points Detected: ${biasResult.swings.length}`);
  console.log('    Recent Swing Points:');
  biasResult.swings.slice(-4).forEach((s) => {
    console.log(`      - Index ${s.index}: ${s.type.toUpperCase()} @ ${s.price.toFixed(5)}`);
  });
  console.log(`    Structure Breaks (BOS/CHoCH): ${biasResult.structureBreaks.length}`);
  biasResult.structureBreaks.forEach((b) => {
    console.log(`      * ${b.type} -> Direction: ${b.direction.toUpperCase()} @ Broken: ${b.brokenSwing.price.toFixed(5)}, Break Close: ${b.breakCandle.close.toFixed(5)}`);
  });

  // ──── 2. 4H FVG (detectFVG) ────
  console.log('\n[2] 4H FAIR VALUE GAPS (detectFVG)');
  const fourHourFVGs = detectFVG(data.fourHour, '4h', settings.fvgMinAtrPercent, settings.fvgAtrPeriod);
  console.log(`    Total 4H FVGs Detected: ${fourHourFVGs.length}`);
  fourHourFVGs.forEach((fvg, i) => {
    console.log(`      [FVG #${i + 1}] Direction: ${fvg.direction.toUpperCase()} | Range: ${fvg.bottom.toFixed(5)} - ${fvg.top.toFixed(5)} | Gap: ${(fvg.gapSize * 10000).toFixed(1)} pips | Mitigated: ${fvg.mitigated}`);
  });

  // ──── 3. 1H Liquidity & Sweeps (detectLiquidityLevels + detectFVG) ────
  console.log('\n[3] 1H LIQUIDITY LEVELS & 1H FVGs (detectLiquidityLevels + detectFVG)');
  const oneHourSwings = biasResult.swings; // 1H swings
  const pipTolerance = 0.0001 * settings.equalLevelTolerance;
  const oneHourLiq = detectLiquidityLevels(oneHourSwings, pipTolerance, '1h');
  console.log(`    1H Liquidity Pools Detected: ${oneHourLiq.length}`);
  oneHourLiq.slice(0, 3).forEach((l) => {
    console.log(`      - Type: ${l.type} | Level: ${l.price.toFixed(5)} | Touches: ${l.touches}`);
  });
  const oneHourFVGs = detectFVG(data.oneHour, '1h', settings.fvgMinAtrPercent, settings.fvgAtrPeriod);
  console.log(`    1H FVGs Detected: ${oneHourFVGs.length}`);

  // ──── 4. 15M Breaker & Sweeps (detectLiquiditySweeps + detectBreaker) ────
  console.log('\n[4] 15M LIQUIDITY SWEEP & BREAKER BLOCK TRIGGER (detectBreaker)');
  const fifteenMinSweeps = detectLiquiditySweeps(data.fifteenMin, oneHourLiq, 0, settings.fvgAtrPeriod);
  console.log(`    15M Sweeps Detected: ${fifteenMinSweeps.length}`);
  fifteenMinSweeps.forEach((s) => {
    console.log(`      * Swept Level: ${s.level.price.toFixed(5)} (${s.level.type}) | Wick Beyond: ${(s.wickBeyond * 10000).toFixed(1)} pips | Closed Inside: ${s.closedInside}`);
  });
  const fifteenMinBreakers = detectBreaker(data.fifteenMin, fifteenMinSweeps, '15min');
  console.log(`    15M Breaker Blocks Formed: ${fifteenMinBreakers.length}`);
  fifteenMinBreakers.forEach((b) => {
    console.log(`      * Breaker: ${b.direction.toUpperCase()} | Zone: ${b.bottom.toFixed(5)} - ${b.top.toFixed(5)} (Origin Candle: O=${b.originCandle.open.toFixed(5)}, C=${b.originCandle.close.toFixed(5)})`);
  });

  // ──── 5. Full Multi-Timeframe Confluence Evaluation ────
  console.log('\n[5] FULL MULTI-TIMEFRAME CONFLUENCE EVALUATION (analyzePair)');
  const analysis = analyzePair('EUR/USD', data, settings, SAMPLE_NEWS_EVENTS);
  console.log(`    Pair: ${analysis.pair}`);
  console.log(`    Final Status: ${analysis.status === 'ENTRY_TRIGGERED' ? '🟢 ENTRY TRIGGERED' : analysis.status === 'SETUP_FORMING' ? '🟡 SETUP FORMING' : '🔴 NO SETUP'}`);
  console.log(`    Daily Bias: ${analysis.conditions.dailyBias.direction.toUpperCase()} (Met: ${analysis.conditions.dailyBias.met})`);
  console.log(`    4H FVG Aligned: ${analysis.conditions.fourHourFVG.met ? 'YES' : 'NO'}`);
  console.log(`    1H Liquidity + FVG: ${analysis.conditions.oneHourLiquidity.met ? 'YES' : 'NO'}`);
  console.log(`    15M Entry Trigger: ${analysis.conditions.fifteenMinTrigger.met ? 'YES' : 'NO'}`);
  console.log(`    News Warning: ${analysis.newsWarning ? '⚠️ HIGH-IMPACT NEWS WITHIN WINDOW' : 'None'}`);
  if (analysis.upcomingNews.length > 0) {
    analysis.upcomingNews.forEach((n) => {
      console.log(`      - ${n.currency}: ${n.title} (${new Date(n.datetime).toLocaleTimeString()})`);
    });
  }
  console.log('='.repeat(70));
}

runVerification();
