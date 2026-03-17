/**
 * SpacetimeDB connection for Rythu Mitra.
 *
 * Connects to the LIVE `rythu-mitra` module on maincloud.
 * Pattern follows 001-ledger:
 *   1. connect() -> store token in localStorage -> register onInsert/onDelete
 *   2. Callbacks registered BEFORE subscribe
 *   3. Subscribe to relevant tables
 *   4. Auto-register farmer if not found for this identity
 *   5. Seed demo data if farmer has zero transactions
 */

import { writable, get, type Writable } from 'svelte/store';
import { DbConnection, type ErrorContext } from '../module_bindings';
import type {
  Farmer, FarmerContext, MoneyEvent, MarketPrice, FarmerBalanceRow,
  MarketPriceInput,
} from '../module_bindings/types';
import type { Identity } from 'spacetimedb';
import {
  connected, connectionError, myIdentity,
  farmerStore, farmerContextStore, moneyEventsStore,
  marketPricesStore, farmerBalanceStore,
} from './stores';
import { showToast } from './toast';

const HOST = 'wss://maincloud.spacetimedb.com';
const DB_NAME = 'rythu-mitra';
const TOKEN_KEY = `stdb_token_${DB_NAME}`;
const SEEDED_KEY = 'rythu_mitra_data_seeded';
const ONBOARDED_KEY = 'rythu_mitra_onboarded';
const DEMO_KEY = 'rythu_mitra_demo_mode';

// The live connection (null until connected)
let conn: DbConnection | null = null;

/** Get the live connection for calling reducers. */
export function getConnection(): DbConnection | null {
  return conn;
}

/** Convert an iterable to array (STDB tables return iterables). */
function iterToArray<T>(iterable: Iterable<T>): T[] {
  const arr: T[] = [];
  for (const item of iterable) arr.push(item);
  return arr;
}

/** Register table sync callbacks BEFORE subscribing. */
function setupTableSync(connection: DbConnection): void {
  const db = connection.db;

  const syncFarmer = () => farmerStore.set(iterToArray(db.farmer.iter()));
  const syncFarmerContext = () => farmerContextStore.set(iterToArray(db.farmerContext.iter()));
  const syncMoneyEvents = () => moneyEventsStore.set(iterToArray(db.moneyEvent.iter()));
  const syncMarketPrices = () => marketPricesStore.set(iterToArray(db.marketPrice.iter()));
  const syncFarmerBalance = () => {
    try { farmerBalanceStore.set(iterToArray(db.farmer_balance.iter())); } catch { /* view may not be available */ }
  };

  db.farmer.onInsert(syncFarmer);
  db.farmer.onDelete(syncFarmer);
  db.farmerContext.onInsert(syncFarmerContext);
  db.farmerContext.onDelete(syncFarmerContext);
  db.moneyEvent.onInsert(syncMoneyEvents);
  db.moneyEvent.onDelete(syncMoneyEvents);
  db.marketPrice.onInsert(syncMarketPrices);
  db.marketPrice.onDelete(syncMarketPrices);
  // Views may not support onInsert/onDelete in all STDB versions
  try {
    db.farmer_balance.onInsert(syncFarmerBalance);
    db.farmer_balance.onDelete(syncFarmerBalance);
  } catch {
    console.warn('[stdb] farmer_balance view callbacks not available');
  }
}

/** Force-sync all stores from current DB state. */
function forceSync(connection: DbConnection): void {
  const db = connection.db;
  farmerStore.set(iterToArray(db.farmer.iter()));
  farmerContextStore.set(iterToArray(db.farmerContext.iter()));
  moneyEventsStore.set(iterToArray(db.moneyEvent.iter()));
  marketPricesStore.set(iterToArray(db.marketPrice.iter()));
  try { farmerBalanceStore.set(iterToArray(db.farmer_balance.iter())); } catch { /* view may not be available */ }
}

// ---------------------------------------------------------------------------
// Auto-registration: only in demo mode or when onboarding completed
// ---------------------------------------------------------------------------

/**
 * isDemoMode: true when URL has ?demo=true OR localStorage has demo flag.
 * In demo mode we auto-register as Lakshmi with seed data (original behaviour).
 */
