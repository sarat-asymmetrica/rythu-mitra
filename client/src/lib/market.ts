/**
 * Market price analytics service for Rythu Mitra.
 *
 * Derives crop summaries, trend data, mandi comparisons, and market insights
 * from raw STDB market_price rows. Pure computation, no AI dependency.
 *
 * All prices stored as paise (u64). Displayed as rupees with ₹ prefix.
 */

import type { MarketPrice as StdbMarketPrice } from '../module_bindings/types';

// ---------------------------------------------------------------------------
// Minimal structural type accepted by analytics functions.
// Both StdbMarketPrice and StoreMarketPrice (mandi-api.ts) satisfy this.
// ---------------------------------------------------------------------------
export interface PriceRecord {
  crop: string;
  mandi: string;
  district?: string;
  date: string;
  pricePerQuintalPaise: bigint;
  mspPricePaise: bigint;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CropPriceSummary {
  crop: string;
  /** Best mandi name for this crop (highest current price) */
  bestMandi: string;
  bestPrice: number;       // rupees
  worstMandi: string;
  worstPrice: number;      // rupees
  mspPrice: number;        // rupees
  aboveMsp: boolean;       // is best price above MSP?
  mspDiffRupees: number;   // positive = above, negative = below
  mspDiffPct: number;      // percentage difference
  /** Price history for trend chart (sorted by date ascending) */
  priceHistory: { date: string; price: number }[];
  /** Mandi comparison for bar chart */
  mandiComparison: MandiCompare[];
  /** 7-day trend */
  trend7d: {
    direction: 'up' | 'down' | 'flat';
    amountRupees: number;
    pct: number;
  };
}

export interface MandiCompare {
  mandi: string;
  price: number;       // rupees
  pct: number;         // percentage of max price (for bar width)
  distanceKm: number;  // distance from farmer (placeholder for now)
  transportCost: number;
}

// Known distances from Anantapur to mandis (km, approximate)
const MANDI_DISTANCES: Record<string, { km: number; transport: number }> = {
  'అనంతపురం': { km: 5, transport: 200 },
  'హిందూపురం': { km: 40, transport: 450 },
  'కర్నూలు':   { km: 110, transport: 850 },
  'గుంటూరు':  { km: 280, transport: 1800 },
};

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

/**
 * Compute crop summaries from raw STDB market_price rows.
 * Groups by crop, finds best/worst mandis, computes trends.
 */
export function computeCropSummaries(
  allPrices: PriceRecord[],
  selectedCrop?: string,
  selectedMandi?: string,
): CropPriceSummary[] {
  // Group by crop
  const byCrop = new Map<string, PriceRecord[]>();
  for (const p of allPrices) {
    const existing = byCrop.get(p.crop) || [];
    existing.push(p);
    byCrop.set(p.crop, existing);
  }

  const summaries: CropPriceSummary[] = [];

  for (const [crop, prices] of byCrop) {
    // Sort all prices by date
    const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));

    // Get the latest date
    const latestDate = sorted[sorted.length - 1]?.date || '';

    // Latest prices per mandi
    const latestByMandi = new Map<string, PriceRecord>();
    for (const p of sorted) {
      if (p.date === latestDate) {
        latestByMandi.set(p.mandi, p);
      }
    }

    // If no latest data, use the most recent per mandi
    if (latestByMandi.size === 0) {
      for (const p of sorted) {
        latestByMandi.set(p.mandi, p);
      }
    }

    const latestPrices = Array.from(latestByMandi.values());
    if (latestPrices.length === 0) continue;

    // Best and worst mandi
    let best = latestPrices[0];
    let worst = latestPrices[0];
    for (const p of latestPrices) {
      if (p.pricePerQuintalPaise > best.pricePerQuintalPaise) best = p;
      if (p.pricePerQuintalPaise < worst.pricePerQuintalPaise) worst = p;
    }

    const msp = Number(best.mspPricePaise) / 100;
    const bestPrice = Number(best.pricePerQuintalPaise) / 100;
    const worstPrice = Number(worst.pricePerQuintalPaise) / 100;

    // Price history for trend chart
    // Use the selected mandi, or the best mandi, for trend line
    const trendMandi = selectedMandi || best.mandi;
    const mandiPrices = sorted.filter(p => p.mandi === trendMandi);
    const priceHistory = mandiPrices.map(p => ({
      date: p.date,
      price: Number(p.pricePerQuintalPaise) / 100,
    }));

