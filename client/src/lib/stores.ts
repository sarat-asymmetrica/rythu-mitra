/**
 * Svelte stores for Rythu Mitra.
 *
 * Populated from LIVE STDB callbacks (via db.ts setupTableSync).
 * Mock data serves as FALLBACK when not connected.
 */
import { writable, derived } from 'svelte/store';
import type {
  Farmer as StdbFarmer,
  FarmerContext as StdbFarmerContext,
  MoneyEvent as StdbMoneyEvent,
  MarketPrice as StdbMarketPrice,
  FarmerBalanceRow as StdbFarmerBalanceRow,
} from '../module_bindings/types';
import type { Identity } from 'spacetimedb';
import type {
  MoneyEvent, CropEvent, CropField,
  MarketPrice, BriefingCard,
  TransactionGroup, DonutSegment, ScreenName,
} from './types';
import { loadMemories, type FarmerMemory } from './memory';
import type { StoreMarketPrice } from './mandi-api';
import type { PriceRecord } from './market';

// ---------------------------------------------------------------------------
// Connection state
// ---------------------------------------------------------------------------
export const connected = writable(false);
export const connectionError = writable<string | null>(null);
export const myIdentity = writable<Identity | null>(null);

// ---------------------------------------------------------------------------
// Active screen
// ---------------------------------------------------------------------------
export const activeScreen = writable<ScreenName>('home');

// ---------------------------------------------------------------------------
// Raw STDB table stores (populated by db.ts callbacks)
// ---------------------------------------------------------------------------
export const farmerStore = writable<StdbFarmer[]>([]);
export const farmerContextStore = writable<StdbFarmerContext[]>([]);
export const moneyEventsStore = writable<StdbMoneyEvent[]>([]);
export const marketPricesStore = writable<StdbMarketPrice[]>([]);
export const farmerBalanceStore = writable<StdbFarmerBalanceRow[]>([]);

// ---------------------------------------------------------------------------
// Derived: my farmer (the farmer matching my identity)
// ---------------------------------------------------------------------------
export const myFarmer = derived(
  [farmerStore, myIdentity],
  ([$farmers, $id]) => {
    if (!$id) return null;
    const idStr = String($id);
    return $farmers.find(f => String(f.identity) === idStr) ?? null;
  }
);

// ---------------------------------------------------------------------------
// Derived: my farmer context
// ---------------------------------------------------------------------------
export const myFarmerContext = derived(
  [farmerContextStore, myIdentity],
  ([$contexts, $id]) => {
    if (!$id) return null;
    const idStr = String($id);
    return $contexts.find(c => String(c.farmerId) === idStr) ?? null;
  }
);

// ---------------------------------------------------------------------------
// Derived: my money events
// ---------------------------------------------------------------------------
export const myMoneyEvents = derived(
  [moneyEventsStore, myIdentity],
  ([$events, $id]) => {
    if (!$id) return $events; // Show all if no identity yet
    const idStr = String($id);
    return $events.filter(e => String(e.farmerId) === idStr);
  }
);

// ---------------------------------------------------------------------------
// Derived: balance from farmer_balance view (or compute from events)
// ---------------------------------------------------------------------------
export const balanceData = derived(
  [farmerBalanceStore, myMoneyEvents, myIdentity],
  ([$balRows, $events, $id]) => {
    // Try from farmer_balance view first
    if ($id && $balRows.length > 0) {
      const idStr = String($id);
      const row = $balRows.find(r => String(r.farmerId) === idStr);
      if (row) {
        const income = Number(row.totalIncomePaise) / 100;
        const expense = Number(row.totalExpensePaise) / 100;
        return { income, expense, net: income - expense };
      }
    }
    // Fallback: compute from money_events
    let income = 0;
    let expense = 0;
    for (const e of $events) {
      const rupees = Number(e.amountPaise) / 100;
      if (e.isIncome) income += rupees;
      else expense += rupees;
    }
    return { income, expense, net: income - expense };
  }
);

