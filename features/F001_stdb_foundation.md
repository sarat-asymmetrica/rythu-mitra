# F001 — STDB Schema + Module Foundation

**Status:** ✅ Live
**Wave:** 0 (Foundation)
**Owner:** Commander + Claude
**Created:** 2026-03-16

---

## 1. User Story

As **the Rythu Mitra system**, I need a **SpacetimeDB module with all core tables, reducers, and procedures**, so that **every feature in Wave 1+ has a correct, invariant-respecting data layer to build on**.

This is infrastructure, not a user-facing feature. But it's the truth layer — if this is wrong, everything built on top inherits the error.

---

## 2. Acceptance Criteria

- [ ] AC1: `spacetimedb publish` succeeds with zero errors
- [ ] AC2: 11 tables created matching the schema in CAPABILITY_REFERENCE.md §6.1
- [ ] AC3: All reducers type-check and enforce auth (caller identity required)
- [ ] AC4: `record_money_event` reducer enforces: paise-only, idempotency key, no stored balance
- [ ] AC5: `record_crop_event` reducer accepts optional photo bytes + GPS coordinates
- [ ] AC6: `update_market_prices` reducer accepts batch array (Williams-sized batches)
- [ ] AC7: RLS rules ensure farmer sees only their own rows (experimental flag OK)
- [ ] AC8: At least one View defined: `farmer_balance` (computed from money_events)
- [ ] AC9: Module compiles against STDB v2.0.x SDK
- [ ] AC10: All table names use snake_case with explicit `name` overrides

---

## 3. Full-Stack Contract

### 3a. Schema (STDB Module) — THIS IS THE FEATURE

**Tables (11):**

```
1. farmer
   - identity: Identity (STDB built-in, primary key)
   - name: string
   - phone: string
   - village: string
   - district: string
   - language: string (default: "te")
   - literacy_level: string (enum: "can_read" | "voice_only" | "literate")
   - created_at: Timestamp

2. farmer_context
   - farmer_id: Identity (FK → farmer)
   - crops: string[]           (e.g., ["groundnut", "cotton"])
   - acres: u32
   - plots: string[]           (plot names/IDs)
   - irrigation_type: string   (enum: "dryland" | "borewell" | "canal" | "drip")
   - season_stage: string      (enum: "pre_sowing" | "sowing" | "growing" | "harvest" | "post_harvest")
   - pain_points: string
   - raw_story_json: string    (onboarding conversation stored verbatim)

3. money_event
   - id: u64 (auto-increment)
   - farmer_id: Identity
   - kind: string              (enum: "CropSale" | "InputPurchase" | "LaborPayment" |
                                      "GovernmentTransfer" | "UPIPayment" | "Other")
   - amount_paise: u64         (₹1 = 100 paise, ALWAYS integer)
   - is_income: bool           (true = money in, false = money out)
   - category: string          (free text, AI-suggested)
   - description: string       (original Telugu transcription)
   - party_name: string        (dealer/trader/laborer name, optional)
   - season: string            (enum: "kharif_2026" | "rabi_2025" | etc.)
   - idempotency_key: string   (SHA256 hash, unique index)
   - created_at: Timestamp
   INDEX: btree on farmer_id, btree on idempotency_key (unique)

4. crop_event
   - id: u64
   - farmer_id: Identity
   - kind: string              (enum: "Planted" | "Sprayed" | "PestObserved" |
                                      "Irrigated" | "Harvested" | "Sold")
   - crop: string
   - plot_id: string
   - photo_bytes: bytes (optional)
   - ai_notes: string          (pest ID result, crop health assessment)
   - gps_lat: f64 (optional)
   - gps_lon: f64 (optional)
   - created_at: Timestamp
   INDEX: btree on farmer_id

5. market_price
   - id: u64
   - crop: string
   - mandi: string             (market name)
   - district: string
   - price_per_quintal_paise: u64
   - msp_price_paise: u64      (Minimum Support Price, 0 if N/A)
   - date: string              (YYYY-MM-DD)
   INDEX: btree on crop, btree on district

6. scheme_status
   - id: u64
   - farmer_id: Identity
   - scheme_name: string       ("PM-KISAN" | "PMFBY" | "YSR_Rythu_Bharosa" | etc.)
   - status: string            ("active" | "pending" | "received" | "rejected")
   - last_checked: Timestamp
   - amount_paise: u64
   - details_json: string

7. document
   - id: u64
   - farmer_id: Identity
   - kind: string              ("Bill" | "Receipt" | "CropPhoto" | "Report")
   - bytes: bytes
   - ocr_text: string
   - structured_json: string   (extracted fields: amount, date, product, etc.)
   - hot_cold_state: string    ("hot" | "cold")
   - created_at: Timestamp
   INDEX: btree on farmer_id

8. party
   - id: u64
   - farmer_id: Identity
   - name: string
   - kind: string              ("Dealer" | "Trader" | "FPO" | "Cooperative" | "Laborer")
   - phone: string (optional)
   - is_dealer: bool
   - is_buyer: bool
   - grade: string             ("A" | "B" | "C" | "D" — from M79 prediction)

9. activity_log
   - id: u64
   - farmer_id: Identity
   - entity_type: string       ("money_event" | "crop_event" | "document" | etc.)
   - action: string            ("created" | "updated" | "deleted")
   - detail: string
   - created_at: Timestamp

10. learning_profile
    - farmer_id: Identity (unique)
    - literacy_level: string
    - preferred_mode: string   ("voice" | "text" | "visual")
    - pace: string             ("slow" | "normal" | "fast")
    - topics_needed_json: string
    - last_updated: Timestamp

11. curriculum_item
    - id: u64
    - farmer_id: Identity
    - topic: string
    - stage: string            ("new" | "in_progress" | "understood" | "skipped")
    - content_te: string       (Telugu content)
    - source_url: string
    - citations_json: string
    - status: string
    - created_at: Timestamp
```

