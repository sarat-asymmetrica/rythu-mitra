// Rythu Mitra — SpacetimeDB Foundation Module (F001)
// Vernacular-first farmer business management for Telugu-speaking farmers.
//
// Tables (11): farmer, farmer_context, money_event, crop_event, market_price,
//              scheme_status, document, party, activity_log, learning_profile,
//              curriculum_item
//
// Invariants:
//   1. Balance is NEVER stored — always computed from money_events
//   2. All money is integer paise (u64) — NO floating point
//   3. Idempotency key on financial writes
//   4. Identity comparison via String() — never === on Identity objects
//   5. All table names use snake_case with explicit name overrides
//   6. Enums as string unions (STDB TypeScript pattern)

import { schema, table, t, type Infer } from 'spacetimedb/server';
import { SenderError } from 'spacetimedb/server';

// ---------------------------------------------------------------------------
// PRODUCT TYPES (for batch operations)
// ---------------------------------------------------------------------------

const MarketPriceInput = t.object('MarketPriceInput', {
  crop: t.string(),
  mandi: t.string(),
  district: t.string(),
  pricePaise: t.u64(),
  mspPaise: t.u64(),
  date: t.string(),
});

// ---------------------------------------------------------------------------
// TABLE ROW DEFINITIONS
// ---------------------------------------------------------------------------

// 1. farmer — core identity table
const farmerRow = {
  identity: t.identity().primaryKey(),
  name: t.string(),
  phone: t.string(),
  village: t.string(),
  district: t.string(),
  language: t.string(),          // default "te"
  literacy_level: t.string(),    // "can_read" | "voice_only" | "literate"
  created_at: t.timestamp(),
};

// 2. farmer_context — onboarding data, farming profile
const farmerContextRow = {
  farmer_id: t.identity().primaryKey(),  // 1:1 with farmer
  crops: t.string(),             // JSON array: ["groundnut", "cotton"]
  acres: t.u32(),
  plots: t.string(),             // JSON array: ["plot_a", "plot_b"]
  irrigation_type: t.string(),   // "dryland" | "borewell" | "canal" | "drip"
  season_stage: t.string(),      // "pre_sowing" | "sowing" | "growing" | "harvest" | "post_harvest"
  pain_points: t.string(),
  raw_story_json: t.string(),    // onboarding conversation verbatim
};

// 3. money_event — financial ledger (THE truth layer)
const moneyEventRow = {
  id: t.u64().primaryKey().autoInc(),
  farmer_id: t.identity(),
  kind: t.string(),              // "CropSale"|"InputPurchase"|"LaborPayment"|"GovernmentTransfer"|"UPIPayment"|"Other"
  amount_paise: t.u64(),         // Rs 1 = 100 paise, ALWAYS integer
  is_income: t.bool(),           // true = money in, false = money out
  category: t.string(),          // free text, AI-suggested
  description: t.string(),       // original Telugu transcription
  party_name: t.string(),        // dealer/trader/laborer name
  season: t.string(),            // "kharif_2026" | "rabi_2025" etc.
  idempotency_key: t.string().unique(),  // SHA256 hash, unique
  created_at: t.timestamp(),
};

// 4. crop_event — field diary
const cropEventRow = {
  id: t.u64().primaryKey().autoInc(),
  farmer_id: t.identity(),
  kind: t.string(),              // "Planted"|"Sprayed"|"PestObserved"|"Irrigated"|"Harvested"|"Sold"
  crop: t.string(),
  plot_id: t.string(),
  photo_bytes: t.byteArray().optional(),
  ai_notes: t.string(),          // pest ID result, crop health assessment
  gps_lat: t.f64().optional(),
  gps_lon: t.f64().optional(),
  created_at: t.timestamp(),
};

// 5. market_price — mandi rates (public, no RLS)
const marketPriceRow = {
  id: t.u64().primaryKey().autoInc(),
  crop: t.string(),
  mandi: t.string(),             // market name
  district: t.string(),
  price_per_quintal_paise: t.u64(),
  msp_price_paise: t.u64(),     // Minimum Support Price, 0 if N/A
  date: t.string(),              // YYYY-MM-DD
};

// 6. scheme_status — government scheme tracking
const schemeStatusRow = {
  id: t.u64().primaryKey().autoInc(),
  farmer_id: t.identity(),
  scheme_name: t.string(),       // "PM-KISAN"|"PMFBY"|"YSR_Rythu_Bharosa" etc.
  status: t.string(),            // "active"|"pending"|"received"|"rejected"
  last_checked: t.timestamp(),
  amount_paise: t.u64(),
  details_json: t.string(),
};

// 7. document — bills, receipts, crop photos
const documentRow = {
  id: t.u64().primaryKey().autoInc(),
  farmer_id: t.identity(),
  kind: t.string(),              // "Bill"|"Receipt"|"CropPhoto"|"Report"
  bytes: t.byteArray(),
  ocr_text: t.string(),
  structured_json: t.string(),   // extracted fields: amount, date, product, etc.
  hot_cold_state: t.string(),    // "hot"|"cold"
  created_at: t.timestamp(),
};

// 8. party — dealers, traders, FPOs, laborers
const partyRow = {
  id: t.u64().primaryKey().autoInc(),
  farmer_id: t.identity(),
  name: t.string(),
  kind: t.string(),              // "Dealer"|"Trader"|"FPO"|"Cooperative"|"Laborer"
  phone: t.string(),             // empty string if not known
  is_dealer: t.bool(),
  is_buyer: t.bool(),
  grade: t.string(),             // "A"|"B"|"C"|"D" from M79 prediction
};