// Convenience aliases for components
export const totalIncome = derived(balanceData, ($b) => $b.income);
export const totalExpense = derived(balanceData, ($b) => $b.expense);
export const balance = derived(balanceData, ($b) => $b.net);

// ---------------------------------------------------------------------------
// Live mandi prices (from data.gov.in API, injected by Market.svelte on refresh)
// Declared before myCropPrices so it can be used in the derived store.
// ---------------------------------------------------------------------------
export const liveMandiPrices = writable<StoreMarketPrice[]>([]);

// ---------------------------------------------------------------------------
// Derived: my crop prices (market prices filtered by farmer's crops + district)
// Priority: liveMandiPrices (data.gov.in) > STDB marketPricesStore
// ---------------------------------------------------------------------------
export const myCropPrices = derived(
  [marketPricesStore, liveMandiPrices, myFarmerContext, myFarmer],
  ([$stdbPrices, $livePrices, $ctx, $farmer]): PriceRecord[] => {
    // Use live mandi prices when available (they are already AP-filtered)
    const prices: PriceRecord[] =
      $livePrices.length > 0
        ? ($livePrices as PriceRecord[])
        : ($stdbPrices as PriceRecord[]);
    if (!$ctx || !$farmer) return prices; // Show all prices if no context
    let crops: string[] = [];
    try { crops = JSON.parse($ctx.crops || '[]'); } catch { crops = []; }
    if (crops.length === 0) return prices;
    return prices.filter(p => crops.includes(p.crop));
  }
);

// ---------------------------------------------------------------------------
// Local money events (from voice entry / mock mode / offline queue)
// Writable — voice entries and mock data go here.
// ---------------------------------------------------------------------------
// Seed with demo transactions so app shows data even without STDB registration
const SEED_MONEY_EVENTS: MoneyEvent[] = [
  { id: 's1', farmerId: '1', kind: 'labor', amount: -800, description: 'రెండు కూలీలకు నాలుగు వందలు', category: 'కూలి', date: '2026-03-16', time: '08:30' },
  { id: 's2', farmerId: '1', kind: 'fertilizer', amount: -1200, description: 'DAP 2 బస్తాలు', category: 'ఎరువులు', date: '2026-03-15', time: '10:15' },
  { id: 's3', farmerId: '1', kind: 'crop_sale', amount: 14500, description: 'వేరుశెనగ మొదటి పిక్ అమ్మకం', category: 'పంట అమ్మకం', date: '2026-03-14', time: '16:00' },
  { id: 's4', farmerId: '1', kind: 'irrigation', amount: -450, description: 'బోర్ డీజిల్ ఖర్చులు', category: 'నీటిపారుదల', date: '2026-03-14', time: '07:45' },
  { id: 's5', farmerId: '1', kind: 'seeds', amount: -640, description: 'వేరుశెనగ K-6 విత్తనాలు', category: 'విత్తనాలు', date: '2026-03-13', time: '09:00' },
  { id: 's6', farmerId: '1', kind: 'govt_subsidy', amount: 2000, description: 'PM-KISAN 16వ వాయిదా', category: 'ప్రభుత్వ సబ్సిడీ', date: '2026-03-12', time: '14:30' },
  { id: 's7', farmerId: '1', kind: 'labor', amount: -1200, description: 'మూడు కూలీలకు', category: 'కూలి', date: '2026-03-11', time: '17:00' },
  { id: 's8', farmerId: '1', kind: 'fertilizer', amount: -500, description: 'యూరియా ఒక బస్తా', category: 'ఎరువులు', date: '2026-03-10', time: '11:30' },
  { id: 's9', farmerId: '1', kind: 'crop_sale', amount: 13900, description: 'వేరుశెనగ 2వ బ్యాచ్ అమ్మకం', category: 'పంట అమ్మకం', date: '2026-03-09', time: '15:20' },
  { id: 's10', farmerId: '1', kind: 'transport', amount: -350, description: 'మండీకి రవాణా ఖర్చు', category: 'రవాణా', date: '2026-03-09', time: '06:00' },
  { id: 's11', farmerId: '1', kind: 'labor', amount: -1200, description: 'మూడు కూలీలకు', category: 'కూలి', date: '2026-03-08', time: '17:30' },
  { id: 's12', farmerId: '1', kind: 'other', amount: -2800, description: 'బోర్ మోటార్ రిపేర్', category: 'ఇతర', date: '2026-03-07', time: '12:00' },
  { id: 's13', farmerId: '1', kind: 'crop_sale', amount: 4500, description: 'పత్తి రెండో పిక్ అమ్మకం', category: 'పంట అమ్మకం', date: '2026-03-06', time: '14:00' },
  { id: 's14', farmerId: '1', kind: 'other', amount: -150, description: 'బస్ చార్జీలు మార్కెట్', category: 'ఇతర', date: '2026-03-05', time: '08:00' },
  { id: 's15', farmerId: '1', kind: 'govt_subsidy', amount: 2000, description: 'YSR రైతు భరోసా', category: 'ప్రభుత్వ సబ్సిడీ', date: '2026-03-04', time: '10:00' },
];