    // Mandi comparison
    const maxPrice = Math.max(...latestPrices.map(p => Number(p.pricePerQuintalPaise)));
    const mandiComparison: MandiCompare[] = latestPrices
      .map(p => {
        const dist = MANDI_DISTANCES[p.mandi] || { km: 0, transport: 0 };
        return {
          mandi: p.mandi,
          price: Number(p.pricePerQuintalPaise) / 100,
          pct: maxPrice > 0 ? (Number(p.pricePerQuintalPaise) / maxPrice) * 100 : 100,
          distanceKm: dist.km,
          transportCost: dist.transport,
        };
      })
      .sort((a, b) => b.price - a.price);

    // 7-day trend
    const today = priceHistory[priceHistory.length - 1];
    const weekAgoIdx = Math.max(0, priceHistory.length - 8);
    const weekAgo = priceHistory[weekAgoIdx];
    let trend7d: { direction: 'up' | 'down' | 'flat'; amountRupees: number; pct: number } =
      { direction: 'flat', amountRupees: 0, pct: 0 };
    if (today && weekAgo && weekAgo.price > 0) {
      const diff = today.price - weekAgo.price;
      const pct = (diff / weekAgo.price) * 100;
      trend7d = {
        direction: diff > 10 ? 'up' : diff < -10 ? 'down' : 'flat',
        amountRupees: Math.round(diff),
        pct: Math.round(pct * 10) / 10,
      };
    }

    summaries.push({
      crop,
      bestMandi: best.mandi,
      bestPrice,
      worstMandi: worst.mandi,
      worstPrice,
      mspPrice: msp,
      aboveMsp: bestPrice > msp,
      mspDiffRupees: Math.round(bestPrice - msp),
      mspDiffPct: msp > 0 ? Math.round(((bestPrice - msp) / msp) * 1000) / 10 : 0,
      priceHistory,
      mandiComparison,
      trend7d,
    });
  }

  return summaries;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Format paise to rupees display: 584000n -> "5,840" */
export function formatPricePaise(paise: bigint | number): string {
  const rupees = Number(paise) / 100;
  return rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/** Format rupees number: 5840 -> "5,840" */
export function formatRupees(rupees: number): string {
  return rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/** Relative time in Telugu: "5 నిమిషాల క్రితం" */
export function relativeTimeTelugu(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr + 'T12:00:00');
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'ఇప్పుడే';
  if (diffMin < 60) return `${diffMin} నిమిషాల క్రితం`;
  if (diffHours < 24) return `${diffHours} గంటల క్రితం`;
  if (diffDays === 1) return 'నిన్న';
  if (diffDays < 7) return `${diffDays} రోజుల క్రితం`;
  return dateStr;
}

/** Telugu month name from YYYY-MM-DD */
export function teluguDateShort(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const monthMap: Record<string, string> = {
    '01': 'జన', '02': 'ఫిబ్', '03': 'మా',
    '04': 'ఏప్రి', '05': 'మే', '06': 'జూన్',
    '07': 'జూలై', '08': 'ఆగ', '09': 'సెప్',
    '10': 'అక్టో', '11': 'నవ', '12': 'డిసె',
  };
  return `${monthMap[parts[1]] || parts[1]} ${parseInt(parts[2])}`;
}

// ---------------------------------------------------------------------------
// Market Insight Builder (pure computation, Telugu output)
// ---------------------------------------------------------------------------

export interface MarketInsight {
  lines: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
}

export function buildMarketInsight(summary: CropPriceSummary): MarketInsight {
  const lines: string[] = [];
  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';

  // Line 1: Price vs MSP
  if (summary.aboveMsp) {
    lines.push(
      `${summary.crop} ధర MSP కంటే ₹${formatRupees(Math.abs(summary.mspDiffRupees))} ఎక్కువ (+${summary.mspDiffPct}%).`
    );
    sentiment = 'positive';
  } else if (summary.mspDiffRupees < 0) {
    lines.push(
      `${summary.crop} ధర MSP కంటే ₹${formatRupees(Math.abs(summary.mspDiffRupees))} తక్కువ (${summary.mspDiffPct}%).`
    );
    sentiment = 'negative';
  } else {
    lines.push(`${summary.crop} ధర MSP సమానం.`);
  }

  // Line 2: Best mandi
  lines.push(
    `${summary.bestMandi} మార్కెట్‌లో అత్యధిక ధర: ₹${formatRupees(summary.bestPrice)}/క్వింటాల్.`
  );

  // Line 3: 7-day trend
  const t = summary.trend7d;
  if (t.direction === 'up') {
    lines.push(`గత 7 రోజులలో ₹${formatRupees(Math.abs(t.amountRupees))} పెరిగింది (+${t.pct}%).`);
  } else if (t.direction === 'down') {
    lines.push(`గత 7 రోజులలో ₹${formatRupees(Math.abs(t.amountRupees))} తగ్గింది (${t.pct}%).`);
  } else {
    lines.push('గత 7 రోజులలో ధర స్థిరంగా ఉంది.');
  }

  return { lines, sentiment };
}