function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('demo') === 'true') {
    localStorage.setItem(DEMO_KEY, 'true');
    return true;
  }
  return localStorage.getItem(DEMO_KEY) === 'true';
}

/**
 * Ensure a farmer exists for this browser identity.
 *
 * Behaviour:
 *   - Demo mode: auto-register as Lakshmi with seed data (original behaviour).
 *   - Onboarded: re-register using saved localStorage data if STDB row is missing
 *     (handles the case where DB was cleared but browser retains the flag).
 *   - Not onboarded and not demo: do nothing — App.svelte shows OnboardingFlow.
 */
function ensureFarmerRegistered(connection: DbConnection, identity: Identity): void {
  const farmers = iterToArray(connection.db.farmer.iter());
  const idStr = String(identity);
  const existing = farmers.find(f => String(f.identity) === idStr);

  if (existing) {
    console.log('[stdb] Farmer found:', existing.name);
    return;
  }

  // ── Demo mode: auto-register as Lakshmi ──
  if (isDemoMode()) {
    console.log('[stdb] Demo mode — auto-registering Lakshmi...');
    _registerDemoFarmer(connection, idStr);
    return;
  }

  // ── Onboarded but STDB row missing (e.g. DB cleared) ──
  if (localStorage.getItem(ONBOARDED_KEY) === 'true') {
    const savedName = localStorage.getItem('rythu_mitra_farmer_name') || '';
    const savedVillage = localStorage.getItem('rythu_mitra_farmer_village') || '';
    const savedDistrict = localStorage.getItem('rythu_mitra_farmer_district') || 'అనంతపురం';
    const savedLanguage = (localStorage.getItem('rythu_mitra_farmer_language') || 'te') as 'te' | 'en';
    const savedCrops = localStorage.getItem('rythu_mitra_farmer_crops') || '[]';
    const savedAcres = parseFloat(localStorage.getItem('rythu_mitra_farmer_acres') || '0');

    if (!savedName) {
      // No saved data despite flag — clear and let onboarding run again
      localStorage.removeItem(ONBOARDED_KEY);
      console.warn('[stdb] Onboarding flag set but no saved name — clearing flag for re-onboarding');
      return;
    }

    console.log('[stdb] Onboarded but STDB row missing — re-registering:', savedName);
    try {
      connection.reducers.registerFarmer({
        name: savedName,
        phone: '',
        village: savedVillage,
        district: savedDistrict,
        language: savedLanguage,
      });
    } catch (err) {
      console.warn('[stdb] Re-registration failed:', err);
    }

    // Restore farmer context after a short delay
    setTimeout(() => {
      try {
        connection.reducers.updateFarmerContext({
          crops: savedCrops,
          acres: savedAcres,
          plots: '[]',
          irrigationType: '',
          seasonStage: '',
          painPoints: '',
          rawStoryJson: '{}',
        });
      } catch (err) {
        console.warn('[stdb] Failed to restore farmer context:', err);
      }
    }, 800);

    return;
  }

  // ── Not yet onboarded — do nothing, App.svelte shows OnboardingFlow ──
  console.log('[stdb] Not onboarded — waiting for OnboardingFlow to complete');
}