export const localMoneyEvents = writable<MoneyEvent[]>([]);

// ---------------------------------------------------------------------------
// Legacy-compatible stores for existing UI components
// These adapt STDB types -> UI types for the existing Home/Dabbu screens
// ---------------------------------------------------------------------------

/**
 * MoneyEvents: STDB data takes priority. Local voice entries are prepended.
 * Seed data is ONLY used as offline fallback when both STDB and local are empty.
 *
 * Priority: (local voice entries) + STDB > seed fallback > empty
 */
export const moneyEvents = derived(
  [myMoneyEvents, localMoneyEvents, connected],
  ([$stdbEvents, $localEvents, $connected]): MoneyEvent[] => {
    const hasStdb = $stdbEvents.length > 0;
    const hasLocal = $localEvents.length > 0;

    // Case 1: STDB has data — use it (plus any local voice entries)
    if (hasStdb) {
      return hasLocal
        ? [...$localEvents, ...adaptStdbEvents($stdbEvents)]
        : adaptStdbEvents($stdbEvents);
    }

    // Case 2: Only local voice entries (no STDB yet)
    if (hasLocal) return $localEvents;

    // Case 3: No data at all — use seed only when genuinely offline
    if (!$connected) return SEED_MONEY_EVENTS;

    // Case 4: Connected but STDB has no rows yet — empty (loading)
    return [];
  }
);

function adaptStdbEvents($events: StdbMoneyEvent[]): MoneyEvent[] {
  return $events.map((e: StdbMoneyEvent) => {
    const rupees = Number(e.amountPaise) / 100;
    const amount = e.isIncome ? rupees : -rupees;
    const created = e.createdAt;
    // Extract date and time from timestamp
    let dateStr = '';
    let timeStr = '00:00';
    try {
      // STDB timestamps are microseconds since epoch
      const ms = Number(created) / 1000;
      const d = new Date(ms);
      dateStr = d.toISOString().slice(0, 10);
      timeStr = d.toTimeString().slice(0, 5);
    } catch {
      dateStr = new Date().toISOString().slice(0, 10);
    }
    // Map STDB kind to UI kind
    const kindMap: Record<string, string> = {
      CropSale: 'crop_sale',
      InputPurchase: 'seeds',
      LaborPayment: 'labor',
      GovernmentTransfer: 'govt_subsidy',
      UPIPayment: 'other',
      Other: 'other',
    };
    return {
      id: String(e.id),
      farmerId: String(e.farmerId),
      kind: (kindMap[e.kind] || 'other') as MoneyEvent['kind'],
      amount,
      description: e.description,
      category: e.category,
      date: dateStr,
      time: timeStr,
    };
  });
}

