# Forex Multi-Timeframe Confluence Scanner

An automated trading dashboard that continuously monitors major forex pairs against an ICT-style multi-timeframe strategy, showing which pairs have a valid setup, confirmed entry trigger, or no trade.

## Strategy Logic

| Step | Timeframe | What It Checks |
|------|-----------|----------------|
| 1 | **1D** | Market structure bias (fractal swing points + BOS/CHoCH) |
| 2 | **4H** | Fair Value Gap aligned with daily bias |
| 3 | **1H** | Liquidity pool near the 4H FVG + aligned 1H FVG |
| 4 | **15M** | Liquidity sweep → Breaker block + aligned FVG (entry trigger) |

## Status Badges

- 🟢 **ENTRY TRIGGERED** — Full confluence confirmed, trade-ready
- 🟡 **SETUP FORMING** — Bias + 4H aligned, waiting for 15M trigger
- 🔴 **NO SETUP** — Conditions not met

## Setup

### 1. Install dependencies

```bash
cd forex-scanner
npm install
```

### 2. Configure API keys

Copy the example environment file and add your keys:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local`:

```
TWELVE_DATA_API_KEY=your_key_here    # https://twelvedata.com/ (free tier works)
FINNHUB_API_KEY=your_key_here        # https://finnhub.io/ (free tier works)
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Run tests

```bash
npm test
```

## Architecture

```
src/
├── lib/
│   ├── detection/          # Core detection algorithms (standalone, testable)
│   │   ├── determineBias.ts    # 1D fractal swing + BOS/CHoCH
│   │   ├── detectFVG.ts        # Fair Value Gap detection
│   │   ├── detectLiquiditySweep.ts  # Liquidity levels + sweep detection
│   │   ├── detectBreaker.ts    # Breaker block detection
│   │   └── atr.ts              # ATR utility
│   ├── analysis/
│   │   └── analyzePair.ts      # Multi-TF confluence orchestrator
│   ├── data/
│   │   ├── twelveData.ts       # Twelve Data API client
│   │   └── finnhub.ts          # Finnhub economic calendar
│   └── types.ts                # All TypeScript types + settings
├── app/
│   ├── page.tsx                # Main dashboard
│   └── api/
│       ├── scan/route.ts       # POST /api/scan — full scan endpoint
│       └── candles/route.ts    # GET /api/candles — chart data
├── components/
│   ├── PairCard.tsx            # Status card per currency pair
│   ├── ChartModal.tsx          # TradingView chart with overlays
│   └── SettingsPanel.tsx       # Configurable strategy parameters
├── store/
│   └── useScannerStore.ts      # Zustand state management
└── __tests__/
    └── detection.test.ts       # Unit tests for all detection functions
```

## Configurable Parameters (Settings Panel)

| Parameter | Default | Description |
|-----------|---------|-------------|
| Swing Lookback | 2 | N candles per side for fractal detection |
| FVG Min ATR% | 20% | Minimum gap size as percentage of ATR |
| ATR Period | 14 | ATR calculation lookback |
| Equal Level Tolerance | 3 pips | How close prices must be for "equal" highs/lows |
| Sweep Wick ATR% | 10% | Min wick beyond level as % of ATR |
| News Warning | 120 min | Warn before high-impact news events |

## Disclaimer

⚠️ This tool is for personal technical analysis automation and does not constitute financial advice.
