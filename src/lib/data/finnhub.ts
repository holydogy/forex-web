// ─────────────────────────────────────────────────────
// Finnhub & Economic Calendar Integration
//
// NOTE: Finnhub's `/calendar/economic` endpoint is restricted to
// paid/premium subscriptions and returns HTTP 403 Forbidden on free accounts.
//
// On the free tier, Finnhub provides:
// - `GET /api/v1/news?category=forex` (Market News: Forex)
// - `GET /api/v1/news?category=general` (Market News: General)
//
// For the multi-timeframe ICT strategy's economic calendar requirements,
// we automatically use the live Forex Factory calendar feed (via economicCalendar.ts)
// which is 100% free and provides exact high-impact release times for all pairs.
// Finnhub free tier is used for breaking market news.
// ─────────────────────────────────────────────────────

import type { NewsEvent } from '../types';
import { fetchEconomicCalendar as fetchFFCalendar } from './economicCalendar';

const BASE_URL = 'https://finnhub.io/api/v1';

export interface FinnhubNewsItem {
  id: number;
  category: string;
  datetime: number;
  headline: string;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

/**
 * Fetch breaking forex news from Finnhub's Free Tier endpoint:
 * `GET /api/v1/news?category=forex`
 */
export async function fetchFinnhubForexNews(apiKey: string): Promise<FinnhubNewsItem[]> {
  if (!apiKey || apiKey === 'your_finnhub_key_here') return [];

  try {
    const url = new URL(`${BASE_URL}/news`);
    url.searchParams.set('category', 'forex');
    url.searchParams.set('token', apiKey);

    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      if (res.status === 403) {
        console.warn('[Finnhub] 403 Forbidden on news endpoint. Check token permissions.');
      } else {
        console.warn(`[Finnhub] News endpoint returned ${res.status} ${res.statusText}`);
      }
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[Finnhub] Error fetching forex news:', err);
    return [];
  }
}

/**
 * Unified economic calendar fetcher.
 * Uses the free Forex Factory feed to avoid Finnhub 403 Forbidden errors,
 * while seamlessly remaining backward-compatible with all scanner callers.
 */
export async function fetchEconomicCalendar(
  _apiKey?: string,
  _fromDate?: string,
  _toDate?: string,
): Promise<NewsEvent[]> {
  return fetchFFCalendar();
}

/**
 * Helper to get calendar date range.
 */
export function getCalendarDateRange(): { from: string; to: string } {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const format = (d: Date) => d.toISOString().split('T')[0];
  return { from: format(now), to: format(tomorrow) };
}