// Seed market prices for when STDB is empty
const SEED_MARKET_PRICES: MarketPrice[] = [
  { id: 'mp1', crop: 'వేరుశెనగ', mandiName: 'అనంతపురం', price: 5840, msp: 5850, distanceKm: 12, transportCost: 200, timestamp: '2026-03-16' },
  { id: 'mp2', crop: 'వేరుశెనగ', mandiName: 'గుంతకల్', price: 5920, msp: 5850, distanceKm: 45, transportCost: 450, timestamp: '2026-03-16' },
  { id: 'mp3', crop: 'వేరుశెనగ', mandiName: 'కర్నూలు', price: 6010, msp: 5850, distanceKm: 85, transportCost: 700, timestamp: '2026-03-16' },
  { id: 'mp4', crop: 'వేరుశెనగ', mandiName: 'ధర్మవరం', price: 5900, msp: 5850, distanceKm: 32, transportCost: 350, timestamp: '2026-03-16' },
  { id: 'mp5', crop: 'వేరుశెనగ', mandiName: 'తాడిపత్రి', price: 5820, msp: 5850, distanceKm: 55, transportCost: 500, timestamp: '2026-03-16' },
  { id: 'mp6', crop: 'పత్తి', mandiName: 'ఒంగోలు', price: 7020, msp: 6700, distanceKm: 180, transportCost: 1200, timestamp: '2026-03-16' },
  { id: 'mp7', crop: 'మొక్కజొన్న', mandiName: 'అనంతపురం', price: 2150, msp: 1980, distanceKm: 12, transportCost: 200, timestamp: '2026-03-16' },
];

/** MarketPrices adapted from STDB to UI format. Seed only when offline and empty. */
export const marketPrices = derived([myCropPrices, connected], ([$prices, $connected]): MarketPrice[] => {
  if ($prices.length === 0) {
    return $connected ? [] : SEED_MARKET_PRICES;
  }
  // Distance/transport lookup by mandi name (estimated)
  const distanceMap: Record<string, { km: number; cost: number }> = {
    'అనంతపురం': { km: 12, cost: 200 },
    'గుంతకల్': { km: 45, cost: 450 },
    'కర్నూలు': { km: 85, cost: 700 },
    'ధర్మవరం': { km: 32, cost: 350 },
    'తాడిపత్రి': { km: 55, cost: 500 },
    'ఒంగోలు': { km: 180, cost: 1200 },
  };
  return $prices.map(p => {
    const dist = distanceMap[p.mandi] || { km: 0, cost: 0 };
    return {
      id: String(p.id),
      crop: p.crop,
      mandiName: p.mandi,
      price: Number(p.pricePerQuintalPaise) / 100,
      msp: Number(p.mspPricePaise) / 100,
      distanceKm: dist.km,
      transportCost: dist.cost,
      timestamp: p.date,
    };
  });
});

// ---------------------------------------------------------------------------
// Mock data stores (only used when STDB has no data)
// ---------------------------------------------------------------------------
export const cropFields = writable<CropField[]>([{
  id: '1', farmerId: '1', name: 'పొలం 1 — వేరుశెనగ', crop: 'వేరుశెనగ',
  acreage: 4, village: 'అనంతపురం', district: 'అనంతపురం',
  season: 'rabi', currentStage: 'growth',
  sowingDate: '2026-01-15', expectedHarvest: '2026-04-15',
  healthStatus: 'good', totalInvestment: 4200,
}]);