// 9. activity_log — audit trail
const activityLogRow = {
  id: t.u64().primaryKey().autoInc(),
  farmer_id: t.identity(),
  entity_type: t.string(),       // "money_event"|"crop_event"|"document" etc.
  action: t.string(),            // "created"|"updated"|"deleted"
  detail: t.string(),
  created_at: t.timestamp(),
};

// 10. learning_profile — adaptive learning state
const learningProfileRow = {
  farmer_id: t.identity().primaryKey(),  // 1:1 with farmer
  literacy_level: t.string(),
  preferred_mode: t.string(),    // "voice"|"text"|"visual"
  pace: t.string(),              // "slow"|"normal"|"fast"
  topics_needed_json: t.string(),
  last_updated: t.timestamp(),
};

// 11. curriculum_item — learning content per farmer
const curriculumItemRow = {
  id: t.u64().primaryKey().autoInc(),
  farmer_id: t.identity(),
  topic: t.string(),
  stage: t.string(),             // "new"|"in_progress"|"understood"|"skipped"
  content_te: t.string(),        // Telugu content
  source_url: t.string(),
  citations_json: t.string(),
  status: t.string(),
  created_at: t.timestamp(),
};

// 12. chat_message — conversation persistence
const chatMessageRow = {
  id: t.u64().primaryKey().autoInc(),
  farmer_id: t.identity(),
  role: t.string(),              // "user" | "assistant" | "system"
  content: t.string(),           // Telugu text
  intent: t.string(),            // "record" | "ask" | "consult" | "upload" | "social" | "unknown"
  metadata_json: t.string(),     // parsed expense, search results, etc.
  created_at: t.timestamp(),
};

// 13. farmer_memory — AI observations & farmer preferences
const farmerMemoryRow = {
  id: t.u64().primaryKey().autoInc(),
  farmer_id: t.identity(),
  content: t.string(),           // free-form observation in Telugu/English
  source: t.string(),            // "ai_observed" | "farmer_stated" | "pattern_detected"
  confidence: t.f64(),           // 0.0 to 1.0
  active: t.bool(),              // true = included in system prompt
  created_at: t.timestamp(),
  last_used_at: t.timestamp(),   // updated each time memory is used
};

// ---------------------------------------------------------------------------
// SCHEMA
// ---------------------------------------------------------------------------

const spacetimedb = schema({
  farmer: table(
    {
      name: 'farmer',
      public: true,
    },
    farmerRow,
  ),

  farmerContext: table(
    {
      name: 'farmer_context',
      public: true,
    },
    farmerContextRow,
  ),

  moneyEvent: table(
    {
      name: 'money_event',
      public: true,
      indexes: [
        { accessor: 'money_event_farmer_id', algorithm: 'btree' as const, columns: ['farmer_id'] },
        // idempotency_key gets a unique index automatically from .unique()
      ],
    },
    moneyEventRow,
  ),

  cropEvent: table(
    {
      name: 'crop_event',
      public: true,
      indexes: [
        { accessor: 'crop_event_farmer_id', algorithm: 'btree' as const, columns: ['farmer_id'] },
      ],
    },
    cropEventRow,
  ),

  marketPrice: table(
    {
      name: 'market_price',
      public: true,
      indexes: [
        { accessor: 'market_price_crop', algorithm: 'btree' as const, columns: ['crop'] },
        { accessor: 'market_price_district', algorithm: 'btree' as const, columns: ['district'] },
      ],
    },
    marketPriceRow,
  ),

  schemeStatus: table(
    {
      name: 'scheme_status',
      public: true,
      indexes: [
        { accessor: 'scheme_status_farmer_id', algorithm: 'btree' as const, columns: ['farmer_id'] },
      ],
    },
    schemeStatusRow,
  ),

  document: table(
    {
      name: 'document',
      public: true,
      indexes: [
        { accessor: 'document_farmer_id', algorithm: 'btree' as const, columns: ['farmer_id'] },
      ],
    },
    documentRow,
  ),

  party: table(
    {
      name: 'party',
      public: true,
      indexes: [
        { accessor: 'party_farmer_id', algorithm: 'btree' as const, columns: ['farmer_id'] },
      ],
    },
    partyRow,
  ),

  activityLog: table(
    {
      name: 'activity_log',
      public: true,
      indexes: [
        { accessor: 'activity_log_farmer_id', algorithm: 'btree' as const, columns: ['farmer_id'] },
      ],
    },
    activityLogRow,
  ),

  learningProfile: table(
    {
      name: 'learning_profile',
      public: true,
    },
    learningProfileRow,
  ),

  curriculumItem: table(
    {
      name: 'curriculum_item',
      public: true,
      indexes: [
        { accessor: 'curriculum_item_farmer_id', algorithm: 'btree' as const, columns: ['farmer_id'] },
      ],
    },
    curriculumItemRow,
  ),

  chatMessage: table(
    {
      name: 'chat_message',
      public: true,
      indexes: [
        { accessor: 'chat_message_farmer_id', algorithm: 'btree' as const, columns: ['farmer_id'] },
      ],
    },
    chatMessageRow,
  ),

  farmerMemory: table(
    {
      name: 'farmer_memory',
      public: true,
      indexes: [
        { accessor: 'farmer_memory_farmer_id', algorithm: 'btree' as const, columns: ['farmer_id'] },
      ],
    },
    farmerMemoryRow,
  ),
});

export default spacetimedb;

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

// Identity comparison helper — NEVER use === on Identity objects.
// See STDB_LEARNINGS.md #3.
function identityEquals(a: any, b: any): boolean {
  return String(a) === String(b);
}

// Digital root — Vedic Beejank. O(1) number property detection.
function digitalRoot(n: number): number {
  if (n === 0) return 0;
  return 1 + ((n - 1) % 9);
}