/** Demo-mode: auto-register as Lakshmi with seed data. */
function _registerDemoFarmer(connection: DbConnection, idStr: string): void {
  connection.reducers.registerFarmer({
    name: '\u0C32\u0C15\u0C4D\u0C37\u0C4D\u0C2E\u0C3F',          // లక్ష్మి
    phone: '9876543210',
    village: '\u0C2A\u0C46\u0C28\u0C41\u0C15\u0C4A\u0C02\u0C21',  // పెనుకొండ
    district: '\u0C05\u0C28\u0C02\u0C24\u0C2A\u0C41\u0C30\u0C02', // అనంతపురం
    language: 'te',
  });

  // Wait for farmer to appear in STDB before seeding context + data
  const checkInterval = setInterval(() => {
    const farmers = iterToArray(connection.db.farmer.iter());
    const found = farmers.find(f => String(f.identity) === idStr);
    if (found) {
      clearInterval(checkInterval);
      console.log('[stdb] Demo farmer confirmed:', found.name);

      try {
        connection.reducers.updateFarmerContext({
          crops: '["వేరుశెనగ","పత్తి"]',
          acres: 4,
          plots: '["plot_1","plot_2"]',
          irrigationType: 'dryland',
          seasonStage: 'growing',
          painPoints: 'తెల్ల దోమ, నీటి కొరత',
          rawStoryJson: '{}',
        });
        console.log('[stdb] Demo farmer context set');
      } catch (err) {
        console.warn('[stdb] Failed to set demo farmer context:', err);
      }

      setTimeout(() => seedDemoData(connection), 500);

      showToast('\u0C38\u0C4D\u0C35\u0C3E\u0C17\u0C24\u0C02 \u0C32\u0C15\u0C4D\u0C37\u0C4D\u0C2E\u0C3F! \uD83C\uDF3E', 'default', 5000);
    }
  }, 300);

  setTimeout(() => clearInterval(checkInterval), 10000);
}

// ---------------------------------------------------------------------------
// Seed demo data (money events, market prices, crop events)
// ---------------------------------------------------------------------------

