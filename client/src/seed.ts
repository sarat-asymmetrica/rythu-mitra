/**
 * Seed script for Rythu Mitra STDB module.
 *
 * Connects as a client, registers Lakshmi as a farmer, then inserts
 * demo money events, market prices, and farmer context.
 *
 * Run: npx tsx src/seed.ts
 */

import { DbConnection, type ErrorContext } from './module_bindings';

const HOST = 'wss://maincloud.spacetimedb.com';
const DB_NAME = 'rythu-mitra';

// Use a dedicated seed token so we can re-run
const SEED_TOKEN_KEY = 'rythu_mitra_seed_token';
let storedToken: string | undefined;
try {
  // Node doesn't have localStorage, use env or skip
  storedToken = process.env.STDB_SEED_TOKEN;
} catch {
  // no-op
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function seed() {
  console.log('[seed] Connecting to rythu-mitra on maincloud...');

  return new Promise<void>((resolve, reject) => {
    const conn = DbConnection.builder()
      .withUri(HOST)
      .withDatabaseName(DB_NAME)
      .withToken(storedToken)
      .onConnect(async (_conn, id, token) => {
        console.log(`[seed] Connected. Identity: ${String(id).slice(0, 24)}...`);
        console.log(`[seed] Token: ${token.slice(0, 20)}... (save as STDB_SEED_TOKEN to reuse)`);

        try {
          // Wait for connection to stabilize
          await sleep(1000);

          // Step 1: Register farmer
          console.log('[seed] Registering farmer: Lakshmi...');
          _conn.reducers.registerFarmer({
            name: 'లక్ష్మి',
            phone: '9876543210',
            village: 'పెనుకొండ',
            district: 'అనంతపురం',
            language: 'te',
          });
          await sleep(2000);

          // Step 2: Update farmer context
          console.log('[seed] Updating farmer context...');
          _conn.reducers.updateFarmerContext({
            crops: '["వేరుశెనగ", "పత్తి"]',
            acres: 4,
            plots: '["plot_a"]',
            irrigationType: 'dryland',
            seasonStage: 'growing',
            painPoints: 'మార్కెట్ ధరల గురించి తెలియదు',
            rawStoryJson: '{}',
          });
          await sleep(1000);

          // Step 3: Insert money events
          console.log('[seed] Inserting 10 money events...');
          const moneyEvents = [
            { kind: 'CropSale', amountPaise: 1240000n, isIncome: true, category: 'పంట అమ్మకం', description: 'వేరుశెనగ అమ్మకం', partyName: 'రాజు ట్రేడర్', season: 'rabi_2026', idempotencyKey: `seed_1_${Date.now()}` },
            { kind: 'LaborPayment', amountPaise: 80000n, isIncome: false, category: 'కూలి ఖర్చు', description: 'రెండు కూలీలకు', partyName: '', season: 'rabi_2026', idempotencyKey: `seed_2_${Date.now()}` },
            { kind: 'InputPurchase', amountPaise: 150000n, isIncome: false, category: 'విత్తన ఖర్చు', description: 'విత్తనాలు', partyName: 'నంది విత్తనాలు', season: 'rabi_2026', idempotencyKey: `seed_3_${Date.now()}` },
            { kind: 'InputPurchase', amountPaise: 120000n, isIncome: false, category: 'ఎరువులు', description: 'యూరియా ఎరువులు', partyName: 'కో-ఆపరేటివ్', season: 'rabi_2026', idempotencyKey: `seed_4_${Date.now()}` },
            { kind: 'LaborPayment', amountPaise: 60000n, isIncome: false, category: 'కూలి ఖర్చు', description: 'కలుపు తీత', partyName: '', season: 'rabi_2026', idempotencyKey: `seed_5_${Date.now()}` },
            { kind: 'InputPurchase', amountPaise: 45000n, isIncome: false, category: 'పురుగు మందు', description: 'పురుగు మందు', partyName: 'అగ్రి షాప్', season: 'rabi_2026', idempotencyKey: `seed_6_${Date.now()}` },
            { kind: 'GovernmentTransfer', amountPaise: 200000n, isIncome: true, category: 'ప్రభుత్వ సబ్సిడీ', description: 'PM-KISAN', partyName: 'ప్రభుత్వం', season: 'rabi_2026', idempotencyKey: `seed_7_${Date.now()}` },
            { kind: 'LaborPayment', amountPaise: 80000n, isIncome: false, category: 'కూలి ఖర్చు', description: 'నీటి పారుదల కూలి', partyName: '', season: 'rabi_2026', idempotencyKey: `seed_8_${Date.now()}` },
            { kind: 'InputPurchase', amountPaise: 35000n, isIncome: false, category: 'నీటిపారుదల', description: 'డ్రిప్ ట్యూబ్', partyName: 'జైన్ ఇరిగేషన్', season: 'rabi_2026', idempotencyKey: `seed_9_${Date.now()}` },
            { kind: 'CropSale', amountPaise: 850000n, isIncome: true, category: 'పంట అమ్మకం', description: 'పత్తి అమ్మకం - మొదటి పిక్', partyName: 'కృష్ణ ట్రేడర్', season: 'rabi_2026', idempotencyKey: `seed_10_${Date.now()}` },
          ];

          for (const evt of moneyEvents) {
            _conn.reducers.recordMoneyEvent(evt);
            await sleep(500);
          }

          // Step 4: Insert market prices
          console.log('[seed] Inserting 6 market prices...');
          const today = new Date().toISOString().slice(0, 10);
          _conn.reducers.updateMarketPrices({
            prices: [
              { crop: 'వేరుశెనగ', mandi: 'అనంతపురం', district: 'అనంతపురం', pricePaise: 584000n, mspPaise: 560000n, date: today },
              { crop: 'వేరుశెనగ', mandi: 'కర్నూలు', district: 'కర్నూలు', pricePaise: 592000n, mspPaise: 560000n, date: today },
              { crop: 'పత్తి', mandi: 'అనంతపురం', district: 'అనంతపురం', pricePaise: 680000n, mspPaise: 670000n, date: today },
              { crop: 'పత్తి', mandi: 'కర్నూలు', district: 'కర్నూలు', pricePaise: 695000n, mspPaise: 670000n, date: today },
              { crop: 'వేరుశెనగ', mandi: 'హిందూపురం', district: 'అనంతపురం', pricePaise: 578000n, mspPaise: 560000n, date: today },
              { crop: 'పత్తి', mandi: 'గుంటూరు', district: 'గుంటూరు', pricePaise: 710000n, mspPaise: 670000n, date: today },
            ],
          });

          console.log('[seed] All seed data inserted successfully!');
          console.log('[seed] Summary:');
          console.log('  - 1 farmer (లక్ష్మి)');
          console.log('  - 1 farmer context (వేరుశెనగ + పత్తి, 4 acres, dryland)');
          console.log('  - 10 money events (3 income + 7 expense)');
          console.log('  - 6 market prices (2 crops x 3 mandis)');
          console.log('');
          console.log('[seed] Total income: Rs 22,900 (12,400 + 2,000 + 8,500)');
          console.log('[seed] Total expense: Rs 5,700 (800 + 1,500 + 1,200 + 600 + 450 + 800 + 350)');
          console.log('[seed] Balance: Rs 17,200');

          await sleep(2000);
          process.exit(0);
        } catch (err) {
          console.error('[seed] Error:', err);
          reject(err);
        }
      })
      .onDisconnect(() => {
        console.log('[seed] Disconnected');
      })
      .onConnectError((_ctx: unknown, err: Error) => {
        console.error('[seed] Connection error:', err);
        reject(err);
      })
      .build();
  });
}

seed().catch(err => {
  console.error('[seed] Fatal:', err);
  process.exit(1);
});