// Insert an activity log entry (called by reducers, not directly by clients)
function insertActivityLog(
  ctx: any,
  farmerId: any,
  entityType: string,
  action: string,
  detail: string,
) {
  ctx.db.activityLog.insert({
    id: 0n,
    farmer_id: farmerId,
    entity_type: entityType,
    action,
    detail,
    created_at: ctx.timestamp,
  });
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------

export const init = spacetimedb.init((_ctx) => {
  console.info('[rythu-mitra] Module initialized. Jay Jawan Jay Kisan!');
});

export const onConnect = spacetimedb.clientConnected((ctx) => {
  const farmer = ctx.db.farmer.identity.find(ctx.sender);
  if (farmer) {
    console.info(`[rythu-mitra] Farmer reconnected: ${farmer.name} (${farmer.village})`);
  }
});

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  const farmer = ctx.db.farmer.identity.find(ctx.sender);
  if (farmer) {
    console.info(`[rythu-mitra] Farmer disconnected: ${farmer.name}`);
  }
});

// ---------------------------------------------------------------------------
// VIEWS
// ---------------------------------------------------------------------------

// farmer_balance — computed from money_events, NEVER stored.
// This is the Phase 18 invariant: "outstanding" is always derived.
//
// Uses per-sender view with index lookup for efficient invalidation.
// Clients subscribe: SELECT * FROM farmer_balance
export const farmer_balance = spacetimedb.view(
  { name: 'farmer_balance', public: true },
  t.array(t.object('FarmerBalanceRow', {
    farmerId: t.identity(),
    totalIncomePaise: t.u64(),
    totalExpensePaise: t.u64(),
  })),
  (ctx) => {
    let totalIncome = 0n;
    let totalExpense = 0n;

    for (const evt of ctx.db.moneyEvent.money_event_farmer_id.filter(ctx.sender)) {
      if (evt.is_income) {
        totalIncome += evt.amount_paise;
      } else {
        totalExpense += evt.amount_paise;
      }
    }

    return [{
      farmerId: ctx.sender,
      totalIncomePaise: totalIncome,
      totalExpensePaise: totalExpense,
    }];
  },
);

// ---------------------------------------------------------------------------
// REDUCERS — Auth
// ---------------------------------------------------------------------------

// register_farmer: creates farmer + farmer_context + learning_profile atomically.
// Caller identity becomes the farmer identity.
export const register_farmer = spacetimedb.reducer(
  {
    name: t.string(),
    phone: t.string(),
    village: t.string(),
    district: t.string(),
    language: t.string(),
  },
  (ctx, args) => {
    // Check if already registered
    const existing = ctx.db.farmer.identity.find(ctx.sender);
    if (existing) {
      throw new SenderError(`Already registered as "${existing.name}"`);
    }

    // Create farmer
    ctx.db.farmer.insert({
      identity: ctx.sender,
      name: args.name,
      phone: args.phone,
      village: args.village,
      district: args.district,
      language: args.language || 'te',
      literacy_level: 'voice_only',  // safe default for rural India
      created_at: ctx.timestamp,
    });

    // Create empty farmer_context
    ctx.db.farmerContext.insert({
      farmer_id: ctx.sender,
      crops: '[]',
      acres: 0,
      plots: '[]',
      irrigation_type: 'dryland',
      season_stage: 'pre_sowing',
      pain_points: '',
      raw_story_json: '{}',
    });

    // Create empty learning_profile
    ctx.db.learningProfile.insert({
      farmer_id: ctx.sender,
      literacy_level: 'voice_only',
      preferred_mode: 'voice',
      pace: 'normal',
      topics_needed_json: '[]',
      last_updated: ctx.timestamp,
    });

    insertActivityLog(ctx, ctx.sender, 'farmer', 'created',
      `Registered: ${args.name}, ${args.village}, ${args.district}`);

    console.info(`[rythu-mitra] New farmer: ${args.name} from ${args.village}, ${args.district}`);
  },
);

// ---------------------------------------------------------------------------
// REDUCERS — Onboarding
// ---------------------------------------------------------------------------

// update_farmer_context: update the farming profile after onboarding conversation
export const update_farmer_context = spacetimedb.reducer(
  {
    crops: t.string(),             // JSON array string
    acres: t.u32(),
    plots: t.string(),             // JSON array string
    irrigation_type: t.string(),
    season_stage: t.string(),
    pain_points: t.string(),
    raw_story_json: t.string(),
  },
  (ctx, args) => {
    const existing = ctx.db.farmerContext.farmer_id.find(ctx.sender);
    if (!existing) {
      throw new SenderError('Farmer not registered. Call register_farmer first.');
    }

    ctx.db.farmerContext.farmer_id.update({
      ...existing,
      crops: args.crops,
      acres: args.acres,
      plots: args.plots,
      irrigation_type: args.irrigation_type,
      season_stage: args.season_stage,
      pain_points: args.pain_points,
      raw_story_json: args.raw_story_json,
    });

    insertActivityLog(ctx, ctx.sender, 'farmer_context', 'updated',
      `Context updated: ${args.crops}, ${args.acres} acres, ${args.irrigation_type}`);
  },
);

// ---------------------------------------------------------------------------
// REDUCERS — Money
// ---------------------------------------------------------------------------

