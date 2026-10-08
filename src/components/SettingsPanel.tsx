'use client';

import React, { useState } from 'react';
import type { StrategySettings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { useScannerStore } from '@/store/useScannerStore';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, setSettings } = useScannerStore();
  const [local, setLocal] = useState<StrategySettings>({ ...settings });

  const update = <K extends keyof StrategySettings>(key: K, value: StrategySettings[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    setSettings(local);
    onClose();
  };

  const handleReset = () => {
    setLocal({ ...DEFAULT_SETTINGS });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-[90vw] max-w-lg max-h-[85vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">Strategy Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl p-1">✕</button>
        </div>

        <div className="p-5 space-y-6">
          {/* Swing Detection */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Swing Detection</h3>
            <NumberInput
              label="Swing Lookback (N candles per side)"
              value={local.swingLookback}
              min={1}
              max={10}
              onChange={(v) => update('swingLookback', v)}
            />
          </section>

          {/* FVG Settings */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Fair Value Gap (FVG)</h3>
            <NumberInput
              label="Min gap size (% of ATR)"
              value={local.fvgMinAtrPercent}
              min={0}
              max={100}
              step={5}
              onChange={(v) => update('fvgMinAtrPercent', v)}
            />
            <NumberInput
              label="ATR Period"
              value={local.fvgAtrPeriod}
              min={5}
              max={50}
              onChange={(v) => update('fvgAtrPeriod', v)}
            />
          </section>

          {/* Liquidity Settings */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Liquidity Detection</h3>
            <NumberInput
              label="Equal level tolerance (pips)"
              value={local.equalLevelTolerance}
              min={0}
              max={20}
              onChange={(v) => update('equalLevelTolerance', v)}
            />
            <NumberInput
              label="Sweep wick min (% of 1H ATR)"
              value={local.sweepWickAtrPercent}
              min={0}
              max={50}
              step={5}
              onChange={(v) => update('sweepWickAtrPercent', v)}
            />
          </section>

          {/* News Filter */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">News Filter</h3>
            <NumberInput
              label="Warning window (minutes before event)"
              value={local.newsWarningMinutes}
              min={15}
              max={480}
              step={15}
              onChange={(v) => update('newsWarningMinutes', v)}
            />
          </section>

          {/* Watchlist */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Watchlist</h3>
            <div className="text-xs text-slate-400 mb-2">Comma-separated pairs (e.g. EUR/USD, GBP/USD)</div>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white font-mono resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500"
              rows={3}
              value={local.watchlist.join(', ')}
              onChange={(e) => {
                const pairs = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                update('watchlist', pairs);
              }}
            />
          </section>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between p-5 border-t border-slate-800">
          <button
            onClick={handleReset}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Reset to defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors font-medium"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <label className="text-sm text-slate-400">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm text-white text-center font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
      />
    </div>
  );
}
