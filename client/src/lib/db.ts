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
// Auto-registration: ensure a farmer exists for this browser identity
// ---------------------------------------------------------------------------

function ensureFarmerRegistered(connection: DbConnection, identity: Identity): void {
  const farmers = iterToArray(connection.db.farmer.iter());
  const idStr = String(identity);
  const existing = farmers.find(f => String(f.identity) === idStr);

  if (existing) {
    console.log('[stdb] Farmer found:', existing.name);
    return;
  }

  console.log('[stdb] No farmer for this identity, auto-registering...');

  // Register the demo farmer for this browser identity
  connection.reducers.registerFarmer({
    name: '\u0C32\u0C15\u0C4D\u0C37\u0C4D\u0C2E\u0C3F',          // లక్ష్మి
    phone: '9876543210',
    village: '\u0C2A\u0C46\u0C28\u0C41\u0C15\u0C4A\u0C02\u0C21',  // పెనుకొండ
    district: '\u0C05\u0C28\u0C02\u0C24\u0C2A\u0C41\u0C30\u0C02', // అనంతపురం
    language: 'te',
  });

  // Wait for the farmer to ACTUALLY appear in the subscription before seeding.
  // The registerFarmer reducer runs async on the server — we need to wait for the
  // onInsert callback to fire, confirming the farmer exists in the DB.
  const checkInterval = setInterval(() => {
    const farmers = iterToArray(connection.db.farmer.iter());
    const found = farmers.find(f => String(f.identity) === idStr);
    if (found) {
      clearInterval(checkInterval);
      console.log('[stdb] Farmer registration confirmed:', found.name);

      // NOW it's safe to update context and seed data
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
        console.log('[stdb] Farmer context updated');
      } catch (err) {
        console.warn('[stdb] Failed to update farmer context:', err);
      }

      // Seed demo data — farmer is confirmed to exist, reducers will pass auth check
      setTimeout(() => seedDemoData(connection), 500);

      showToast('\u0C38\u0C4D\u0C35\u0C3E\u0C17\u0C24\u0C02 \u0C32\u0C15\u0C4D\u0C37\u0C4D\u0C2E\u0C3F! \uD83C\uDF3E', 'default', 5000);
      // స్వాగతం లక్ష్మి! 🌾
    }
  }, 300); // Check every 300ms

  // Safety: stop checking after 10 seconds (don't leak interval)
  setTimeout(() => {
    clearInterval(checkInterval);
  }, 10000);
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

          // Auto-register farmer if not found for this identity
          ensureFarmerRegistered(_conn, id);

          // Seed demo data if not yet seeded (separate from registration!)
          if (localStorage.getItem(SEEDED_KEY) !== 'true') {
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