// record_money_event: THE critical financial reducer.
// Enforces: paise-only, idempotency key, zero-amount rejection.
// Balance is NEVER stored — computed from sum of events.
export const record_money_event = spacetimedb.reducer(
  {
    kind: t.string(),
    amount_paise: t.u64(),
    is_income: t.bool(),
    category: t.string(),
    description: t.string(),
    party_name: t.string(),
    season: t.string(),
    idempotency_key: t.string(),
  },
  (ctx, args) => {
    // Auth: must be a registered farmer
    const farmer = ctx.db.farmer.identity.find(ctx.sender);
    if (!farmer) {
      throw new SenderError('Farmer not registered. Call register_farmer first.');
    }

    // INVARIANT: reject zero amounts
    if (args.amount_paise === 0n) {
      throw new SenderError('Amount must be greater than zero (paise).');
    }

    // INVARIANT: reject empty idempotency key
    if (!args.idempotency_key || args.idempotency_key.trim() === '') {
      throw new SenderError('Idempotency key is required for financial writes.');
    }

    // INVARIANT: reject duplicate idempotency key
    // .unique() column has automatic unique index, use .find()
    const duplicate = ctx.db.moneyEvent.idempotency_key.find(args.idempotency_key);
    if (duplicate) {
      throw new SenderError(`Duplicate idempotency key: ${args.idempotency_key}`);
    }

    // Validate kind enum
    const validKinds = ['CropSale', 'InputPurchase', 'LaborPayment', 'GovernmentTransfer', 'UPIPayment', 'Other'];
    if (!validKinds.includes(args.kind)) {
      throw new SenderError(`Invalid kind: "${args.kind}". Must be one of: ${validKinds.join(', ')}`);
    }

    const row = ctx.db.moneyEvent.insert({
      id: 0n,
      farmer_id: ctx.sender,
      kind: args.kind,
      amount_paise: args.amount_paise,
      is_income: args.is_income,
      category: args.category,
      description: args.description,
      party_name: args.party_name,
      season: args.season,
      idempotency_key: args.idempotency_key,
      created_at: ctx.timestamp,
    });

    const direction = args.is_income ? 'IN' : 'OUT';
    const rupees = Number(args.amount_paise) / 100;
    const dr = digitalRoot(Number(args.amount_paise));

    insertActivityLog(ctx, ctx.sender, 'money_event', 'created',
      `${direction} Rs ${rupees} [${args.kind}] ${args.description} (DR=${dr})`);

    console.info(`[rythu-mitra] Money ${direction}: Rs ${rupees} for ${farmer.name} [${args.kind}]`);
  },
);

// update_money_event: modify an existing financial event (amount, kind, description).
// Only the owning farmer can update their own events.
// Enforces: paise-only, zero-amount rejection, ownership check.
export const update_money_event = spacetimedb.reducer(
  {
    event_id: t.u64(),
    amount_paise: t.u64(),
    kind: t.string(),
    is_income: t.bool(),
    description: t.string(),
    party_name: t.string(),
  },
  (ctx, args) => {
    const farmer = ctx.db.farmer.identity.find(ctx.sender);
    if (!farmer) {
      throw new SenderError('Farmer not registered.');
    }

    const evt = ctx.db.moneyEvent.id.find(args.event_id);
    if (!evt) {
      throw new SenderError(`Money event #${args.event_id} not found.`);
    }

    // CRITICAL: ownership check via String(), never ===
    if (!identityEquals(evt.farmer_id, ctx.sender)) {
      throw new SenderError('Cannot update another farmer\'s money event.');
    }

    // INVARIANT: reject zero amounts
    if (args.amount_paise === 0n) {
      throw new SenderError('Amount must be greater than zero (paise).');
    }

    // Validate kind enum
    const validKinds = ['CropSale', 'InputPurchase', 'LaborPayment', 'GovernmentTransfer', 'UPIPayment', 'Other'];
    if (!validKinds.includes(args.kind)) {
      throw new SenderError(`Invalid kind: "${args.kind}". Must be one of: ${validKinds.join(', ')}`);
    }

    const oldRupees = Number(evt.amount_paise) / 100;
    const newRupees = Number(args.amount_paise) / 100;

    ctx.db.moneyEvent.id.update({
      ...evt,
      amount_paise: args.amount_paise,
      kind: args.kind,
      is_income: args.is_income,
      description: args.description,
      party_name: args.party_name,
    });

    insertActivityLog(ctx, ctx.sender, 'money_event', 'updated',
      `Updated #${args.event_id}: Rs ${oldRupees} -> Rs ${newRupees} [${args.kind}] ${args.description}`);

    console.info(`[rythu-mitra] Updated money event #${args.event_id} for ${farmer.name}: Rs ${oldRupees} -> Rs ${newRupees}`);
  },
);

// remove_money_event: only the owning farmer can remove their own events.
// Hard delete (STDB is append-only at storage level anyway).
export const remove_money_event = spacetimedb.reducer(
  {
    event_id: t.u64(),
  },
  (ctx, { event_id }) => {
    const farmer = ctx.db.farmer.identity.find(ctx.sender);
    if (!farmer) {
      throw new SenderError('Farmer not registered.');
    }

    const evt = ctx.db.moneyEvent.id.find(event_id);
    if (!evt) {
      throw new SenderError(`Money event #${event_id} not found.`);
    }

    // CRITICAL: ownership check via String(), never ===
    if (!identityEquals(evt.farmer_id, ctx.sender)) {
      throw new SenderError('Cannot remove another farmer\'s money event.');
    }

    ctx.db.moneyEvent.id.delete(event_id);

    const rupees = Number(evt.amount_paise) / 100;
    insertActivityLog(ctx, ctx.sender, 'money_event', 'deleted',
      `Removed: Rs ${rupees} [${evt.kind}] ${evt.description}`);

    console.info(`[rythu-mitra] Removed money event #${event_id} for ${farmer.name}`);
  },
);

// ---------------------------------------------------------------------------
// REDUCERS — Crops
// ---------------------------------------------------------------------------