function seedDemoData(connection: DbConnection): void {
  // Only seed once per browser (tracked in localStorage)
  if (localStorage.getItem(SEEDED_KEY) === 'true') {
    console.log('[stdb] Demo data already seeded, skipping');
    return;
  }

  console.log('[stdb] Seeding demo data...');

  // --- Money Events (15 transactions) ---
  const moneyEvents: Array<{
    kind: string;
    amountPaise: bigint;
    isIncome: boolean;
    category: string;
    description: string;
    partyName: string;
    season: string;
  }> = [
    { kind: 'CropSale',            amountPaise: 1240000n, isIncome: true,  category: '\u0C2A\u0C02\u0C1F \u0C05\u0C2E\u0C4D\u0C2E\u0C15\u0C02',             description: '\u0C35\u0C47\u0C30\u0C41\u0C36\u0C46\u0C28\u0C17 \u0C05\u0C2E\u0C4D\u0C2E\u0C15\u0C02',       partyName: '', season: 'rabi_2026' },
    { kind: 'LaborPayment',        amountPaise: 80000n,   isIncome: false, category: '\u0C15\u0C42\u0C32\u0C3F',                       description: '\u0C30\u0C46\u0C02\u0C21\u0C41 \u0C15\u0C42\u0C32\u0C40\u0C32\u0C15\u0C41',               partyName: '', season: 'rabi_2026' },
    { kind: 'InputPurchase',        amountPaise: 150000n,  isIncome: false, category: '\u0C15\u0C4A\u0C28\u0C41\u0C17\u0C4B\u0C32\u0C41',                     description: '\u0C35\u0C3F\u0C24\u0C4D\u0C24\u0C28\u0C3E\u0C32\u0C41',                     partyName: '', season: 'rabi_2026' },
    { kind: 'InputPurchase',        amountPaise: 120000n,  isIncome: false, category: '\u0C15\u0C4A\u0C28\u0C41\u0C17\u0C4B\u0C32\u0C41',                     description: '\u0C2F\u0C42\u0C30\u0C3F\u0C2F\u0C3E \u0C0E\u0C30\u0C41\u0C35\u0C41\u0C32\u0C41',         partyName: '', season: 'rabi_2026' },
    { kind: 'LaborPayment',        amountPaise: 60000n,   isIncome: false, category: '\u0C15\u0C42\u0C32\u0C3F',                       description: '\u0C15\u0C32\u0C41\u0C2A\u0C41 \u0C24\u0C40\u0C24',                     partyName: '', season: 'rabi_2026' },
    { kind: 'InputPurchase',        amountPaise: 45000n,   isIncome: false, category: '\u0C15\u0C4A\u0C28\u0C41\u0C17\u0C4B\u0C32\u0C41',                     description: '\u0C2A\u0C41\u0C30\u0C41\u0C17\u0C41 \u0C2E\u0C02\u0C26\u0C41',                   partyName: '', season: 'rabi_2026' },
    { kind: 'GovernmentTransfer',   amountPaise: 200000n,  isIncome: true,  category: '\u0C2A\u0C4D\u0C30\u0C2D\u0C41\u0C24\u0C4D\u0C35 \u0C38\u0C2C\u0C4D\u0C38\u0C3F\u0C21\u0C40', description: 'PM-KISAN',                                   partyName: '', season: 'rabi_2026' },
    { kind: 'LaborPayment',        amountPaise: 80000n,   isIncome: false, category: '\u0C15\u0C42\u0C32\u0C3F',                       description: '\u0C28\u0C40\u0C1F\u0C3F \u0C2A\u0C3E\u0C30\u0C41\u0C26\u0C32 \u0C15\u0C42\u0C32\u0C3F', partyName: '', season: 'rabi_2026' },
    { kind: 'InputPurchase',        amountPaise: 35000n,   isIncome: false, category: '\u0C15\u0C4A\u0C28\u0C41\u0C17\u0C4B\u0C32\u0C41',                     description: '\u0C21\u0C4D\u0C30\u0C3F\u0C2A\u0C4D \u0C1F\u0C4D\u0C2F\u0C42\u0C2C\u0C4D',               partyName: '', season: 'rabi_2026' },
    { kind: 'CropSale',            amountPaise: 850000n,  isIncome: true,  category: '\u0C2A\u0C02\u0C1F \u0C05\u0C2E\u0C4D\u0C2E\u0C15\u0C02',             description: '\u0C2A\u0C24\u0C4D\u0C24\u0C3F \u0C05\u0C2E\u0C4D\u0C2E\u0C15\u0C02',           partyName: '', season: 'rabi_2026' },
    { kind: 'LaborPayment',        amountPaise: 120000n,  isIncome: false, category: '\u0C15\u0C42\u0C32\u0C3F',                       description: '\u0C2E\u0C42\u0C21\u0C41 \u0C15\u0C42\u0C32\u0C40\u0C32\u0C15\u0C41',               partyName: '', season: 'rabi_2026' },
    { kind: 'CropSale',            amountPaise: 450000n,  isIncome: true,  category: '\u0C2A\u0C02\u0C1F \u0C05\u0C2E\u0C4D\u0C2E\u0C15\u0C02',             description: '\u0C2A\u0C24\u0C4D\u0C24\u0C3F \u0C30\u0C46\u0C02\u0C21\u0C4B \u0C2A\u0C3F\u0C15\u0C4D', partyName: '', season: 'rabi_2026' },
    { kind: 'GovernmentTransfer',   amountPaise: 200000n,  isIncome: true,  category: '\u0C2A\u0C4D\u0C30\u0C2D\u0C41\u0C24\u0C4D\u0C35 \u0C38\u0C2C\u0C4D\u0C38\u0C3F\u0C21\u0C40', description: 'YSR \u0C30\u0C48\u0C24\u0C41 \u0C2D\u0C30\u0C4B\u0C38\u0C3E',             partyName: '', season: 'rabi_2026' },
    { kind: 'InputPurchase',        amountPaise: 280000n,  isIncome: false, category: '\u0C15\u0C4A\u0C28\u0C41\u0C17\u0C4B\u0C32\u0C41',                     description: '\u0C2C\u0C4B\u0C30\u0C4D \u0C2E\u0C4B\u0C1F\u0C3E\u0C30\u0C4D \u0C30\u0C3F\u0C2A\u0C47\u0C30\u0C4D', partyName: '', season: 'rabi_2026' },
    { kind: 'UPIPayment',          amountPaise: 15000n,   isIncome: false, category: 'UPI \u0C1A\u0C46\u0C32\u0C4D\u0C32\u0C3F\u0C02\u0C2A\u0C41',         description: '\u0C2C\u0C38\u0C4D \u0C1A\u0C3E\u0C30\u0C4D\u0C1C\u0C40\u0C32\u0C41',               partyName: '', season: 'rabi_2026' },
  ];

  for (let i = 0; i < moneyEvents.length; i++) {
    const e = moneyEvents[i];
    try {
      connection.reducers.recordMoneyEvent({
        kind: e.kind,
        amountPaise: e.amountPaise,
        isIncome: e.isIncome,
        category: e.category,
        description: e.description,
        partyName: e.partyName,
        season: e.season,
        idempotencyKey: `seed_money_${i}_${Date.now()}`,
      });
    } catch (err) {
      console.warn(`[stdb] Failed to seed money event ${i}:`, err);
    }
  }

  // --- Market Prices (6 prices) ---
  const marketPrices: MarketPriceInput[] = [
    { crop: '\u0C35\u0C47\u0C30\u0C41\u0C36\u0C46\u0C28\u0C17', mandi: '\u0C05\u0C28\u0C02\u0C24\u0C2A\u0C41\u0C30\u0C02', district: '\u0C05\u0C28\u0C02\u0C24\u0C2A\u0C41\u0C30\u0C02', pricePaise: 584000n, mspPaise: 560000n, date: '2026-03-16' },
    { crop: '\u0C35\u0C47\u0C30\u0C41\u0C36\u0C46\u0C28\u0C17', mandi: '\u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41',       district: '\u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41',       pricePaise: 592000n, mspPaise: 560000n, date: '2026-03-16' },
    { crop: '\u0C35\u0C47\u0C30\u0C41\u0C36\u0C46\u0C28\u0C17', mandi: '\u0C39\u0C3F\u0C02\u0C26\u0C42\u0C2A\u0C41\u0C30\u0C02',   district: '\u0C05\u0C28\u0C02\u0C24\u0C2A\u0C41\u0C30\u0C02', pricePaise: 578000n, mspPaise: 560000n, date: '2026-03-16' },
    { crop: '\u0C2A\u0C24\u0C4D\u0C24\u0C3F',                   mandi: '\u0C05\u0C28\u0C02\u0C24\u0C2A\u0C41\u0C30\u0C02', district: '\u0C05\u0C28\u0C02\u0C24\u0C2A\u0C41\u0C30\u0C02', pricePaise: 680000n, mspPaise: 670000n, date: '2026-03-16' },
    { crop: '\u0C2A\u0C24\u0C4D\u0C24\u0C3F',                   mandi: '\u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41',       district: '\u0C15\u0C30\u0C4D\u0C28\u0C42\u0C32\u0C41',       pricePaise: 695000n, mspPaise: 670000n, date: '2026-03-16' },
    { crop: '\u0C2A\u0C24\u0C4D\u0C24\u0C3F',                   mandi: '\u0C17\u0C41\u0C02\u0C1F\u0C42\u0C30\u0C41',       district: '\u0C17\u0C41\u0C02\u0C1F\u0C42\u0C30\u0C41',       pricePaise: 710000n, mspPaise: 670000n, date: '2026-03-16' },
  ];

  try {
    connection.reducers.updateMarketPrices({ prices: marketPrices });
    console.log('[stdb] Market prices seeded');
  } catch (err) {
    console.warn('[stdb] Failed to seed market prices:', err);
  }

  // --- Crop Events (5 events) ---
  const cropEvents = [
    { kind: 'Planted',      crop: '\u0C35\u0C47\u0C30\u0C41\u0C36\u0C46\u0C28\u0C17', plotId: 'plot_1', aiNotes: '\u0C30\u0C2C\u0C40 \u0C35\u0C3F\u0C24\u0C4D\u0C24\u0C28\u0C3E\u0C32\u0C41 \u0C35\u0C47\u0C36\u0C3E\u0C2E\u0C41' },
    { kind: 'Sprayed',      crop: '\u0C35\u0C47\u0C30\u0C41\u0C36\u0C46\u0C28\u0C17', plotId: 'plot_1', aiNotes: '\u0C2A\u0C41\u0C30\u0C41\u0C17\u0C41 \u0C2E\u0C02\u0C26\u0C41 \u0C1A\u0C32\u0C4D\u0C32\u0C3E\u0C2E\u0C41' },
    { kind: 'Irrigated',    crop: '\u0C35\u0C47\u0C30\u0C41\u0C36\u0C46\u0C28\u0C17', plotId: 'plot_1', aiNotes: '\u0C2C\u0C4B\u0C30\u0C4D \u0C28\u0C40\u0C33\u0C4D\u0C33\u0C41 \u0C2A\u0C46\u0C1F\u0C4D\u0C1F\u0C3E\u0C2E\u0C41' },
    { kind: 'PestObserved', crop: '\u0C2A\u0C24\u0C4D\u0C24\u0C3F',                   plotId: 'plot_2', aiNotes: '\u0C24\u0C46\u0C32\u0C4D\u0C32 \u0C26\u0C4B\u0C2E \u0C15\u0C28\u0C3F\u0C2A\u0C3F\u0C02\u0C1A\u0C3F\u0C02\u0C26\u0C3F' },
    { kind: 'Irrigated',    crop: '\u0C2A\u0C24\u0C4D\u0C24\u0C3F',                   plotId: 'plot_2', aiNotes: '\u0C21\u0C4D\u0C30\u0C3F\u0C2A\u0C4D \u0C26\u0C4D\u0C35\u0C3E\u0C30\u0C3E \u0C28\u0C40\u0C33\u0C4D\u0C33\u0C41' },
  ];

  for (const ce of cropEvents) {
    try {
      connection.reducers.recordCropEvent({
        kind: ce.kind,
        crop: ce.crop,
        plotId: ce.plotId,
        photoBytes: undefined,
        aiNotes: ce.aiNotes,
        gpsLat: undefined,
        gpsLon: undefined,
      });
    } catch (err) {
      console.warn('[stdb] Failed to seed crop event:', err);
    }
  }

  localStorage.setItem(SEEDED_KEY, 'true');
  console.log('[stdb] Demo data seeding complete (15 money, 6 market, 5 crop)');
}

