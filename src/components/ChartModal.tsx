'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';
import type { PairAnalysis, Timeframe } from '@/lib/types';

interface ChartModalProps {
  analysis: PairAnalysis;
  onClose: () => void;
}

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '15M', value: '15min' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1day' },
];

export function ChartModal({ analysis, onClose }: ChartModalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('1h');
  const [isLoading, setIsLoading] = useState(false);

  const drawOverlays = useCallback((timeframe: Timeframe) => {
    if (!seriesRef.current) return;

    // Draw 4H FVG zone markers
    if (timeframe === '4h' && analysis.conditions.fourHourFVG.fvg) {
      const fvg = analysis.conditions.fourHourFVG.fvg;
      const markers = [{
        time: (fvg.startTimestamp / 1000) as Time,
        position: fvg.direction === 'bullish' ? 'belowBar' as const : 'aboveBar' as const,
        color: fvg.direction === 'bullish' ? '#10b981' : '#ef4444',
        shape: 'square' as const,
        text: `FVG ${fvg.direction === 'bullish' ? '▲' : '▼'}`,
      }];
      seriesRef.current.setMarkers(markers);
    }

    // Draw 1H liquidity levels
    if (timeframe === '1h' && analysis.conditions.oneHourLiquidity.level) {
      const level = analysis.conditions.oneHourLiquidity.level;
      // Price lines for liquidity levels
      seriesRef.current.createPriceLine({
        price: level.price,
        color: '#f59e0b',
        lineWidth: 1,
        lineStyle: 2, // dashed
        axisLabelVisible: true,
        title: `LQ ${level.type} (${level.touches} touches)`,
      });
    }

    // Draw 15M breaker block
    if (timeframe === '15min' && analysis.conditions.fifteenMinTrigger.breaker) {
      const breaker = analysis.conditions.fifteenMinTrigger.breaker;
      // Show breaker as price lines (top and bottom of zone)
      seriesRef.current.createPriceLine({
        price: breaker.top,
        color: '#8b5cf6',
        lineWidth: 1,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'Breaker Top',
      });
      seriesRef.current.createPriceLine({
        price: breaker.bottom,
        color: '#8b5cf6',
        lineWidth: 1,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'Breaker Bottom',
      });
    }

    // Mark sweep candle
    if (timeframe === '15min' && analysis.conditions.fifteenMinTrigger.sweep) {
      const sweep = analysis.conditions.fifteenMinTrigger.sweep;
      const markers = [{
        time: (sweep.timestamp / 1000) as Time,
        position: 'aboveBar' as const,
        color: '#f97316',
        shape: 'arrowDown' as const,
        text: 'SWEEP',
      }];
      seriesRef.current.setMarkers(markers);
    }
  }, [analysis.conditions]);

  const loadCandles = useCallback(async (timeframe: Timeframe) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/candles?pair=${encodeURIComponent(analysis.pair)}&timeframe=${timeframe}`);
      if (!res.ok) throw new Error('Failed to fetch candles');
      const data = await res.json();

      if (seriesRef.current && data.candles) {
        const chartData: CandlestickData[] = data.candles.map((c: { timestamp: number; open: number; high: number; low: number; close: number }) => ({
          time: (c.timestamp / 1000) as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        seriesRef.current.setData(chartData);

        // Draw FVG zones as overlays if present
        drawOverlays(timeframe);

        chartRef.current?.timeScale().fitContent();
      }
    } catch (err) {
      console.error('Failed to load candles:', err);
    } finally {
      setIsLoading(false);
    }
  }, [analysis.pair, drawOverlays]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: 0,
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#334155',
      },
    });

    chartRef.current = chart;

    const series = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    seriesRef.current = series;

    // Load initial data
    loadCandles(activeTimeframe);

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadCandles(activeTimeframe);
  }, [activeTimeframe, loadCandles]);

  const biasColor = analysis.bias === 'bullish' ? 'text-emerald-400' : analysis.bias === 'bearish' ? 'text-rose-400' : 'text-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-[95vw] max-w-5xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white font-mono">{analysis.pair}</h2>
            <span className={`text-sm font-semibold uppercase ${biasColor}`}>
              1D Bias: {analysis.bias}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl p-1">✕</button>
        </div>

        {/* Timeframe selector */}
        <div className="flex gap-1 p-4 pb-0">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setActiveTimeframe(tf.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTimeframe === tf.value
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
              }`}
            >
              {tf.label}
            </button>
          ))}
          {isLoading && <span className="text-xs text-slate-500 self-center ml-2">Loading...</span>}
        </div>

        {/* Chart */}
        <div className="p-4">
          <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" />
        </div>

        {/* Analysis details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 pt-0">
          <DetailBox
            title="1D Bias"
            met={analysis.conditions.dailyBias.met}
            detail={analysis.conditions.dailyBias.direction}
          />
          <DetailBox
            title="4H FVG"
            met={analysis.conditions.fourHourFVG.met}
            detail={analysis.conditions.fourHourFVG.fvg
              ? `${analysis.conditions.fourHourFVG.fvg.direction} gap: ${analysis.conditions.fourHourFVG.fvg.gapSize.toFixed(5)}`
              : 'None detected'}
          />
          <DetailBox
            title="1H Liquidity"
            met={analysis.conditions.oneHourLiquidity.met}
            detail={analysis.conditions.oneHourLiquidity.level
              ? `${analysis.conditions.oneHourLiquidity.level.type} @ ${analysis.conditions.oneHourLiquidity.level.price.toFixed(5)}`
              : 'None detected'}
          />
          <DetailBox
            title="15M Trigger"
            met={analysis.conditions.fifteenMinTrigger.met}
            detail={analysis.conditions.fifteenMinTrigger.breaker
              ? `Breaker: ${analysis.conditions.fifteenMinTrigger.breaker.bottom.toFixed(5)} - ${analysis.conditions.fifteenMinTrigger.breaker.top.toFixed(5)}`
              : 'Waiting for sweep + breaker'}
          />
        </div>

        {/* News warnings */}
        {analysis.upcomingNews.length > 0 && (
          <div className="mx-4 mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="text-amber-400 text-sm font-semibold mb-1">⚠️ Upcoming High-Impact News</div>
            {analysis.upcomingNews.map((event, i) => (
              <div key={i} className="text-xs text-amber-300/80">
                {event.currency} — {event.title} ({new Date(event.datetime).toLocaleTimeString()})
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailBox({ title, met, detail }: { title: string; met: boolean; detail: string }) {
  return (
    <div className={`p-3 rounded-lg border ${met ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-800/50 border-slate-700'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={met ? 'text-emerald-400' : 'text-slate-500'}>{met ? '✓' : '○'}</span>
        <span className="text-xs font-semibold text-slate-300">{title}</span>
      </div>
      <div className="text-xs text-slate-400">{detail}</div>
    </div>
  );
}