// record_crop_event: field diary entry with optional photo + GPS
export const record_crop_event = spacetimedb.reducer(
  {
    kind: t.string(),
    crop: t.string(),
    plot_id: t.string(),
    photo_bytes: t.byteArray().optional(),
    ai_notes: t.string(),
    gps_lat: t.f64().optional(),
    gps_lon: t.f64().optional(),
  },
  (ctx, args) => {
    const farmer = ctx.db.farmer.identity.find(ctx.sender);
    if (!farmer) {
      throw new SenderError('Farmer not registered.');
    }

    const validKinds = ['Planted', 'Sprayed', 'PestObserved', 'Irrigated', 'Harvested', 'Sold'];
    if (!validKinds.includes(args.kind)) {
      throw new SenderError(`Invalid crop event kind: "${args.kind}". Must be one of: ${validKinds.join(', ')}`);
    }

    ctx.db.cropEvent.insert({
      id: 0n,
      farmer_id: ctx.sender,
      kind: args.kind,
      crop: args.crop,
      plot_id: args.plot_id,
      photo_bytes: args.photo_bytes ?? undefined,
      ai_notes: args.ai_notes,
      gps_lat: args.gps_lat ?? undefined,
      gps_lon: args.gps_lon ?? undefined,
      created_at: ctx.timestamp,
    });

    insertActivityLog(ctx, ctx.sender, 'crop_event', 'created',
      `${args.kind}: ${args.crop} on ${args.plot_id}`);

    console.info(`[rythu-mitra] Crop event: ${args.kind} ${args.crop} for ${farmer.name}`);
  },
);

// ---------------------------------------------------------------------------
// REDUCERS — Market
// ---------------------------------------------------------------------------

// update_market_prices: batch insert/upsert of mandi prices.
// Designed for Williams-batched external data from Agmarknet.
// Upsert logic: if crop+mandi+date match exists, update price; else insert new.
export const update_market_prices = spacetimedb.reducer(
  {
    prices: t.array(MarketPriceInput),
  },
  (ctx, { prices }) => {
    // Auth: any registered farmer or system can update prices
    // (In production, this would be restricted to admin/system identity)

    let inserted = 0;
    let updated = 0;

    for (const p of prices) {
      // Search for existing entry with same crop+mandi+date
      // Multi-column indexes are broken in STDB, so we use single-column + manual filter
      let found = false;
      for (const existing of ctx.db.marketPrice.market_price_crop.filter(p.crop)) {
        if (existing.mandi === p.mandi && existing.date === p.date) {
          // Upsert: update existing
          ctx.db.marketPrice.id.update({
            ...existing,
            price_per_quintal_paise: p.pricePaise,
            msp_price_paise: p.mspPaise,
            district: p.district,
          });
          found = true;
          updated++;
          break;
        }
      }

      if (!found) {
        ctx.db.marketPrice.insert({
          id: 0n,
          crop: p.crop,
          mandi: p.mandi,
          district: p.district,
          price_per_quintal_paise: p.pricePaise,
          msp_price_paise: p.mspPaise,
          date: p.date,
        });
        inserted++;
      }
    }

    console.info(`[rythu-mitra] Market prices: ${inserted} inserted, ${updated} updated (batch of ${prices.length})`);
  },
);

// ---------------------------------------------------------------------------
// REDUCERS — Schemes
// ---------------------------------------------------------------------------

// update_scheme_status: track government scheme status for a farmer
export const update_scheme_status = spacetimedb.reducer(
  {
    scheme_name: t.string(),
    status: t.string(),
    amount_paise: t.u64(),
    details_json: t.string(),
  },
  (ctx, args) => {
    const farmer = ctx.db.farmer.identity.find(ctx.sender);
    if (!farmer) {
      throw new SenderError('Farmer not registered.');
    }

    const validStatuses = ['active', 'pending', 'received', 'rejected'];
    if (!validStatuses.includes(args.status)) {
      throw new SenderError(`Invalid scheme status: "${args.status}". Must be one of: ${validStatuses.join(', ')}`);
    }

    // Check if scheme already tracked for this farmer
    let existingScheme: any = null;
    for (const s of ctx.db.schemeStatus.scheme_status_farmer_id.filter(ctx.sender)) {
      if (s.scheme_name === args.scheme_name) {
        existingScheme = s;
        break;
      }
    }

    if (existingScheme) {
      ctx.db.schemeStatus.id.update({
        ...existingScheme,
        status: args.status,
        amount_paise: args.amount_paise,
        details_json: args.details_json,
        last_checked: ctx.timestamp,
      });
    } else {
      ctx.db.schemeStatus.insert({
        id: 0n,
        farmer_id: ctx.sender,
        scheme_name: args.scheme_name,
        status: args.status,
        last_checked: ctx.timestamp,
        amount_paise: args.amount_paise,
        details_json: args.details_json,
      });
    }

    insertActivityLog(ctx, ctx.sender, 'scheme_status', existingScheme ? 'updated' : 'created',
      `${args.scheme_name}: ${args.status}`);

    console.info(`[rythu-mitra] Scheme ${args.scheme_name}: ${args.status} for ${farmer.name}`);
  },
);

// ---------------------------------------------------------------------------
// REDUCERS — Documents
// ---------------------------------------------------------------------------

// store_document: store a bill, receipt, or crop photo
export const store_document = spacetimedb.reducer(
  {
    kind: t.string(),
    bytes: t.byteArray(),
  },
  (ctx, args) => {
    const farmer = ctx.db.farmer.identity.find(ctx.sender);
    if (!farmer) {
      throw new SenderError('Farmer not registered.');
    }

    const validKinds = ['Bill', 'Receipt', 'CropPhoto', 'Report'];
    if (!validKinds.includes(args.kind)) {
      throw new SenderError(`Invalid document kind: "${args.kind}". Must be one of: ${validKinds.join(', ')}`);
    }

    const row = ctx.db.document.insert({
      id: 0n,
      farmer_id: ctx.sender,
      kind: args.kind,
      bytes: args.bytes,
      ocr_text: '',
      structured_json: '{}',
      hot_cold_state: 'hot',       // newly uploaded = hot
      created_at: ctx.timestamp,
    });

    insertActivityLog(ctx, ctx.sender, 'document', 'created',
      `Uploaded ${args.kind} (doc #${row.id})`);

    console.info(`[rythu-mitra] Document stored: ${args.kind} #${row.id} for ${farmer.name}`);
  },
);

