/**
 * data.gov.in Mandi Price API client.
 * Fetches daily commodity prices from ALL Indian mandis.
 *
 * Architecture:
 * 1. Fetch ALL records paginated (100 per page, up to 60 pages)
 * 2. Filter client-side by state/district/commodity
 * 3. Cache in localStorage with date key
 * 4. Fallback to yesterday's cache if today's fetch fails
 */

const RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const BASE_URL = 'https://api.data.gov.in/resource';
const PAGE_SIZE = 100;
const CACHE_KEY = 'rythu_mitra_mandi_cache';
const API_KEY_STORAGE = 'rythu_mitra_mandi_api_key';

export interface MandiRecord {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  grade: string;
  arrival_date: string; // "17/03/2026"
  min_price: number;    // Rs per quintal
  max_price: number;
  modal_price: number;  // most common price
}

export interface MandiCache {
  date: string;       // "2026-03-17"
  fetchedAt: string;  // ISO timestamp
  records: MandiRecord[];
  total: number;
}

// --- API Key Management ---

export function getMandiApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

export function setMandiApiKey(key: string): void {
  if (key) {
    localStorage.setItem(API_KEY_STORAGE, key);
  } else {
    localStorage.removeItem(API_KEY_STORAGE);
  }
}

// --- Raw API response shape ---

interface RawMandiRecord {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  grade: string;
  arrival_date: string;
  min_price: string | number;
  max_price: string | number;
  modal_price: string | number;
}

interface ApiPage {
  total: number;
  count: number;
  records: RawMandiRecord[];
}

function parseRecord(r: RawMandiRecord): MandiRecord {
  return {
    state: r.state || '',
    district: r.district || '',
    market: r.market || '',
    commodity: r.commodity || '',
    variety: r.variety || '',
    grade: r.grade || '',
    arrival_date: r.arrival_date || '',
    min_price: Number(r.min_price) || 0,
    max_price: Number(r.max_price) || 0,
    modal_price: Number(r.modal_price) || 0,
  };
}

// --- Fetch Logic ---

