// ─────────────────────────────────────────────────────
// Persistent & In-Memory Multi-Timeframe Candle Cache
// Eliminates redundant Twelve Data API calls to stay under
// the 8 requests/minute free tier rate limit.
// ─────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import type { Candle, Timeframe } from '../types';

interface CacheEntry {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  updatedAt: number;
  expiresAt: number;
}

// Timeframe-specific Cache Time-To-Live (TTL):
// - 1day: 6 hours (market structure changes at most once a day)
// - 4h: 90 minutes
// - 1h: 30 minutes
// - 15min: 5 minutes
const TTL_MAP: Record<Timeframe, number> = {
  '1day': 6 * 60 * 60 * 1000,
  '4h': 90 * 60 * 1000,
  '1h': 30 * 60 * 1000,
  '15min': 5 * 60 * 1000,
};

// In-memory cache map
const memoryStore = new Map<string, CacheEntry>();

// Cache directory & file for persistence across server restarts
const CACHE_DIR = path.resolve(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'twelve_data_candles.json');

// Initialize and load cache from disk on startup
function initDiskCache() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const data: Record<string, CacheEntry> = JSON.parse(raw);
      for (const [key, entry] of Object.entries(data)) {
        memoryStore.set(key, entry);
      }
      console.log(`[CandleCache] Loaded ${memoryStore.size} cached series from disk.`);
    }
  } catch (err) {
    console.warn('[CandleCache] Failed to load disk cache:', err);
  }
}

// Save memory store to disk (throttled)
let saveTimeout: NodeJS.Timeout | null = null;
function persistToDisk() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      const data: Record<string, CacheEntry> = {};
      memoryStore.forEach((v, k) => {
        data[k] = v;
      });
      fs.writeFileSync(CACHE_FILE, JSON.stringify(data), 'utf-8');
    } catch (err) {
      console.warn('[CandleCache] Failed to save disk cache:', err);
    }
  }, 2000);
}

initDiskCache();

function makeKey(symbol: string, timeframe: Timeframe): string {
  return `${symbol.toUpperCase().replace('/', '')}:${timeframe}`;
}

/**
 * Get cached candles for a symbol and timeframe.
 * Returns null if not cached.
 * Returns { candles, isStale } if found.
 */
export function getCachedCandles(
  symbol: string,
  timeframe: Timeframe,
): { candles: Candle[]; isStale: boolean } | null {
  const key = makeKey(symbol, timeframe);
  const entry = memoryStore.get(key);
  if (!entry || !entry.candles || entry.candles.length === 0) {
    return null;
  }

  const now = Date.now();
  const isStale = now > entry.expiresAt;

  return {
    candles: entry.candles,
    isStale,
  };
}

/**
 * Store candles in cache with timeframe-appropriate TTL.
 */
export function setCachedCandles(
  symbol: string,
  timeframe: Timeframe,
  candles: Candle[],
): void {
  if (!candles || candles.length === 0) return;

  const key = makeKey(symbol, timeframe);
  const now = Date.now();
  const ttl = TTL_MAP[timeframe] || 5 * 60 * 1000;

  const entry: CacheEntry = {
    symbol,
    timeframe,
    candles,
    updatedAt: now,
    expiresAt: now + ttl,
  };

  memoryStore.set(key, entry);
  persistToDisk();
}

/**
 * Get cache stats for debugging and UI.
 */
export function getCacheStats() {
  const now = Date.now();
  let validCount = 0;
  let staleCount = 0;

  memoryStore.forEach((entry) => {
    if (now <= entry.expiresAt) {
      validCount++;
    } else {
      staleCount++;
    }
  });

  return {
    totalEntries: memoryStore.size,
    validEntries: validCount,
    staleEntries: staleCount,
  };
}