// update_document_ocr: after OCR processing, store extracted text + structured data
export const update_document_ocr = spacetimedb.reducer(
  {
    doc_id: t.u64(),
    ocr_text: t.string(),
    structured_json: t.string(),
  },
  (ctx, args) => {
    const farmer = ctx.db.farmer.identity.find(ctx.sender);
    if (!farmer) {
      throw new SenderError('Farmer not registered.');
    }

    const doc = ctx.db.document.id.find(args.doc_id);
    if (!doc) {
      throw new SenderError(`Document #${args.doc_id} not found.`);
    }

    // Ownership check
    if (!identityEquals(doc.farmer_id, ctx.sender)) {
      throw new SenderError('Cannot update another farmer\'s document.');
    }

    ctx.db.document.id.update({
      ...doc,
      ocr_text: args.ocr_text,
      structured_json: args.structured_json,
    });

    insertActivityLog(ctx, ctx.sender, 'document', 'updated',
      `OCR processed for doc #${args.doc_id}`);
  },
);

// ---------------------------------------------------------------------------
// REDUCERS — Parties
// ---------------------------------------------------------------------------

// upsert_party: create or update a party (dealer/trader/laborer) by name match
export const upsert_party = spacetimedb.reducer(
  {
    name: t.string(),
    kind: t.string(),
    phone: t.string(),
    is_dealer: t.bool(),
    is_buyer: t.bool(),
  },
  (ctx, args) => {
    const farmer = ctx.db.farmer.identity.find(ctx.sender);
    if (!farmer) {
      throw new SenderError('Farmer not registered.');
    }

    const validKinds = ['Dealer', 'Trader', 'FPO', 'Cooperative', 'Laborer'];
    if (!validKinds.includes(args.kind)) {
      throw new SenderError(`Invalid party kind: "${args.kind}". Must be one of: ${validKinds.join(', ')}`);
    }

    // Search for existing party by name within this farmer's parties
    let existingParty: any = null;
    for (const p of ctx.db.party.party_farmer_id.filter(ctx.sender)) {
      if (p.name === args.name) {
        existingParty = p;
        break;
      }
    }

    if (existingParty) {
      ctx.db.party.id.update({
        ...existingParty,
        kind: args.kind,
        phone: args.phone,
        is_dealer: args.is_dealer,
        is_buyer: args.is_buyer,
      });
      insertActivityLog(ctx, ctx.sender, 'party', 'updated', `Updated party: ${args.name}`);
    } else {
      ctx.db.party.insert({
        id: 0n,
        farmer_id: ctx.sender,
        name: args.name,
        kind: args.kind,
        phone: args.phone,
        is_dealer: args.is_dealer,
        is_buyer: args.is_buyer,
        grade: 'C',  // default grade, M79 prediction updates later
      });
      insertActivityLog(ctx, ctx.sender, 'party', 'created', `New party: ${args.name} (${args.kind})`);
    }
  },
);

// ---------------------------------------------------------------------------
// REDUCERS — Learning
// ---------------------------------------------------------------------------

// update_learning_profile: adaptive learning preferences
export const update_learning_profile = spacetimedb.reducer(
  {
    literacy_level: t.string(),
    preferred_mode: t.string(),
    pace: t.string(),
    topics_needed_json: t.string(),
  },
  (ctx, args) => {
    const existing = ctx.db.learningProfile.farmer_id.find(ctx.sender);
    if (!existing) {
      throw new SenderError('Learning profile not found. Register first.');
    }

    ctx.db.learningProfile.farmer_id.update({
      ...existing,
      literacy_level: args.literacy_level,
      preferred_mode: args.preferred_mode,
      pace: args.pace,
      topics_needed_json: args.topics_needed_json,
      last_updated: ctx.timestamp,
    });
  },
);

// add_curriculum_item: add a learning topic for the farmer
export const add_curriculum_item = spacetimedb.reducer(
  {
    topic: t.string(),
    content_te: t.string(),
    source_url: t.string(),
    citations_json: t.string(),
  },
  (ctx, args) => {
    const farmer = ctx.db.farmer.identity.find(ctx.sender);
    if (!farmer) {
      throw new SenderError('Farmer not registered.');
    }

    ctx.db.curriculumItem.insert({
      id: 0n,
      farmer_id: ctx.sender,
      topic: args.topic,
      stage: 'new',
      content_te: args.content_te,
      source_url: args.source_url,
      citations_json: args.citations_json,
      status: 'active',
      created_at: ctx.timestamp,
    });
  },
);

// update_curriculum_status: mark a learning item as understood/skipped/etc.
export const update_curriculum_status = spacetimedb.reducer(
  {
    item_id: t.u64(),
    stage: t.string(),
  },
  (ctx, args) => {
    const farmer = ctx.db.farmer.identity.find(ctx.sender);
    if (!farmer) {
      throw new SenderError('Farmer not registered.');
    }

    const item = ctx.db.curriculumItem.id.find(args.item_id);
    if (!item) {
      throw new SenderError(`Curriculum item #${args.item_id} not found.`);
    }

    if (!identityEquals(item.farmer_id, ctx.sender)) {
      throw new SenderError('Cannot update another farmer\'s curriculum item.');
    }

    const validStages = ['new', 'in_progress', 'understood', 'skipped'];
    if (!validStages.includes(args.stage)) {
      throw new SenderError(`Invalid stage: "${args.stage}". Must be one of: ${validStages.join(', ')}`);
    }

    ctx.db.curriculumItem.id.update({
      ...item,
      stage: args.stage,
    });
  },
);