/**
 * Connect to the live STDB module.
 * Stores auth token in localStorage for reconnect.
 */
export function connect(): void {
  console.log('[stdb] Connecting to rythu-mitra on maincloud...');

  conn = DbConnection.builder()
    .withUri(HOST)
    .withDatabaseName(DB_NAME)
    .withToken(localStorage.getItem(TOKEN_KEY) ?? undefined)
    .onConnect((_conn, id, token) => {
      localStorage.setItem(TOKEN_KEY, token);
      myIdentity.set(id);
      connected.set(true);
      connectionError.set(null);

      console.log('[stdb] Connected, identity:', String(id).slice(0, 16));

      // Register table callbacks BEFORE subscribing (001-ledger pattern)
      setupTableSync(_conn);

      // Subscribe to tables needed for Morning Briefing
      _conn.subscriptionBuilder()
        .onApplied(() => {
          console.log('[stdb] Subscription applied, syncing tables...');
          forceSync(_conn);
          console.log('[stdb] Sync complete');

          // Auto-register farmer if not found for this identity.
          // In non-demo mode: only re-registers if onboarding flag is set
          // (real users are registered by OnboardingFlow.svelte).
          ensureFarmerRegistered(_conn, id);

          // Seed demo data ONLY in demo mode
          if (isDemoMode() && localStorage.getItem(SEEDED_KEY) !== 'true') {
            // Wait a bit for registration to complete if it was just triggered
            setTimeout(() => {
              const farmers = iterToArray(_conn.db.farmer.iter());
              const myFarmer = farmers.find(f => String(f.identity) === String(id));
              if (myFarmer) {
                console.log('[stdb] Farmer exists, seeding demo data...');
                seedDemoData(_conn);
              } else {
                console.warn('[stdb] Farmer not found yet, will retry seeding in 2s...');
                setTimeout(() => seedDemoData(_conn), 2000);
              }
            }, 1500);
          }
        })
        .onError((ctx: unknown) => {
          console.error('[stdb] Subscription error:', ctx);
        })
        .subscribe([
          'SELECT * FROM farmer',
          'SELECT * FROM farmer_context',
          'SELECT * FROM money_event',
          'SELECT * FROM market_price',
          'SELECT * FROM farmer_balance',
          'SELECT * FROM crop_event',
        ]);
    })
    .onDisconnect(() => {
      console.log('[stdb] Disconnected');
      connected.set(false);
      conn = null;
    })
    .onConnectError((_ctx: ErrorContext, err: Error) => {
      console.error('[stdb] Connection error:', err);
      connectionError.set(err.message);
      connected.set(false);
    })
    .build();
}