export const cropEvents = writable<CropEvent[]>([
  {
    id: 'ce1', farmerId: '1', cropFieldId: '1', kind: 'sowing',
    title: 'రబీ విత్తనాలు వేశాము',
    body: 'వేరుశెనగ K-6 రకం విత్తనాలు వేశాము. నేల తేమ బాగుంది.',
    date: '2026-01-15', photos: [], badge: '✓ విత్తనం పూర్తయింది',
  },
  {
    id: 'ce2', farmerId: '1', cropFieldId: '1', kind: 'fertilizer',
    title: 'DAP ఎరువు వేశాము',
    body: '2 బస్తాల DAP, 1 బస్తా యూరియా. ఎకరాకు సగటున రూ. 600.',
    date: '2026-01-28', photos: [],
  },
  {
    id: 'ce3', farmerId: '1', cropFieldId: '1', kind: 'irrigation',
    title: 'బోర్ నీళ్ళు పెట్టాము',
    body: '4 గంటలు బోర్ వాటర్ పెట్టాము. మోటార్ సరిగ్గా పని చేసింది.',
    date: '2026-02-10', photos: [],
  },
  {
    id: 'ce4', farmerId: '1', cropFieldId: '1', kind: 'pesticide',
    title: 'పురుగు మందు చల్లాము',
    body: 'బోల్ వార్మ్ గుర్తింపు — 35% ప్రభావం.\nవేప నూనె 5ml/లీటర్ చొప్పున చల్లాము.',
    date: '2026-03-12', photos: ['photo1.jpg'],
    badge: '✓ వేప నూనె పిచికారీ చేయబడింది',
  },
  {
    id: 'ce5', farmerId: '1', cropFieldId: '1', kind: 'inspection',
    title: 'తెల్ల దోమ కనిపించింది',
    body: 'పత్తి పొలంలో తెల్ల దోమ 15% ప్రభావం.\nనిమోయిల్ స్ప్రే చేయాలి.',
    date: '2026-03-14', photos: ['photo2.jpg'],
  },
]);

// ---------------------------------------------------------------------------
// Derived: briefing cards from live market data
// ---------------------------------------------------------------------------
export const briefingCards = derived(
  [myCropPrices, myFarmerContext, marketPrices],
  ([$prices, $ctx, $uiPrices]): BriefingCard[] => {
    const cards: BriefingCard[] = [];

    // If live or STDB market prices exist, use them for briefing cards
    if ($prices.length > 0) {
      const byCrop = new Map<string, PriceRecord[]>();
      for (const p of $prices) {
        const existing = byCrop.get(p.crop) || [];
        existing.push(p);
        byCrop.set(p.crop, existing);
      }

      for (const [crop, prices] of byCrop) {
        const msp = Number(prices[0].mspPricePaise) / 100;
        const lines = prices.map(p => {
          const price = Number(p.pricePerQuintalPaise) / 100;
          const aboveMsp = price > msp;
          return `${p.mandi}: <strong>Rs${price.toLocaleString('en-IN')}</strong>/q ${aboveMsp ? '<span style="color:var(--pacchi)">MSP+</span>' : ''}`;
        });
        const bestMandi = prices.reduce((a, b) =>
          Number(a.pricePerQuintalPaise) > Number(b.pricePerQuintalPaise) ? a : b
        );
        const bestPrice = Number(bestMandi.pricePerQuintalPaise) / 100;
        const speakText = `${bestMandi.mandi} ${crop} ధర క్వింటాలుకు రూపాయలు ${bestPrice.toLocaleString('en-IN')}`;

        cards.push({
          id: `market-${crop}`,
          accent: 'market',
          icon: '📊',
          title: `${crop} — మార్కెట్ ధరలు`,
          body: lines.join('<br>'),
          meta: `MSP: Rs${msp.toLocaleString('en-IN')}/quintal · ${prices[0].date}`,
          speakText,
        });
      }
    } else if ($uiPrices.length > 0) {
      // Fallback: generate briefing from seed market prices
      const byCrop = new Map<string, MarketPrice[]>();
      for (const p of $uiPrices) {
        const existing = byCrop.get(p.crop) || [];
        existing.push(p);
        byCrop.set(p.crop, existing);
      }

      for (const [crop, prices] of byCrop) {
        const msp = prices[0].msp;
        const lines = prices.map(p => {
          const aboveMsp = p.price > msp;
          return `${p.mandiName}: <strong>Rs${p.price.toLocaleString('en-IN')}</strong>/q ${aboveMsp ? '<span style="color:var(--pacchi)">MSP+</span>' : ''}`;
        });
        const best = prices.reduce((a, b) => a.price > b.price ? a : b);
        const speakText = `${best.mandiName} ${crop} ధర క్వింటాలుకు రూపాయలు ${best.price.toLocaleString('en-IN')}`;

        cards.push({
          id: `seed-market-${crop}`,
          accent: 'market',
          icon: '📊',
          title: `${crop} — మార్కెట్ ధరలు`,
          body: lines.join('<br>'),
          meta: `MSP: Rs${msp.toLocaleString('en-IN')}/quintal · ${prices[0].timestamp}`,
          speakText,
        });
      }
    }

    return cards;
  }
);