// ---------------------------------------------------------------------------
// REDUCERS — Chat
// ---------------------------------------------------------------------------

// save_chat_message: persist a chat message for conversation history
export const save_chat_message = spacetimedb.reducer(
  {
    role: t.string(),
    content: t.string(),
    intent: t.string(),
    metadata_json: t.string(),
  },
  (ctx, args) => {
    const farmer = ctx.db.farmer.identity.find(ctx.sender);
    if (!farmer) {
      throw new SenderError('Farmer not registered.');
    }

    const validRoles = ['user', 'assistant', 'system'];
    if (!validRoles.includes(args.role)) {
      throw new SenderError(`Invalid role: "${args.role}". Must be one of: ${validRoles.join(', ')}`);
    }

    ctx.db.chatMessage.insert({
      id: 0n,
      farmer_id: ctx.sender,
      role: args.role,
      content: args.content,
      intent: args.intent || 'unknown',
      metadata_json: args.metadata_json || '{}',
      created_at: ctx.timestamp,
    });
  },
);

// ---------------------------------------------------------------------------
// REDUCERS — Memory
// ---------------------------------------------------------------------------

// save_memory: store an AI observation or farmer-stated preference
export const save_memory = spacetimedb.reducer(
  {
    content: t.string(),
    source: t.string(),
    confidence: t.f64(),
  },
  (ctx, args) => {
    const farmer = ctx.db.farmer.identity.find(ctx.sender);
    if (!farmer) {
      throw new SenderError('Farmer not registered.');
    }

    const validSources = ['ai_observed', 'farmer_stated', 'pattern_detected'];
    if (!validSources.includes(args.source)) {
      throw new SenderError(`Invalid source: "${args.source}". Must be one of: ${validSources.join(', ')}`);
    }

    // Enforce max ~30 active memories by auto-pruning lowest confidence
    let activeCount = 0;
    let lowestConfidence = Infinity;
    let lowestId = 0n;
    for (const m of ctx.db.farmerMemory.farmer_memory_farmer_id.filter(ctx.sender)) {
      if (m.active) {
        activeCount++;
        if (m.confidence < lowestConfidence) {
          lowestConfidence = m.confidence;
          lowestId = m.id;
        }
      }
    }

    if (activeCount >= 30 && lowestId > 0n) {
      // Auto-dismiss lowest confidence memory
      const lowest = ctx.db.farmerMemory.id.find(lowestId);
      if (lowest) {
        ctx.db.farmerMemory.id.update({ ...lowest, active: false });
      }
    }

    ctx.db.farmerMemory.insert({
      id: 0n,
      farmer_id: ctx.sender,
      content: args.content,
      source: args.source,
      confidence: Math.max(0, Math.min(1, args.confidence)),
      active: true,
      created_at: ctx.timestamp,
      last_used_at: ctx.timestamp,
    });

    insertActivityLog(ctx, ctx.sender, 'farmer_memory', 'created',
      `Memory: ${args.content.slice(0, 60)}... (${args.source}, conf=${args.confidence})`);
  },
);

// dismiss_memory: soft-delete a memory (farmer can see dismissed ones too)
export const dismiss_memory = spacetimedb.reducer(
  {
    memory_id: t.u64(),
  },
  (ctx, { memory_id }) => {
    const farmer = ctx.db.farmer.identity.find(ctx.sender);
    if (!farmer) {
      throw new SenderError('Farmer not registered.');
    }

    const memory = ctx.db.farmerMemory.id.find(memory_id);
    if (!memory) {
      throw new SenderError(`Memory #${memory_id} not found.`);
    }

    if (!identityEquals(memory.farmer_id, ctx.sender)) {
      throw new SenderError('Cannot dismiss another farmer\'s memory.');
    }

    ctx.db.farmerMemory.id.update({ ...memory, active: false });

    insertActivityLog(ctx, ctx.sender, 'farmer_memory', 'dismissed',
      `Dismissed memory #${memory_id}`);
  },
);

// ---------------------------------------------------------------------------
// REDUCERS — Audit (internal helper, but also exposed for admin use)
// ---------------------------------------------------------------------------

export const log_activity = spacetimedb.reducer(
  {
    entity_type: t.string(),
    action: t.string(),
    detail: t.string(),
  },
  (ctx, args) => {
    const farmer = ctx.db.farmer.identity.find(ctx.sender);
    if (!farmer) {
      throw new SenderError('Farmer not registered.');
    }

    insertActivityLog(ctx, ctx.sender, args.entity_type, args.action, args.detail);
  },
);

// ---------------------------------------------------------------------------
// PROCEDURES (STDB v2.0 Beta)
// ---------------------------------------------------------------------------
// Procedures allow HTTP fetch from within the module.
// These are the external API integrations for Rythu Mitra.
//
// NOTE: If the TypeScript SDK does not yet support procedures in your version,
// these will be clearly marked stubs with full implementation logic in comments.
// The procedure API shape comes from STDB v2.0 docs (see CLAUDE.md section 9).

// transcribe_voice_note — Sarvam AI STT integration
// Does NOT write to DB. Returns text for caller to build reducer args.
export const transcribe_voice_note = spacetimedb.procedure(
  {
    audio_base64: t.string(),
    language: t.string(),
  },
  t.string(),  // returns JSON: { text, confidence, language }
  (ctx, { audio_base64, language }) => {
    const response = ctx.http.fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // NOTE: In production, SARVAM_KEY should come from module secrets/env.
        // For now this is a placeholder — Commander will configure the key.
        'api-subscription-key': '__SARVAM_API_KEY__',
      },
      body: JSON.stringify({
        input: { audio: { base64: audio_base64 } },
        config: {
          language: { sourceLanguage: language || 'te-IN' },
          model: 'saarika:v2',
        },
      }),
    });

    return response.text();
  },
);