**Reducers:**

```
Auth:
  register_farmer(name, phone, village, district, language)
    → creates farmer + empty farmer_context + empty learning_profile
    → caller identity = farmer identity

Onboarding:
  update_farmer_context(crops, acres, irrigation_type, season_stage, ...)
    → requires caller === farmer_id

Money:
  record_money_event(kind, amount_paise, is_income, category, description,
                     party_name, season, idempotency_key)
    → requires caller identity
    → REJECTS if idempotency_key already exists (duplicate protection)
    → REJECTS if amount_paise == 0
    → auto-sets created_at from ctx.timestamp

  remove_money_event(event_id)
    → requires caller === event.farmer_id (own events only)
    → soft-delete via activity_log, or hard-delete (TBD)

Crops:
  record_crop_event(kind, crop, plot_id, photo_bytes?, ai_notes?, gps_lat?, gps_lon?)
    → requires caller identity

Market:
  update_market_prices(prices: {crop, mandi, district, price_paise, msp_paise, date}[])
    → batch insert/update (upsert on crop+mandi+date composite)
    → designed for Williams-batched external data

Schemes:
  update_scheme_status(scheme_name, status, amount_paise, details_json)
    → requires caller identity

Documents:
  store_document(kind, bytes)
    → requires caller identity
    → auto-sets hot_cold_state = "hot"

  update_document_ocr(doc_id, ocr_text, structured_json)
    → requires caller === document.farmer_id

Parties:
  upsert_party(name, kind, phone?, is_dealer, is_buyer)
    → creates or updates by name match within farmer's parties

Learning:
  update_learning_profile(literacy_level, preferred_mode, pace, topics_json)
  add_curriculum_item(topic, content_te, source_url, citations_json)
  update_curriculum_status(item_id, status)

Audit:
  log_activity(entity_type, action, detail)
    → called internally by other reducers (not directly by client)
```

**Views (STDB v2.0):**

```
farmer_balance (subscribable):
  SELECT
    farmer_id,
    SUM(CASE WHEN is_income THEN amount_paise ELSE 0 END) as total_income_paise,
    SUM(CASE WHEN NOT is_income THEN amount_paise ELSE 0 END) as total_expense_paise
  FROM money_event
  GROUP BY farmer_id

  → Client subscribes to this view for balance display
  → Balance is COMPUTED, never stored (Phase 18 invariant)
```

**RLS Rules (experimental):**

```sql
-- Farmer sees only their own money_events
SELECT * FROM money_event WHERE farmer_id = :sender

-- Farmer sees only their own crop_events
SELECT * FROM crop_event WHERE farmer_id = :sender

-- Market prices are public (no RLS)
-- All other per-farmer tables: WHERE farmer_id = :sender
```

**Procedures (STDB v2.0 — HTTP from server):**

