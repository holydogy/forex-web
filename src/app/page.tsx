'use client';

import React, { useState } from 'react';
import { useScannerStore } from '@/store/useScannerStore';
import { PairCard } from '@/components/PairCard';
import { ChartModal } from '@/components/ChartModal';
import { SettingsPanel } from '@/components/SettingsPanel';

export default function Home() {
  const {
    analyses,
    selectedPair,
    setSelectedPair,
    selectedSymbol,
    setSelectedSymbol,
    settings,
    isLoading,
    analyzingSymbol,
    lastRefresh,
    error,
    analyzePair,
    refreshAll,
    isLive,
  } = useScannerStore();

  const [showSettings, setShowSettings] = useState(false);

  // Active pair analysis (if it has been analyzed yet)
  const currentAnalysis = analyses.find((a) => a.pair === selectedSymbol);
  // Other previously analyzed pairs in session
  const otherAnalyses = analyses.filter((a) => a.pair !== selectedSymbol);

  const selectedChartAnalysis = analyses.find((a) => a.pair === selectedPair) ?? null;

  const entryCount = analyses.filter((a) => a.status === 'ENTRY_TRIGGERED').length;
  const formingCount = analyses.filter((a) => a.status === 'SETUP_FORMING').length;
  const noSetupCount = analyses.filter((a) => a.status === 'NO_SETUP').length;

  return (
    <main className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* ─── Header ─── */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Logo & Strategy Title */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20 text-base">
                FX
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  Multi-Timeframe Confluence Scanner
                </h1>
                <p className="text-xs text-slate-400">
                  ICT Strategy: 1D Market Bias → 4H FVG → 1H Liquidity → 15M Breaker & FVG Trigger
                </p>
              </div>
            </div>

            {/* Header Controls & Status */}
            <div className="flex items-center gap-3">
              {/* Data Source Status Badge */}
              {isLive ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Twelve Data
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/10 border border-cyan-500/30 text-cyan-400" title="API keys configured in .env.local">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  Ready (On-Demand)
                </span>
              )}

              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition shadow-sm"
              >
                ⚙ Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* ─── Single-Pair Selection & Analysis Bar ─── */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 flex-1 max-w-lg">
              <label htmlFor="pair-select" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Select Currency Pair to Analyze
              </label>
              <div className="flex items-center gap-3">
                <select
                  id="pair-select"
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  disabled={isLoading}
                  className="bg-slate-950 border border-slate-700 focus:border-cyan-500 text-white rounded-xl px-4 py-3 font-mono font-semibold text-base w-full focus:outline-none transition cursor-pointer"
                >
                  {settings.watchlist.map((pair) => (
                    <option key={pair} value={pair} className="bg-slate-900 text-white font-mono">
                      {pair}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => analyzePair(selectedSymbol)}
                  disabled={isLoading}
                  className="flex-shrink-0 flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl font-semibold text-sm transition shadow-lg disabled:opacity-50 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold"
                >
                  {isLoading && analyzingSymbol === selectedSymbol ? (
                    <>
                      <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      Analyzing {selectedSymbol}...
                    </>
                  ) : (
                    <>
                      <span>⚡ Analyze {selectedSymbol}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Metrics & Batch Option */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-xs text-slate-400 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
              <div className="space-y-1">
                <div className="text-slate-300 font-medium">⚡ On-Demand Throttling</div>
                <div className="text-slate-500">
                  Fetches 4 timeframes (1D, 4H, 1H, 15M) for just this pair. Stays safely under Twelve Data&apos;s 8 req/min limit.
                </div>
              </div>

              <button
                onClick={() => refreshAll()}
                disabled={isLoading}
                title="Sequentially scan all 7 pairs with rate-limit pacing"
                className="flex-shrink-0 text-xs px-3 py-2 rounded-lg border border-slate-800 bg-slate-950/70 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
              >
                Scan All 7 (Batch)
              </button>
            </div>
          </div>

          {/* Rate limit status / Error alert */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* ─── Active Pair Analysis Card ─── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span>Current Evaluation:</span>
              <span className="text-cyan-400 font-mono font-bold">{selectedSymbol}</span>
            </h2>
            {currentAnalysis && (
              <span className="text-xs text-slate-500">
                Last checked: {new Date(currentAnalysis.lastEvaluated).toLocaleTimeString()}
              </span>
            )}
          </div>

          {currentAnalysis ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Result card */}
              <PairCard
                analysis={currentAnalysis}
                onClick={() => setSelectedPair(currentAnalysis.pair)}
              />

              {/* Quick Strategy Summary Box */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-2">Strategy Confluence Breakdown</h3>
                  <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
                    <p>
                      • <strong className="text-slate-200">1D Bias:</strong> Market structure using fractal swing highs/lows with BOS/CHoCH shift confirmation.
                    </p>
                    <p>
                      • <strong className="text-slate-200">4H FVG:</strong> 3-candle Fair Value Gap matching 1D bias direction.
                    </p>
                    <p>
                      • <strong className="text-slate-200">1H Liquidity:</strong> Equal highs/lows or major swing stop pools near the 4H FVG zone with aligned 1H FVG.
                    </p>
                    <p>
                      • <strong className="text-slate-200">15M Trigger:</strong> Liquidity sweep (wick beyond + close inside) followed by breaker block and FVG retest.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedPair(currentAnalysis.pair)}
                    className="w-full py-2.5 px-4 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-semibold transition text-center flex items-center justify-center gap-2"
                  >
                    <span>📊 Open Candlestick Chart with Strategy Overlays</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center bg-slate-900/20 space-y-3">
              <div className="text-4xl">🎯</div>
              <h3 className="text-base font-semibold text-slate-200">
                Ready to analyze {selectedSymbol}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click the <strong className="text-emerald-400">&quot;Analyze {selectedSymbol}&quot;</strong> button above to fetch multi-timeframe candles (1D, 4H, 1H, 15M) and evaluate full ICT confluence.
              </p>
              <button
                onClick={() => analyzePair(selectedSymbol)}
                disabled={isLoading}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow"
              >
                <span>⚡ Run Analysis Now</span>
              </button>
            </div>
          )}
        </section>

        {/* ─── Previously Analyzed Pairs (Session Grid) ─── */}
        {otherAnalyses.length > 0 && (
          <section className="space-y-4 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Other Analyzed Pairs This Session ({otherAnalyses.length})
              </h2>
              <div className="text-xs text-slate-500">
                Click any card to inspect or open chart
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {otherAnalyses.map((analysis) => (
                <div key={analysis.pair} className="relative group">
                  <PairCard
                    analysis={analysis}
                    onClick={() => {
                      setSelectedSymbol(analysis.pair);
                      setSelectedPair(analysis.pair);
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Disclaimer ─── */}
        <div className="text-center text-xs text-slate-600 py-6 border-t border-slate-800/50">
          ⚠️ This tool is for personal technical analysis automation and does not constitute financial advice.
        </div>
      </div>

      {/* ─── Modals ─── */}
      {selectedChartAnalysis && (
        <ChartModal analysis={selectedChartAnalysis} onClose={() => setSelectedPair(null)} />
      )}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </main>
  );
}