// ---------------------------------------------------------------------------
// Derived stores for Dabbu screen
// ---------------------------------------------------------------------------
export const donutSegments = derived(moneyEvents, ($events): DonutSegment[] => {
  const expenses = $events.filter(e => e.amount < 0);
  const total = expenses.reduce((s, e) => s + Math.abs(e.amount), 0);
  const byKind = new Map<string, { label: string; value: number; color: string }>();

  const colorMap: Record<string, string> = {
    labor: '#8B4513', seeds: '#2D6A4F', fertilizer: '#1B4F72',
    irrigation: '#2980B9', transport: '#E8A317', other: '#B8A99A',
    crop_sale: '#2D6A4F', govt_subsidy: '#1B4F72',
  };
  const labelMap: Record<string, string> = {
    labor: 'కూలి', seeds: 'విత్తనాలు', fertilizer: 'ఎరువులు',
    irrigation: 'నీటిపారుదల', transport: 'రవాణా', other: 'ఇతర',
  };

  for (const e of expenses) {
    const existing = byKind.get(e.kind);
    if (existing) {
      existing.value += Math.abs(e.amount);
    } else {
      byKind.set(e.kind, {
        label: labelMap[e.kind] || 'ఇతర',
        value: Math.abs(e.amount),
        color: colorMap[e.kind] || '#B8A99A',
      });
    }
  }

  return Array.from(byKind.values()).map(seg => ({
    ...seg,
    percent: total > 0 ? Math.round((seg.value / total) * 100) : 0,
  }));
});

export const transactionGroups = derived(moneyEvents, ($events): TransactionGroup[] => {
  const groups = new Map<string, MoneyEvent[]>();
  for (const e of $events) {
    const key = e.date;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      dateLabel: formatDateLabel(date),
      items: items.sort((a, b) => b.time.localeCompare(a.time)),
    }));
});

// ---------------------------------------------------------------------------
// Memories store (persistent in localStorage, synced on change)
// ---------------------------------------------------------------------------
export const memories = writable<FarmerMemory[]>(loadMemories());

/** Active memories only, sorted by lastUsedAt descending. */
export const farmerMemories = derived(memories, ($m) =>
  $m.filter(m => m.active).sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
);

/** Dismissed memories for Settings view. */
export const dismissedMemories = derived(memories, ($m) =>
  $m.filter(m => !m.active).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
);

/** Refresh memories store from localStorage. Call after any memory mutation. */
export function refreshMemories(): void {
  memories.set(loadMemories());
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function formatDateLabel(isoDate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (isoDate === today) return `ఈ రోజు — ${formatTeluguDate(isoDate)}`;
  if (isoDate === yesterday) return `నిన్న — ${formatTeluguDate(isoDate)}`;
  return formatTeluguDate(isoDate);
}

function formatTeluguDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length < 3) return isoDate;
  const monthMap: Record<string, string> = {
    '01': 'జనవరి', '02': 'ఫిబ్రవరి', '03': 'మార్చి',
    '04': 'ఏప్రిల్', '05': 'మే', '06': 'జూన్',
    '07': 'జూలై', '08': 'ఆగస్ట్', '09': 'సెప్టెంబర్',
    '10': 'అక్టోబర్', '11': 'నవంబర్', '12': 'డిసెంబర్',
  };
  return `${parseInt(parts[2])} ${monthMap[parts[1]] || parts[1]}`;
}