/** Fetch one page of mandi data */
async function fetchPage(
  apiKey: string,
  offset: number,
): Promise<{ records: MandiRecord[]; total: number }> {
  const url = `${BASE_URL}/${RESOURCE_ID}?api-key=${apiKey}&format=json&limit=${PAGE_SIZE}&offset=${offset}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`data.gov.in API error: ${response.status} ${response.statusText}`);
  }
  const data: ApiPage = await response.json();
  return {
    records: (data.records || []).map(parseRecord),
    total: data.total || 0,
  };
}

/**
 * Fetch ALL mandi prices for today (paginated).
 * Progress callback: (fetched, total) for UI updates.
 */
export async function fetchAllMandiPrices(
  apiKey: string,
  onProgress?: (fetched: number, total: number) => void,
): Promise<MandiRecord[]> {
  // First page to get total
  const first = await fetchPage(apiKey, 0);
  const allRecords: MandiRecord[] = [...first.records];
  const total = first.total;

  onProgress?.(allRecords.length, total);

  // Fetch remaining pages (max 60 pages = 6000 records, safety limit)
  const maxPages = Math.min(Math.ceil(total / PAGE_SIZE), 60);

  // Fetch 3 pages at a time (parallel but not overwhelming)
  for (let page = 1; page < maxPages; page += 3) {
    const batch: Promise<{ records: MandiRecord[]; total: number }>[] = [];
    for (let i = page; i < Math.min(page + 3, maxPages); i++) {
      batch.push(fetchPage(apiKey, i * PAGE_SIZE));
    }
    const results = await Promise.allSettled(batch);
    for (const r of results) {
      if (r.status === 'fulfilled') {
        allRecords.push(...r.value.records);
      }
    }
    onProgress?.(allRecords.length, total);
  }

  return allRecords;
}

// --- Cache ---

export function getCachedPrices(): MandiCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MandiCache;
  } catch {
    return null;
  }
}

export function cachePrices(records: MandiRecord[]): MandiCache {
  const today = new Date().toISOString().slice(0, 10);
  const cache: MandiCache = {
    date: today,
    fetchedAt: new Date().toISOString(),
    records,
    total: records.length,
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  return cache;
}

/** Is the cache fresh enough? (same calendar day) */
export function isCacheFresh(): boolean {
  const cache = getCachedPrices();
  if (!cache) return false;
  return cache.date === new Date().toISOString().slice(0, 10);
}

/** Is the cache from yesterday? */
export function isCacheYesterday(): boolean {
  const cache = getCachedPrices();
  if (!cache) return false;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return cache.date === yesterday;
}

/** Data freshness label for UI */
export type FreshnessLabel = 'live' | 'yesterday' | 'seed';

export function getCacheFreshness(): FreshnessLabel {
  if (isCacheFresh()) return 'live';
  if (isCacheYesterday()) return 'yesterday';
  return 'seed';
}

// --- Filtering ---

/** Filter records for AP/Telangana states */
export function filterForAP(records: MandiRecord[]): MandiRecord[] {
  return records.filter(
    r => r.state === 'Andhra Pradesh' || r.state === 'Telangana',
  );
}

/** Filter by commodity name (English, case-insensitive partial match) */
export function filterByCommodity(records: MandiRecord[], commodity: string): MandiRecord[] {
  const lower = commodity.toLowerCase();
  return records.filter(r => r.commodity.toLowerCase().includes(lower));
}

// --- Format conversion ---

/**
 * Convert MandiRecord array to STDB-compatible market_price rows.
 * Groups by commodity, finds best mandi per crop, maps Telugu name.
 * Returns array ready for populating marketPricesStore.
 */
export function mandiRecordsToStoreFormat(
  records: MandiRecord[],
): StoreMarketPrice[] {
  // Group by commodity
  const byCommodity = new Map<string, MandiRecord[]>();
  for (const r of records) {
    const existing = byCommodity.get(r.commodity) || [];
    existing.push(r);
    byCommodity.set(r.commodity, existing);
  }

  const result: StoreMarketPrice[] = [];
  let idCounter = BigInt(1);

  // Parse DD/MM/YYYY -> YYYY-MM-DD
  function parseDate(s: string): string {
    const parts = s.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return s;
  }

  for (const [englishCrop, cropRecords] of byCommodity) {
    const teluguCrop = CROP_MAP_EN_TO_TE[englishCrop];
    // Only convert crops we know how to name in Telugu
    const cropName = teluguCrop || englishCrop;
    const mspRupees = MSP_RATES[englishCrop] || 0;

    // Use the latest arrival_date
    const sorted = [...cropRecords].sort((a, b) => {
      const da = parseDate(a.arrival_date);
      const db = parseDate(b.arrival_date);
      return db.localeCompare(da);
    });
    const latestDate = sorted.length > 0 ? parseDate(sorted[0].arrival_date) : '';

    // One row per mandi for the latest date
    const latestRecords = sorted.filter(r => parseDate(r.arrival_date) === latestDate);

    for (const r of latestRecords) {
      result.push({
        id: idCounter,
        crop: cropName,
        mandi: r.market,
        district: r.district,
        pricePerQuintalPaise: BigInt(Math.round(r.modal_price * 100)),
        mspPricePaise: BigInt(Math.round(mspRupees * 100)),
        date: latestDate,
      });
      idCounter = idCounter + BigInt(1);
    }
  }

  return result;
}

/** Shape matching STDB MarketPrice table for injection into marketPricesStore */
export interface StoreMarketPrice {
  id: bigint;
  crop: string;
  mandi: string;
  district: string;
  pricePerQuintalPaise: bigint;
  mspPricePaise: bigint;
  date: string;
}

// --- Crop name mapping ---

/** Telugu -> English (for API query context) */
export const CROP_MAP_TE_TO_EN: Record<string, string> = {
  'వేరుశెనగ': 'Groundnut',
  'పత్తి': 'Cotton',
  'మొక్కజొన్న': 'Maize',
  'కంది': 'Arhar (Tur/Red Gram)',
  'వరి': 'Paddy(Dhan)',
  'మిర్చి': 'Chillies',
  'పసుపు': 'Turmeric',
  'ఉల్లి': 'Onion',
  'టమాటా': 'Tomato',
};

/** English -> Telugu (for converting API results back to app names) */
export const CROP_MAP_EN_TO_TE: Record<string, string> = {
  'Groundnut': 'వేరుశెనగ',
  'Cotton': 'పత్తి',
  'Maize': 'మొక్కజొన్న',
  'Arhar (Tur/Red Gram)': 'కంది',
  'Paddy(Dhan)': 'వరి',
  'Chillies': 'మిర్చి',
  'Turmeric': 'పసుపు',
  'Onion': 'ఉల్లి',
  'Tomato': 'టమాటా',
};

/** MSP 2025-26 in Rs/quintal (official government rates) */
export const MSP_RATES: Record<string, number> = {
  'Groundnut': 6377,
  'Cotton': 7121,
  'Maize': 2225,
  'Arhar (Tur/Red Gram)': 7550,
  'Paddy(Dhan)': 2300,
};
