'use client';

import React from 'react';
import type { PairAnalysis } from '@/lib/types';

interface PairCardProps {
  analysis: PairAnalysis;
  onClick: () => void;
}

const STATUS_CONFIG = {
  ENTRY_TRIGGERED: {
    emoji: '🟢',
    label: 'ENTRY TRIGGERED',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
  },
  SETUP_FORMING: {
    emoji: '🟡',
    label: 'SETUP FORMING',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20',
  },
  NO_SETUP: {
    emoji: '🔴',
    label: 'NO SETUP',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    glow: 'shadow-red-500/10',
  },
};

function ConditionCheck({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={met ? 'text-emerald-400' : 'text-slate-500'}>
        {met ? '✓' : '○'}
      </span>
      <span className={met ? 'text-slate-200' : 'text-slate-500'}>{label}</span>
    </div>
  );
}

export function PairCard({ analysis, onClick }: PairCardProps) {
  const config = STATUS_CONFIG[analysis.status];
  const isJpy = analysis.pair.includes('JPY');
  const pricePrecision = isJpy ? 3 : 5;

  const biasArrow = analysis.bias === 'bullish' ? '↗' : analysis.bias === 'bearish' ? '↘' : '→';
  const biasColor = analysis.bias === 'bullish'
    ? 'text-emerald-400'
    : analysis.bias === 'bearish'
    ? 'text-rose-400'
    : 'text-slate-400';

  return (
    <div
      onClick={onClick}
      className={`
        relative cursor-pointer rounded-xl border p-5 transition-all duration-200
        hover:scale-[1.02] hover:shadow-lg
        ${config.bg} ${config.border} shadow-md ${config.glow}
      `}
    >
      {/* News warning badge */}
      {analysis.newsWarning && (
        <div className="absolute top-3 right-3 flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
          ⚠️ News
        </div>
      )}

      {/* Pair name and status */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-bold text-white font-mono">{analysis.pair}</h3>
          <div className={`text-sm font-medium ${biasColor} flex items-center gap-1`}>
            <span className="text-lg">{biasArrow}</span>
            <span className="uppercase">{analysis.bias}</span>
          </div>
        </div>
        <div className={`text-xs font-bold ${config.text} ${config.bg} border ${config.border} rounded-full px-3 py-1`}>
          {config.emoji} {config.label}
        </div>
      </div>

      {/* Current price */}
      <div className="text-xl font-mono font-bold text-white mb-4">
        {analysis.currentPrice > 0 ? analysis.currentPrice.toFixed(pricePrecision) : '—'}
      </div>

      {/* Conditions checklist */}
      <div className="space-y-1.5 mb-4">
        <ConditionCheck
          met={analysis.conditions.dailyBias.met}
          label={`1D Bias: ${analysis.conditions.dailyBias.direction}`}
        />
        <ConditionCheck
          met={analysis.conditions.fourHourFVG.met}
          label="4H FVG aligned"
        />
        <ConditionCheck
          met={analysis.conditions.oneHourLiquidity.met}
          label="1H Liquidity + FVG"
        />
        <ConditionCheck
          met={analysis.conditions.fifteenMinTrigger.met}
          label="15M Breaker + FVG"
        />
      </div>

      {/* Distance to zone */}
      {analysis.distanceToZone !== null && (
        <div className="text-xs text-slate-400">
          Distance to zone: <span className="text-slate-300 font-mono">{analysis.distanceToZone.toFixed(1)} pips</span>
        </div>
      )}

      {/* Last evaluated timestamp */}
      <div className="text-xs text-slate-600 mt-2">
        Updated: {new Date(analysis.lastEvaluated).toLocaleTimeString()}
      </div>
    </div>
  );
}