```
fetch_mandi_prices(crop, district)
  → ctx.http.fetch(agmarknet API)
  → parse response
  → ctx.withTx() → batch insert into market_price
  → return { updated: count }

check_scheme_status(scheme_name, farmer_phone)
  → ctx.http.fetch(PM-KISAN API or scrape endpoint)
  → ctx.withTx() → update scheme_status
  → return { status, amount, details }

transcribe_voice_note(audio_base64, language)
  → ctx.http.fetch("https://api.sarvam.ai/speech-to-text",
      headers: { "api-subscription-key": SARVAM_KEY })
  → return { text, confidence, language }
  (NOTE: Does NOT write to DB — caller uses text to build reducer args)
```

### 3b. Client (Svelte + Tauri)

Not directly part of F001 — the module is standalone. But the client contract for connecting:

- SDK: `@clockworklabs/spacetimedb-sdk` (TypeScript)
- Connection: `DbConnection.builder().withUri(...)` pattern from 001-Ledger
- Store pattern: One Svelte writable store per subscribed table
- Token: localStorage for reconnect

### 3c. Design (Living Geometry / Matti)

N/A for F001 — this is pure backend.

### 3d. AI Integration

The `transcribe_voice_note` procedure calls Sarvam STT, but this is infrastructure. The AI interaction design lives in F004 (Voice → Expense Entry).

---

## 4. Dependencies

- **Requires:** Nothing (this is the root dependency)
- **Blocks:** F002, F004, F005, F006, F007, F008, F009, F010 (everything)

---

## 5. Architecture Notes

### Why STDB v2.0 Procedures instead of a separate API server

See [ADR001](../decisions/ADR001_procedures_vs_server.md).

Short version: Procedures collapse Sarvam API calls, Agmarknet fetches, and PM-KISAN checks INTO the STDB module. This eliminates an entire deployment target (no Express/Fastify/Hono server). The module IS the backend.

### Why TypeScript module (not Rust)

- STDB v2.0 Procedures are beta in TypeScript + Rust. TypeScript has faster iteration.
- 001-Ledger and 003-AsymmFlow are both TypeScript STDB modules — patterns transfer directly.
- The team (Commander + Claude) has more recent STDB TypeScript muscle memory.
- Can migrate to Rust later if performance requires it (schema is language-agnostic).

### Why 11 tables (not fewer)

The temptation is to combine (e.g., money_event + crop_event into one "event" table). We resist because:
- Different indexes needed (money needs idempotency_key, crops need GPS)
- Different RLS granularity possible in future
- Cleaner reducer signatures
- STDB subscriptions are per-table — finer subscription = less data over the wire

### Reuse from existing systems

- Schema structure: 003-AsymmFlow `MoneyEvent` pattern (kind discriminator, computed balance)
- Auth pattern: 001-Ledger identity-based auth
- Gotchas: `001-ledger/STDB_LEARNINGS.md` (all gotchas apply)
- Invariants: Phase 18 learnings from `ph-final`

---

## 6. Test Plan

- [ ] **Schema:** `spacetimedb publish` compiles without errors
- [ ] **Reducer - register_farmer:** Creates farmer + context + learning_profile atomically
- [ ] **Reducer - record_money_event:** Happy path stores correct paise amount
- [ ] **Reducer - record_money_event:** Duplicate idempotency_key rejected
- [ ] **Reducer - record_money_event:** Zero amount rejected
- [ ] **Reducer - remove_money_event:** Cannot remove another farmer's event
- [ ] **Reducer - update_market_prices:** Batch of 50 prices inserts correctly
- [ ] **View - farmer_balance:** Returns correct computed balance after 5 mixed events
- [ ] **RLS:** Farmer A cannot see Farmer B's money_events (when RLS enabled)
- [ ] **Procedure - transcribe_voice_note:** Returns text from Sarvam (live API test)
- [ ] **Procedure - fetch_mandi_prices:** Fetches and stores (mock or live Agmarknet)

---

## 7. Session Log

| Date | Session | What Happened | Next Step |
|------|---------|---------------|-----------|
| 2026-03-16 | Spec session | Created full contract with 11 tables, reducers, views, RLS, procedures | Build the module |
| 2026-03-16 | Build wave 0 | Agent built 1,186 LOC module. 11 tables, 15 reducers, 1 view, 3 procedures | Fix compilation |
| 2026-03-16 | Fix wave 0.1 | Fixed 3 issues: t.bytes→t.byteArray, null→undefined, view export. `spacetime build` CLEAN. `tsc --noEmit` CLEAN. | Publish to STDB cloud |
