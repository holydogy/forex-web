// ─────────────────────────────────────────────────────
// Core domain types for the Multi-Timeframe Confluence Scanner
// ─────────────────────────────────────────────────────

/** OHLC candle data */
export interface Candle {
  timestamp: number; // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** Supported timeframes */
export type Timeframe = '1day' | '4h' | '1h' | '15min';

/** Directional bias */
export type Bias = 'bullish' | 'bearish' | 'neutral';

/** Swing point type */
export type SwingType = 'high' | 'low';

/** A detected swing point */
export interface SwingPoint {
  index: number;
  type: SwingType;
  price: number;
  timestamp: number;
}

/** Market structure event: Break of Structure or Change of Character */
export type StructureBreakType = 'BOS' | 'CHoCH';

export interface StructureBreak {
  type: StructureBreakType;
  direction: Bias;
  breakCandle: Candle;
  brokenSwing: SwingPoint;
  timestamp: number;
}

/** Fair Value Gap zone */
export interface FVG {
  direction: 'bullish' | 'bearish';
  top: number;       // upper boundary of gap
  bottom: number;    // lower boundary of gap
  midpoint: number;
  gapSize: number;   // in price units
  startTimestamp: number;
  candleIndices: [number, number, number]; // the 3-candle indices
  timeframe: Timeframe;
  mitigated: boolean;
}

/** Liquidity level (equal highs/lows or key swing points) */
export interface LiquidityLevel {
  type: 'equal_highs' | 'equal_lows' | 'swing_high' | 'swing_low';
  price: number;
  touches: number;  // how many times price touched this level
  timestamps: number[];
  timeframe: Timeframe;
}

/** Liquidity sweep event */
export interface LiquiditySweep {
  level: LiquidityLevel;
  sweepCandle: Candle;
  sweepCandleIndex: number;
  wickBeyond: number;  // how far the wick went beyond the level
  closedInside: boolean;
  timestamp: number;
}

/** Breaker block */
export interface BreakerBlock {
  direction: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  originCandle: Candle;
  originCandleIndex: number;
  timestamp: number;
  timeframe: Timeframe;
}

/** Overall confluence status for a currency pair */
export type SetupStatus = 'ENTRY_TRIGGERED' | 'SETUP_FORMING' | 'NO_SETUP';

/** Complete analysis result for one pair */
export interface PairAnalysis {
  pair: string;
  status: SetupStatus;
  bias: Bias;
  lastEvaluated: number; // Unix ms

  // Checklist items
  conditions: {
    dailyBias: { met: boolean; direction: Bias };
    fourHourFVG: { met: boolean; fvg: FVG | null };
    oneHourLiquidity: { met: boolean; level: LiquidityLevel | null; nearbyFVG: FVG | null };
    fifteenMinTrigger: { met: boolean; sweep: LiquiditySweep | null; breaker: BreakerBlock | null; fvg: FVG | null };
  };

  // Distance info
  distanceToZone: number | null; // pips to nearest relevant zone
  currentPrice: number;

  // News warning
  newsWarning: boolean;
  upcomingNews: NewsEvent[];
}

/** Economic calendar event */
export interface NewsEvent {
  title: string;
  country: string;
  impact: 'high' | 'medium' | 'low';
  datetime: number; // Unix ms
  currency: string;
  actual?: string;
  estimate?: string;
  previous?: string;
}

/** User-configurable strategy settings */
export interface StrategySettings {
  // Swing detection
  swingLookback: number;          // N candles on each side for fractal detection (default: 2)

  // FVG
  fvgMinAtrPercent: number;       // minimum gap size as % of ATR (default: 20)
  fvgAtrPeriod: number;           // ATR period for FVG sizing (default: 14)

  // Liquidity
  equalLevelTolerance: number;    // pips tolerance for "equal" highs/lows (default: 3)
  sweepWickAtrPercent: number;    // min wick beyond level as % of 1H ATR (default: 10)

  // News
  newsWarningMinutes: number;     // warn if high-impact news within X minutes (default: 120)

  // Watchlist
  watchlist: string[];            // e.g. ['EURUSD', 'GBPUSD', ...]

  // Refresh
  refreshIntervalMs: number;     // how often to poll (default: 60000)
}

export const DEFAULT_SETTINGS: StrategySettings = {
  swingLookback: 2,
  fvgMinAtrPercent: 20,
  fvgAtrPeriod: 14,
  equalLevelTolerance: 3,
  sweepWickAtrPercent: 10,
  newsWarningMinutes: 120,
  watchlist: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'USD/CHF'],
  refreshIntervalMs: 60000,
};

/** Twelve Data API response shape */
export interface TwelveDataTimeSeries {
  meta: {
    symbol: string;
    interval: string;
    currency_base: string;
    currency_quote: string;
    type: string;
  };
  values: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
  }>;
  status: string;
}
