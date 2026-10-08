// ─────────────────────────────────────────────────────
// Zustand store for the Multi-Timeframe Confluence Scanner
// Supports single-pair on-demand analysis and caching
// ─────────────────────────────────────────────────────

import { create } from 'zustand';
import type { PairAnalysis, StrategySettings, NewsEvent } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';

interface ScannerStore {
  // Selected symbol in dropdown
  selectedSymbol: string;
  // Analysis results (accumulated in current session)
  analyses: PairAnalysis[];
  // Which pair's chart is currently open in modal (null = none)
  selectedPair: string | null;
  // Settings
  settings: StrategySettings;
  // Loading state
  isLoading: boolean;
  analyzingSymbol: string | null;
  lastRefresh: number | null;
  error: string | null;
  // News events
  newsEvents: NewsEvent[];
  // Data source status
  isLive: boolean;

  // Actions
  setSelectedSymbol: (symbol: string) => void;
  setAnalyses: (analyses: PairAnalysis[]) => void;
  updateAnalysis: (pair: string, analysis: PairAnalysis) => void;
  setSelectedPair: (pair: string | null) => void;
  setSettings: (settings: Partial<StrategySettings>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setNewsEvents: (events: NewsEvent[]) => void;
  analyzePair: (pairToAnalyze?: string) => Promise<void>;
  refreshAll: () => Promise<void>;
}

export const useScannerStore = create<ScannerStore>((set, get) => ({
  selectedSymbol: 'EUR/USD',
  analyses: [],
  selectedPair: null,
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  analyzingSymbol: null,
  lastRefresh: null,
  error: null,
  newsEvents: [],
  isLive: false,

  setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol }),
  setAnalyses: (analyses) => set({ analyses, lastRefresh: Date.now() }),
  updateAnalysis: (pair, analysis) =>
    set((state) => ({
      analyses: state.analyses.map((a) => (a.pair === pair ? analysis : a)),
    })),
  setSelectedPair: (pair) => set({ selectedPair: pair }),
  setSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setNewsEvents: (newsEvents) => set({ newsEvents }),

  /**
   * Analyze a single pair on-demand (only 4 API calls max, or 0 if cached!)
   */
  analyzePair: async (pairToAnalyze?: string) => {
    const state = get();
    const symbol = pairToAnalyze || state.selectedSymbol;
    set({ isLoading: true, analyzingSymbol: symbol, error: null });

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pair: symbol, settings: state.settings }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const data = await response.json();
      const newAnalysis: PairAnalysis | undefined = data.analyses?.[0];

      if (newAnalysis) {
        set((current) => {
          const exists = current.analyses.some((a) => a.pair === newAnalysis.pair);
          const updated = exists
            ? current.analyses.map((a) => (a.pair === newAnalysis.pair ? newAnalysis : a))
            : [newAnalysis, ...current.analyses];
          return {
            analyses: updated,
            newsEvents: data.newsEvents ?? current.newsEvents,
            isLive: Boolean(data.isLive),
            lastRefresh: Date.now(),
            isLoading: false,
            analyzingSymbol: null,
          };
        });
      } else {
        set({ isLoading: false, analyzingSymbol: null });
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Unknown error',
        isLoading: false,
        analyzingSymbol: null,
      });
    }
  },

  /**
   * Scan all watchlist pairs (throttled & cached)
   */
  refreshAll: async () => {
    const state = get();
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: state.settings }),
      });
      if (!response.ok) {
        throw new Error(`Scan failed: ${response.statusText}`);
      }
      const data = await response.json();
      set({
        analyses: data.analyses,
        newsEvents: data.newsEvents ?? [],
        isLive: Boolean(data.isLive),
        lastRefresh: Date.now(),
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Unknown error',
        isLoading: false,
      });
    }
  },
}));
