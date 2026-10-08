// ─────────────────────────────────────────────────────
// Economic Calendar Provider
// Uses the Forex Factory / Fair Economy live calendar feed
// (100% free, accurate, no API key required, reliable for Forex)
// Caches for 30 minutes to respect server rate limits.
// ─────────────────────────────────────────────────────

import type { NewsEvent } from '../types';
import { SAMPLE_NEWS_EVENTS } from './sampleHistoricalData';

const FAIR_ECONOMY_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

interface CachedCalendar {
  events: NewsEvent[];
  expiresAt: number;
}

let memoryCache: CachedCalendar | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface FairEconomyEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast?: string;
  previous?: string;
}

/**
 * Fetch weekly economic calendar events.
 * Automatically caches for 30 minutes.
 */
export async function fetchEconomicCalendar(): Promise<NewsEvent[]> {
  const now = Date.now();

  // Return cached events if still fresh
  if (memoryCache && memoryCache.expiresAt > now) {
    return memoryCache.events;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(FAIR_ECONOMY_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ForexConfluenceScanner/1.0',
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[EconomicCalendar] Forex Factory returned status ${response.status}`);
      if (memoryCache) return memoryCache.events;
      return SAMPLE_NEWS_EVENTS;
    }

    const data: FairEconomyEvent[] = await response.json();

    if (!Array.isArray(data)) {
      console.warn('[EconomicCalendar] Invalid response shape from Forex Factory');
      if (memoryCache) return memoryCache.events;
      return SAMPLE_NEWS_EVENTS;
    }

    const events: NewsEvent[] = data.map((item) => {
      const parsedTime = new Date(item.date).getTime();
      return {
        title: item.title || 'Economic Release',
        country: item.country || 'Global',
        currency: normalizeCurrency(item.country),
        impact: mapImpact(item.impact),
        datetime: isNaN(parsedTime) ? now : parsedTime,
        estimate: item.forecast || undefined,
        previous: item.previous || undefined,
      };
    });

    // Update memory cache
    memoryCache = {
      events,
      expiresAt: now + CACHE_TTL_MS,
    };

    console.log(`[EconomicCalendar] Loaded ${events.length} calendar events from Forex Factory`);
    return events;
  } catch (err) {
    console.warn('[EconomicCalendar] Failed to fetch Forex Factory feed, using fallback:', err);
    if (memoryCache) return memoryCache.events;
    return SAMPLE_NEWS_EVENTS;
  }
}

function mapImpact(impact: string): 'high' | 'medium' | 'low' {
  const norm = (impact || '').toLowerCase();
  if (norm.includes('high') || norm === '3') return 'high';
  if (norm.includes('med') || norm === '2') return 'medium';
  return 'low';
}

function normalizeCurrency(countryOrCurrency: string): string {
  const code = (countryOrCurrency || '').toUpperCase();
  const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'NZD', 'CHF', 'CNY'];
  if (validCurrencies.includes(code)) return code;

  const map: Record<string, string> = {
    US: 'USD',
    USA: 'USD',
    EU: 'EUR',
    UK: 'GBP',
    GB: 'GBP',
    JP: 'JPY',
    AU: 'AUD',
    CA: 'CAD',
    NZ: 'NZD',
    CH: 'CHF',
    ALL: 'ALL',
  };

  return map[code] || code;
}