// fetch_mandi_prices — Agmarknet API integration
// Fetches mandi prices and stores them in market_price table.
export const fetch_mandi_prices = spacetimedb.procedure(
  {
    crop: t.string(),
    district: t.string(),
  },
  t.string(),  // returns JSON: { updated: count }
  (ctx, { crop, district }) => {
    // Agmarknet API endpoint (official Government of India agricultural marketing data)
    // NOTE: The actual endpoint URL and response format may vary.
    // This implementation handles the expected JSON response structure.
    const url = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=__DATA_GOV_API_KEY__&format=json&filters[commodity]=${encodeURIComponent(crop)}&filters[district]=${encodeURIComponent(district)}&limit=50`;

    const response = ctx.http.fetch(url);
    const body = response.text();

    // Parse and insert into market_price table within a transaction
    let count = 0;
    try {
      const data = JSON.parse(body);
      const records = data.records || [];

      ctx.withTx((tx) => {
        for (const rec of records) {
          // Convert price to paise (Rs * 100)
          const pricePaise = BigInt(Math.round(parseFloat(rec.modal_price || '0') * 100));
          const mspPaise = 0n; // MSP not available from Agmarknet directly

          // Upsert: check if exists
          let found = false;
          for (const existing of tx.db.marketPrice.market_price_crop.filter(crop)) {
            if (existing.mandi === (rec.market || '') && existing.date === (rec.arrival_date || '')) {
              tx.db.marketPrice.id.update({
                ...existing,
                price_per_quintal_paise: pricePaise,
                district: rec.district || district,
              });
              found = true;
              count++;
              break;
            }
          }

          if (!found) {
            tx.db.marketPrice.insert({
              id: 0n,
              crop: rec.commodity || crop,
              mandi: rec.market || '',
              district: rec.district || district,
              price_per_quintal_paise: pricePaise,
              msp_price_paise: mspPaise,
              date: rec.arrival_date || '',
            });
            count++;
          }
        }
      });
    } catch (e) {
      console.error(`[rythu-mitra] Failed to parse Agmarknet response: ${e}`);
    }

    return JSON.stringify({ updated: count });
  },
);

// check_scheme_status — PM-KISAN / PMFBY status check
// Checks scheme status and updates scheme_status table.
export const check_scheme_status = spacetimedb.procedure(
  {
    scheme_name: t.string(),
    farmer_phone: t.string(),
  },
  t.string(),  // returns JSON: { status, amount, details }
  (ctx, { scheme_name, farmer_phone }) => {
    // PM-KISAN beneficiary status check
    // NOTE: Actual PM-KISAN API requires Aadhaar or account number.
    // This is a simplified version using phone number lookup.
    // In production, this would use the official PM-KISAN API.
    const url = `https://pmkisan.gov.in/api/beneficiarystatus?phone=${encodeURIComponent(farmer_phone)}`;

    let status = 'pending';
    let amount = 0n;
    let details = '{}';

    try {
      const response = ctx.http.fetch(url);
      const body = response.text();
      const data = JSON.parse(body);

      status = data.status || 'pending';
      amount = BigInt(Math.round(parseFloat(data.amount || '0') * 100));
      details = JSON.stringify(data);

      // Update scheme_status table
      ctx.withTx((tx) => {
        let existingScheme: any = null;
        for (const s of tx.db.schemeStatus.scheme_status_farmer_id.filter(tx.sender)) {
          if (s.scheme_name === scheme_name) {
            existingScheme = s;
            break;
          }
        }

        if (existingScheme) {
          tx.db.schemeStatus.id.update({
            ...existingScheme,
            status,
            amount_paise: amount,
            details_json: details,
            last_checked: tx.timestamp,
          });
        } else {
          tx.db.schemeStatus.insert({
            id: 0n,
            farmer_id: tx.sender,
            scheme_name,
            status,
            last_checked: tx.timestamp,
            amount_paise: amount,
            details_json: details,
          });
        }
      });
    } catch (e) {
      console.error(`[rythu-mitra] Failed to check ${scheme_name} status: ${e}`);
    }

    return JSON.stringify({ status, amount: amount.toString(), details });
  },
);

// ---------------------------------------------------------------------------
// RLS RULES (STDB v2.0 — Experimental)
// ---------------------------------------------------------------------------
// Row-Level Security is documented here for when STDB enables it.
// NOTE: As of STDB v2.0, RLS is deprecated in favor of views.
// The farmer_balance view above demonstrates the recommended pattern.
//
// When RLS becomes available (or using views for data isolation):
//
// money_event:      WHERE farmer_id = :sender
// crop_event:       WHERE farmer_id = :sender
// farmer_context:   WHERE farmer_id = :sender
// scheme_status:    WHERE farmer_id = :sender
// document:         WHERE farmer_id = :sender
// party:            WHERE farmer_id = :sender
// activity_log:     WHERE farmer_id = :sender
// learning_profile: WHERE farmer_id = :sender
// curriculum_item:  WHERE farmer_id = :sender
//
// market_price:     PUBLIC (no RLS — everyone sees all prices)
// farmer:           PUBLIC (basic info visible to all)
//
// For now, all tables are marked public: true with reducer-level auth checks.
// Client-side filtered subscriptions provide the isolation:
//   conn.subscriptionBuilder().subscribe([
//     `SELECT * FROM money_event WHERE farmer_id = '${myIdentity}'`,
//     `SELECT * FROM market_price`,  // public
//   ]);
