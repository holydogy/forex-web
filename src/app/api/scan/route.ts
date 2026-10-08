// ─────────────────────────────────────────────────────
// API Route: POST /api/scan
// Fetches multi-timeframe data for all watchlist pairs
// and runs the confluence analysis
// Throttled and cached to strictly honor Twelve Data free tier (8 req/min)
// and Finnhub free tier.
// ─────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import type { StrategySettings, PairAnalysis, NewsEvent } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { fetchAllTimeframes } from '@/lib/data/twelveData';
import { fetchEconomicCalendar } from '@/lib/data/finnhub';
import { analyzePair } from '@/lib/analysis/analyzePair';
import { getSamplePairData, SAMPLE_NEWS_EVENTS } from '@/lib/data/sampleHistoricalData';
import { getCacheStats } from '@/lib/data/candleCache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const settings: StrategySettings = { ...DEFAULT_SETTINGS, ...(body?.settings || {}) };

    const twelveDataKey = process.env.TWELVE_DATA_API_KEY;
    const finnhubKey = process.env.FINNHUB_API_KEY;
    const isLive = Boolean(twelveDataKey && twelveDataKey !== 'your_twelve_data_key_here');

    // 1. Fetch economic calendar events (free Forex Factory feed + Finnhub free news)
    let newsEvents: NewsEvent[] = [];
    try {
      newsEvents = await fetchEconomicCalendar(finnhubKey);
    } catch (err) {
      console.warn('[ScanRoute] Error fetching economic calendar:', err);
      newsEvents = SAMPLE_NEWS_EVENTS;
    }

    // 2. Determine pairs to analyze (single pair on-demand or watchlist)
    const pairsToAnalyze: string[] = body?.pair
      ? [body.pair]
      : settings.watchlist;

    const analyses: PairAnalysis[] = [];

    for (const pair of pairsToAnalyze) {
      try {
        let data: {
          daily: import('@/lib/types').Candle[];
          fourHour: import('@/lib/types').Candle[];
          oneHour: import('@/lib/types').Candle[];
          fifteenMin: import('@/lib/types').Candle[];
        };

        if (isLive && twelveDataKey) {
          // Fetch multi-timeframe OHLC data (cached + throttled)
          data = await fetchAllTimeframes(pair, twelveDataKey);
        } else {
          // Use sample historical data generator
          data = getSamplePairData(pair);
        }

        // Run confluence analysis
        const analysis = analyzePair(pair, data, settings, newsEvents);
        analyses.push(analysis);
      } catch (err) {
        console.error(`Failed to analyze ${pair}:`, err);
        analyses.push({
          pair,
          status: 'NO_SETUP',
          bias: 'neutral',
          lastEvaluated: Date.now(),
          conditions: {
            dailyBias: { met: false, direction: 'neutral' },
            fourHourFVG: { met: false, fvg: null },
            oneHourLiquidity: { met: false, level: null, nearbyFVG: null },
            fifteenMinTrigger: { met: false, sweep: null, breaker: null, fvg: null },
          },
          distanceToZone: null,
          currentPrice: 0,
          newsWarning: false,
          upcomingNews: [],
        });
      }
    }

    const cacheStats = getCacheStats();

    return NextResponse.json({
      analyses,
      newsEvents,
      isLive,
      cacheStats,
    });
  } catch (err) {
    console.error('Scan API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
