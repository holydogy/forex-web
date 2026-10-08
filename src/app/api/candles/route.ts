// ─────────────────────────────────────────────────────
// API Route: GET /api/candles?pair=EUR/USD&timeframe=1h
// Returns OHLC candle data for charting
// Supports live Twelve Data API and fallback sample data
// ─────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import type { Timeframe } from '@/lib/types';
import { fetchCandles } from '@/lib/data/twelveData';
import { getSamplePairData } from '@/lib/data/sampleHistoricalData';

const VALID_TIMEFRAMES: Timeframe[] = ['1day', '4h', '1h', '15min'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pair = searchParams.get('pair');
  const timeframe = searchParams.get('timeframe') as Timeframe | null;

  if (!pair) {
    return NextResponse.json({ error: 'Missing "pair" query parameter' }, { status: 400 });
  }
  if (!timeframe || !VALID_TIMEFRAMES.includes(timeframe)) {
    return NextResponse.json(
      { error: `Invalid timeframe. Must be one of: ${VALID_TIMEFRAMES.join(', ')}` },
      { status: 400 },
    );
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  const isLive = Boolean(apiKey && apiKey !== 'your_twelve_data_key_here');

  if (isLive && apiKey) {
    try {
      const candles = await fetchCandles(pair, timeframe, apiKey);
      return NextResponse.json({ pair, timeframe, candles, isLive: true });
    } catch (err) {
      console.warn(`Live Twelve Data fetch failed for ${pair} ${timeframe}, falling back to sample data:`, err);
    }
  }

  // Fallback to sample data for smooth visualization
  const pairData = getSamplePairData(pair);
  let candles = pairData.oneHour;
  if (timeframe === '1day') candles = pairData.daily;
  else if (timeframe === '4h') candles = pairData.fourHour;
  else if (timeframe === '1h') candles = pairData.oneHour;
  else if (timeframe === '15min') candles = pairData.fifteenMin;

  return NextResponse.json({ pair, timeframe, candles, isLive: false });
}
