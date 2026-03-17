# Rythu Mitra — Capability Reference for Subagents

**Purpose:** This document maps EVERY reusable capability across 6 existing systems to Rythu Mitra's needs. When building, **search here first** before writing new code.

**Last Updated:** 2026-03-15 (v2 — added STDB v2.0, BentoPDF, client compute, stdb-forge)
**Status:** Brainstorming/planning — no execution started yet

---

## Quick Orientation

**Rythu Mitra** is a vernacular-first, chat-native, AI-powered business management platform for Telugu-speaking farmers in AP/Telangana. The interface is conversation (voice + text in Telugu). The output is structured, persistent, trustworthy data on the farmer's device.

**The one-liner:** WhatsApp is for your life. This is for your livelihood.

**Target user:** Lakshmi, 38, Anantapur district, AP. Groundnut and cotton farmer, 4 acres dryland. ₹10-12K Redmi phone. Zero financial tracking today. All decisions from memory + scattered WhatsApp messages.

**Vision doc:** `C:\Projects\asymm-kit-factory\experiments\rythu_mitra\docs\asymmetrica-rythu-mitra-v0.1.md`

---

## Source Systems (6 Total)

| # | System | Location | Language | LOC | What It Provides |
|---|--------|----------|----------|-----|------------------|
| 1 | **001-Ledger** | `C:\Projects\asymm-kit-factory\experiments\001-ledger\` | TypeScript (STDB) + Svelte 5 | ~2,500 | STDB patterns, gotchas, identity auth, real-time stores |
| 2 | **003-AsymmFlow Reimagined** | `C:\Projects\asymm-kit-factory\experiments\003-asymmflow-reimagined\` | TypeScript (STDB) + Svelte 5 | ~7,230 | STDB ERP schema (16 tables, 28 reducers), computed balance, universal state machine |
| 3 | **software-math-empirical-testing** | `C:\Projects\asymmetrica-runtime\software-math-empirical-testing\` | Go | ~6,000 | 13 validated experiments: quaternion routing, Williams batching, three-regime health, Katapayadi encoding, Berry phase, vyapti invariants |
| 4 | **vedic_qiskit** | `C:\Projects\git_versions\asymm_all_math\vedic_qiskit\` | Go | ~5,500 | Trident optimizer (6 layers), Prism V2 prompt generation, SLERP conversation chains, codon encoding, 17 experiments, 79 tests |
| 5 | **asymmetrica-runtime** | `C:\Projects\asymmetrica-runtime\` | C# (.NET 10) | ~34,000 | 72+ kernels: ERP (14), OCR (8), Sarvam AI (7 modes), TallyBridge, WhatsApp, GeometricRetrieval, document composition, 1,298 tests |
| 6 | **ph-final (AsymmFlow V4)** | `C:\Projects\ph-final\ph_holdings\` | Go + Svelte + Wails | ~156,000 | Production ERP: M79 payment prediction, costing engine, bank recon, delivery notes, 17 database tables, Phase 18 lessons |
| 7 | **BentoPDF** | `C:\Projects\asymmetrica-runtime\bentopdf-main\` | TypeScript + WASM | ~15,000 | 100% client-side document processing: Tesseract.js OCR (100+ languages incl. Telugu), pdf-lib, Canvas image processing, Web Workers. Commercial license owned. |

---

## SECTION 1: STDB Patterns & Gotchas

**Source:** 001-Ledger + 003-AsymmFlow

### 1.1 Hard Gotchas (Must Know Before Writing STDB Code)

| Gotcha | Details | Fix |
|--------|---------|-----|
| **Identity comparison** | `===` always fails for STDB Identity objects | Use `String(a) === String(b)` everywhere |
| **Enum wire format** | CLI expects lowercase `{"equal": {}}`, SDK runtime uses PascalCase `{ tag: "Equal" }` | Serialization layer handles it, but know which context you're in |
| **No SQL ORDER BY/LIMIT/JOIN** | `spacetime sql` is limited | Sort/filter client-side in Svelte stores |
| **Version alignment** | CLI version must match SDK version exactly | Pin versions, run `spacetime version list` and `npm ls spacetimedb` to verify |
| **Error messages lost** | `throw new Error('msg')` → WASM panic → client sees generic "fatal error" | Log payload before reducer call; test via CLI for better errors |
| **`spacetime init` non-interactive** | Fails in piped/agent shells: "IO error: not a terminal" | Scaffold files manually |
| **Timestamps** | Server: `ctx.timestamp` (STDB Timestamp). Client: convert via `new Date(Number(row.timestamp.microsSinceUnixEpoch / 1000n))` | Always use server timestamp for consistency |

### 1.2 Schema Patterns to Reuse

**From 001-Ledger (`001-ledger/module/spacetimedb/src/index.ts`):**
- Tables with `public: true`, explicit btree indexes, snake_case `name` overrides
- Digital root helper: `digitalRoot(n) = 1 + ((n-1) % 9)` — flags interesting amounts
- Balance = computed from immutable transaction log, NEVER stored as writable field

**From 003-AsymmFlow (`003-asymmflow-reimagined/module/src/index.ts`):**
- 16 tables, 28 reducers — full ERP on STDB
- `EntityStatus` enum: Draft, Active, InProgress, Terminal, Cancelled (universal state machine)
- `MoneyEvent` table: one table with `kind` discriminator (CustomerInvoice, CustomerPayment, SupplierInvoice, SupplierPayment)
- `Party` unification: one entity with `isCustomer` + `isSupplier` booleans
- `outstanding = sum(invoices) - sum(payments)` — COMPUTED, never stored (Phase 18 fix)
- `AiAction` table: proposed → approved → executed flow with audit trail
- RBAC via `requireRole(caller, ...roles)` in every reducer
- `doc_sequence` table for sequential document numbering per type/year
- All money in integer units (fils for BHD, use paise for INR)

**Key file references:**
- STDB rules & hard requirements: `001-ledger/module/CLAUDE.md`
- Gotchas & patterns: `001-ledger/STDB_LEARNINGS.md`
- Full ERP schema: `003-asymmflow-reimagined/module/src/index.ts`
- Reducer implementations: `003-asymmflow-reimagined/module/src/milestone1_logic.ts`
- Architecture SSOT: `003-asymmflow-reimagined/ARCHITECTURE.md`

### 1.3 Frontend Patterns (Svelte 5)

**Connection pattern (`001-ledger/client/src/lib/db.ts`):**
```
connect() → store token in localStorage → register callbacks BEFORE subscribe → subscribe to tables
```

**Store pattern:**
- One writable Svelte store per STDB table
- Derived stores for computed values (e.g., `nicknameMap`, `currentMember`)
- `onInsert`/`onDelete` callbacks → `syncTable()` helper that iterates and updates store
- Chat context builder: inject live store data into AI system prompts

**Design system:**
- Living Geometry tokens: `--space-*` (Fibonacci-based), `--font-serif/sans/mono`, `--ink`, `--paper`, `--gold`
- Wabi-sabi aesthetic for 003; adapt to warm earth tones for Rythu Mitra

---

## SECTION 2: Mathematical Substrate

**Source:** software-math-empirical-testing + vedic_qiskit

### 2.1 Digital Root System (O(1) Pre-Filter)

**Formula:** `dr(n) = 1 + ((n-1) % 9)` for n > 0

**Properties:**
- Homomorphic: `dr(a+b) = dr(dr(a)+dr(b))`
- Composable: cache DRs, chain without re-scanning (Exp 12)
- Elimination rate: 88.9% of candidates filtered with single DR check

**Use in Rythu Mitra:**
- Classify voice note intent: DR {1,4,7}→Exploration, {2,5,8}→Optimization, {3,6,9}→Stabilization
- Pre-filter mandi price searches
- Flag interesting expense amounts (round + DR9)

**Implementation:**
- Go: `vedic_qiskit/pkg/vedic/digital_root.go` (275 LOC)
- C#: Used in SearchIndex.cs and GeometricRetrieval kernel (asymmetrica-runtime)

### 2.2 Three-Regime Dynamics

**Universal pattern (30/20/50):**
- R1 (30%) Exploration: High variance, divergent, creative — temperature 0.8
- R2 (20%) Optimization: Gradient descent, precision — temperature 0.1
- R3 (50%) Stabilization: Convergence, factual retrieval — temperature 0.3

**Proven boundaries (Lean-verified):**
- R1 ≥ 25% (else local minima trap)
- R2 ≥ 15% (else convergence fails)
- R3 ≥ 45% (else singularity risk)

**Use in Rythu Mitra:**
- Route Lakshmi's queries: Dabbu=R2, Market=R3, Sarkar=R3, Panta=R1+R3
- Model selection: R1→sarvam-m, R2→gemma-12b, R3→gemma-4b
- Token budgeting: allocate based on regime (creative needs more tokens than factual)
- Health monitoring: detect if farmer usage drifts outside stable boundaries

**Implementation:**
- Go: `vedic_qiskit/cmd/sarvam_harness/optimizer.go` (700+ LOC)
- Go: `software-math-empirical-testing/exp05_regime_health/` (health monitor + 15 scenarios)
- Lean proofs: `ThreeRegimeDerivation.lean`, `BoundaryConditions.lean`

### 2.3 SLERP Conversation Chains (State on S³)

**What it does:** Each message → quaternion waypoint. Conversation state = SLERP trajectory on unit 3-sphere. Guaranteed safe (||q|| = 1 always).

**Measures:**
- Coherence (how focused the conversation is, 0.0-1.0)
- Momentum (geodesic distance between consecutive messages)
- Regime drift (detects R1→R2→R3 shifts)

**Use in Rythu Mitra:**
- Track multi-turn conversations in each domain chat
- Detect when Lakshmi switches topics → adapt response style
- High coherence (0.8+) = she's doing sequential expense entries → be terse
- Low coherence (0.4-) = she's exploring → be more helpful

**Implementation:**
- Go: `vedic_qiskit/cmd/sarvam_harness/conversation.go` (238 LOC)
- Lean proof: `slerp_unit_of_unit_full` (SLERP preserves unit norm)

### 2.4 Williams Batching

**Formula:** `batch_size = √n × log₂(n)`

**Savings:** n=1,500 (mandi prices) → batch=424 → 72% memory reduction

**Use in Rythu Mitra:**
- Batch mandi price updates (100+ mandis × crops)
- Batch scheme eligibility checks
- Any bulk data processing on low-memory phones

**Implementation:**
- Go: `vedic_qiskit/pkg/vedic/williams.go` (295 LOC)
- Go: `software-math-empirical-testing/exp02_williams_search/`
- Lean proof: `WilliamsBatching.lean`

### 2.5 Trident Optimization Pipeline (6 Layers)

**Full pipeline applied to every Sarvam API call:**

```
L1: Digital Root Signature → O(1) regime hint
L2: Three-Regime Detection → model + token selection
L3: Williams Context Chunking → memory-efficient processing
L4: SLERP Geodesic Navigation → conversation awareness
L5: Oil-Water + Shunyam Contrast → prompt quality/density check
L6: Pi Emergence Predictor → convergence confidence (4 conditions)
```

**Results:** 54.1% token savings, 37.5% latency savings, 0.87/1.00 quality

**Why it matters for Rythu Mitra:** Every skipped/cheaper API call = better UX on 3G, lower cost per farmer, more sustainable unit economics.

**Implementation:**
- Go: `vedic_qiskit/cmd/sarvam_harness/optimizer.go`
- Go: `vedic_qiskit/cmd/sarvam_harness/prism.go` (463 LOC, Prism V2 prompt generation)

### 2.6 Prism V2 (Auto-Generated System Prompts)

**What it does:** Instead of manually writing system prompts, Prism V2 generates them from mathematical analysis of the query.

**6 layers:**
1. Persona Identity (Regime × Contrast → 9 archetypes)
2. Regime Tuning (frequency/depth instructions)
3. Emotional Harmonic (NavaYoni DR color)
4. Convergence Confidence (Pi Emergence conditions)
5. Signal Resonance (3-signal agreement: resonant/harmonic/dissonant)
6. Conversation-Aware Evolution (coherence + momentum + drift)

**Governor Principle:** Nudge, don't override. "You are a creative mind..." not "You must respond with maximal rigor."

**Implementation:** `vedic_qiskit/cmd/sarvam_harness/prism.go`

### 2.7 Vyāpti Invariant Alerting (0 False Positives)

**What it does:** Invariant checks with defeating conditions (upādhi). Unlike threshold-based alerts, vyāpti alerts enumerate WHY something should be flagged, and check whether any defeating condition applies before alerting.

**Use in Rythu Mitra:**
- MRP overcharge detection: "Dealer charging ₹320, MRP ₹290" → check upādhi: bulk discount? different packaging? promotional pricing? → only alert if no defeating condition applies
- Result: Lakshmi trusts the alert because it's NEVER wrong

**Implementation:**
- Go: `software-math-empirical-testing/exp09_vyapti_invariant/` (0 false positives validated)

### 2.8 Codon Encoding (1.07 Billion ops/sec)

**What it does:** Lossless byte → base-4 → quaternion roundtrip. Every byte maps to a unique quaternion on S³.

**Use in Rythu Mitra:**
- Character-level similarity between voice note transcriptions
- "kooliga vaallu 400" vs "kooliga vaallu 350" → small geodesic distance → auto-suggest same category

**Implementation:** `vedic_qiskit/cmd/sarvam_harness/encoding.go` (175 LOC)

### 2.9 Pi Emergence Convergence Detector

**4 conditions → optimization will converge to 2π² = 19.739:**
1. Restoring force (query has clear attractor)
2. Proportional (response scales with complexity)
3. Single DOF (focused problem domain)
4. Energy conserved (no divergence)

**Use in Rythu Mitra:**
- Predict when Learn Mode content will converge to understanding
- If not converging → slow down, simplify, repeat

**Implementation:**
- Go: `software-math-empirical-testing/exp03_pi_convergence/`
- Lean proof: `PiEmergence.lean`

---

## SECTION 3: Asymmetrica Runtime Kernels

**Source:** `C:\Projects\asymmetrica-runtime\`
**Stack:** .NET 10, deployed on Sliplane behind Cloudflare
**Tests:** 1,298+ passing
**API:** `runtime.asymmetrica.ai`

### 3.1 Kernels Directly Relevant to Rythu Mitra

#### SarvamIntelligence (7 Modes) — THE AI INTERFACE

| Mode | What It Does | Rythu Mitra Use |
|------|-------------|-----------------|
| `stt` | Telugu speech → text (Saaras V3) | Voice note transcription |
| `chat` | Telugu conversational AI (sarvam-m 24B) | Domain chat responses |
| `vision` | Image understanding | Pest identification from crop photos |
| `tts` | Text → Telugu speech (Bulbul) | Read back confirmations for low-literacy users |
| `translate` | Cross-language (Mayura) | English advisories → Telugu |
| `transliterate` | Script conversion | Telugu ↔ Latin script |
| `detect` | Language detection | Auto-detect input language |

**API config:**
- Base URL: `https://api.sarvam.ai`
- Auth header: `api-subscription-key` (NOT `Authorization: Bearer`)
- Models: `sarvam-m` (24B, FREE), `gemma-4b`, `gemma-12b` (need beta)
- 23 Indian languages supported including Telugu

#### OCR Pipeline (8 Kernels) — DOCUMENT UNDERSTANDING

**Full pipeline:**
```
FileToOcr (upload, 50MB max)
  → NormalizerKernel (noise cleaning)
  → VedicValidatorKernel (digit/currency validation via DR patterns)
  → HybridOcrKernel (local + cloud fallback)
  → structured_json output
```

**Use:** Lakshmi photographs a dealer bill → OCR extracts: product name, quantity, price, date → cross-reference MRP → flag overcharge

#### InvoiceKernel — FINANCIAL TRANSACTIONS

| Mode | What It Does |
|------|-------------|
| `create` | Create invoice with line items, GST/VAT |
| `compute_tax` | Calculate CGST/SGST/IGST or VAT |
| `aging` | AR aging buckets (Current/1-30/31-60/61-90/90+) |
| `cancel` | Cancel with audit trail |

**Invariants:** Decimal arithmetic (no floats), HMAC-SHA256 integrity, HSN/SAC rate tables

#### PaymentKernel — PAYMENT TRACKING

| Mode | What It Does |
|------|-------------|
| `record` | Record payment with idempotency key |
| `reconcile` | Match payment to invoice |
| `aging` | AR/AP aging analysis |

**Safety:** SemaphoreSlim locks for concurrent safety, duplicate detection, bank_transfer references

#### LedgerKernel — DOUBLE-ENTRY BOOKKEEPING

| Mode | What It Does |
|------|-------------|
| `post_invoice` | Auto-generate GL entries from invoice |
| `post_payment` | Auto-generate GL entries from payment |
| `trial_balance` | Debit/Credit verification (±0.005 tolerance) |
| `chart_of_accounts` | Indian CoA (40 accounts) |

#### BankReconKernel — UPI/BANK MATCHING

| Mode | What It Does |
|------|-------------|
| `import_statement` | Parse CSV bank statements |
| `match` | 3-day date tolerance, ₹1.00 amount tolerance, O(n) matching |
| `cash_position` | Current cash position summary |

**Use:** Parse UPI notifications, auto-categorize income/expenses

#### WhatsAppKernel — DIRECT FARMER COMMUNICATION

| Mode | What It Does |
|------|-------------|
| `send_text` | Send text message |
| `send_template` | Send pre-approved template |
| `send_media` | Send image/document |
| `send_interactive` | Buttons/lists for quick replies |
| `bulk_send` | Batch messaging |

**Use:** Send mandi price alerts, payment confirmations, scheme notifications

#### GeometricRetrieval — SMART SEARCH

**Algorithm:** φ-weighted quaternion semantic search on S³ + golden angle sphere coverage + DR pre-filter (88.9% reduction) + SLERP geodesics

**Use:** Search across Lakshmi's crop events, expenses, documents by meaning, not just keywords

#### DocxComposer / PandocKernel / TypstKernel — REPORTS

**Use:** Generate season summary PDFs, expense reports, loan support documents in Telugu

#### InventoryKernel — STOCK MANAGEMENT

| Mode | What It Does |
|------|-------------|
| `add` / `adjust` | Track seed, fertilizer, equipment stock |
| `valuation` | FIFO/LIFO/WAP costing |
| `transfer` | Multi-location (multi-field) transfers |
| `stock_take` | Physical count reconciliation |

#### Calendar Kernel — AGRICULTURAL CALENDAR

- India working days (national + regional holidays)
- Seasonal event scheduling (planting, harvest windows)
- Reminder system for input application dates

### 3.2 Kernel Execution Pattern

All kernels follow the same interface:
```
KernelEngine.RunKernelAsync(kernelName, { mode, ...args })
  → 60-second timeout
  → Result: { Success, Delta (graph changes), Outputs, ErrorMessage }
  → Delta applied to GraphStore (audit trail)
```

### 3.3 GraphStore (Persistence Layer)

- In-memory graph DB with append-only ledger + snapshots
- Nodes with Tags and Fields (key-value)
- Edges with relationship metadata
- UpsertMode for production hardening
- Persistence: `/data/state/` (ledger + snapshots)

---

## SECTION 4: PH-Final ERP Business Logic

**Source:** `C:\Projects\ph-final\ph_holdings\`
**Stack:** Go + Svelte + Wails (desktop), SQLite
**Domain:** Process instrumentation trading, Bahrain (BHD currency, 10% VAT)

### 4.1 Business Logic Patterns to Reuse

#### M⁷⁹ Payment Prediction (`predictor.go`, 330 LOC)

**Algorithm:**
1. Encode entity to 79-dimensional state vector
2. Calculate three-regime distribution (R1 risky / R2 moderate / R3 stable)
3. Compute stability score: `relationScore*3 - paymentScore*2 - riskScore*2 + 0.5`
4. Assign grade: A (>0.2), B (-0.5 to 0.2), C (-1.05 to -0.5), D (<-1.05)

**Farmer adaptation:**
- Encode: payment history, land area, crop type, weather risk, market volatility
- Grade A: reliable, full credit → seeds on credit, pay after harvest
- Grade D: risky → advance payment required for inputs

#### Costing Engine (`costing_engine.go`, 650+ LOC)

**Pattern:** Input cost buildup → margin → selling price → risk check

**Farmer adaptation:**
- Input costs: seeds + fertilizer + pesticide + labor + equipment rental + water/irrigation
- Margin: expected profit per quintal
- Selling price: mandi MSP or negotiated
- Risk check: weather forecast + historical yield + market trends

#### Bank Statement Parsing (`bank_statement_parser.go`, 650+ LOC)

**Pattern:** CSV import → field mapping → amount parsing → categorization

**Farmer adaptation:** UPI notification text → parse → categorize (government subsidy, crop sale, input purchase, labor payment)

#### Three-Way Matching

**Pattern:** PO ↔ GRN ↔ Invoice (what was ordered vs what arrived vs what was billed)

**Farmer adaptation:** Seed order ↔ Delivery receipt ↔ Dealer bill (did the right quantity arrive at the right price?)

### 4.2 The Phase 18 Lesson (CRITICAL — Read This)

**The bug:** Outstanding balance (`outstanding_bhd`) was a stored field updated incrementally:
```
outstanding = outstanding - payment_amount
```
Over time, accumulated errors from data imports, duplicate payments, and manual adjustments caused 313 invoices to show wrong AR balances.

**The fix (003-AsymmFlow pattern):**
```
outstanding = sum(all invoices for party) - sum(all payments for party)
```
Always computed fresh. Never stored. Mathematically impossible to drift.

**Specific code fixes to carry forward:**
- Floor outstanding at zero: `if newOutstanding < 0 { newOutstanding = 0 }`
- Prevent overpayment: `if amount > outstanding { return error }`
- Transaction locking: `SELECT FOR UPDATE` (or equivalent)
- Idempotency key: `SHA256(entityID|amount|date|reference)` prevents duplicate payments

### 4.3 Domain Entity Mapping (PH Trading → Farmer)

| PH Trading Entity | Farmer Entity | Same Schema? |
|---|---|---|
| CustomerMaster | BuyerMaster (mandi trader, FPO, cooperative) | Adapt |
| SupplierMaster | DealerMaster (seed dealer, fertilizer shop) | Adapt |
| Invoice | CropSaleRecord | Adapt |
| Payment | BuyerPayment / SubsidyCredit | Adapt |
| PurchaseOrder | InputOrder (seeds, fertilizer) | Adapt |
| DeliveryNote | HarvestPickupNote | Adapt |
| BankStatement | UPIStatement | Adapt |
| Order | SeasonPlan (crop + field + expected yield) | New concept |
| Product | CropType / InputType | Adapt |

---

## SECTION 5: Sarvam AI Integration Details

**Shared across vedic_qiskit + asymmetrica-runtime**

### 5.1 API Endpoints

```
Base URL: https://api.sarvam.ai
Auth Header: api-subscription-key (NOT Authorization: Bearer)

POST /v1/chat/completions    — Chat completion
POST /translate              — Translation (Mayura model)
POST /speech-to-text         — STT (Saaras V3)
POST /text-to-speech         — TTS (Bulbul)
```

### 5.2 Models & Routing

| Model | Size | Cost | Best For | Regime |
|-------|------|------|----------|--------|
| `sarvam-m` | 24B | FREE | General chat, creative | R1 Exploration |
| `gemma-12b` | 12B | Beta | Precision, analytical | R2 Optimization |
| `gemma-4b` | 4B | Beta | Factual retrieval, cheap | R3 Stabilization |
| `mayura:v2` | — | — | Translation | — |

### 5.3 Telugu Language Support

- Native Telugu STT (Saaras V3)
- Telugu chat completion (sarvam-m)
- English → Telugu translation (Mayura)
- **UNKNOWN:** Accuracy on agricultural dialect (Rayalaseema vs coastal AP vs Telangana). Testing needed.

### 5.4 .env Configuration

```bash
SARVAM_API_KEY=sk_ro2wts6u_...   # gitignored
SARVAM_BASE_URL=https://api.sarvam.ai
```

**Gotcha:** Model name is `sarvam-m` not `sarvam-2b-v0.5`. Gemma models may return 400 "not available" — client must have fallback to sarvam-m.

---

## SECTION 6: Proposed Rythu Mitra Schema

**Based on patterns from 001-Ledger + 003-AsymmFlow + ph-final:**

### 6.1 Tables (First Pass)

```
1. farmer              — identity (STDB), name, phone, village, district,
                         language, literacy_level, created_at

2. farmer_context      — farmer_id, crops[], acres, plots[],
                         irrigation_type, season_stage,
                         pain_points, raw_story_json

3. money_event         — id, farmer_id, kind (CropSale | InputPurchase |
                         LaborPayment | GovernmentTransfer | UPIPayment),
                         amount_paise (u64), category, description,
                         party_name, season, created_at
                         (NEVER store running balance — compute it!)

4. crop_event          — id, farmer_id, kind (Planted | Sprayed | Pest |
                         Irrigated | Harvested | Sold), crop, plot_id,
                         photo_bytes, ai_notes, gps_lat, gps_lon,
                         created_at

5. market_price        — id, crop, mandi, district, price_per_quintal (u64),
                         msp_price, date

6. scheme_status       — id, farmer_id, scheme_name, status, last_checked,
                         amount_paise, details_json

7. document            — id, farmer_id, kind (Bill | Receipt | Photo | Report),
                         bytes, ocr_text, structured_json,
                         hot_cold_state, created_at

8. party               — id, farmer_id, name, kind (Dealer | Trader | FPO |
                         Cooperative | Laborer), phone, is_dealer,
                         is_buyer, grade (A/B/C/D)

9. activity_log        — id, farmer_id, entity_type, action, detail,
                         created_at

10. learning_profile   — farmer_id, literacy_level, preferred_mode,
                         pace, topics_needed_json, last_updated

11. curriculum_item    — id, farmer_id, topic, stage, content_te,
                         source_url, citations_json, status, created_at
```

### 6.2 Key Design Decisions

- **All money in paise** (u64): ₹1 = 100 paise. Integer math only. No floats ever.
- **Balance = computed**: `sum(income money_events) - sum(expense money_events)`. Always.
- **Identity-based auth**: Phone OTP → STDB identity. No password system.
- **Enums for everything**: CropType, Season (Kharif/Rabi/Zaid), MoneyEventKind, CropEventKind
- **Hot→cold documents**: After N days, mark old docs as `cold`, drop image cache on device
- **Offline-first**: All core data on device. Sync when connectivity available.

### 6.3 Reducers (First Pass)

```
Auth:
  - register_farmer(name, phone, village, district, language)

Onboarding:
  - update_farmer_context(crops, acres, irrigation, ...)

Money:
  - record_money_event(kind, amount_paise, category, description, party_name)
  - remove_money_event(event_id)  // only own events

Crops:
  - record_crop_event(kind, crop, plot_id, photo_bytes, ai_notes)

Market:
  - update_market_prices(prices[])  // batch update from Agmarknet

Schemes:
  - update_scheme_status(scheme_name, status, amount, details)

Documents:
  - store_document(kind, bytes, farmer_id)
  - update_document_ocr(doc_id, ocr_text, structured_json)

Learning:
  - update_learning_profile(literacy_level, pace, topics)
  - add_curriculum_item(topic, content_te, source_url)

Audit:
  - log_activity(entity_type, action, detail)
```

---

## SECTION 7: Domain Chat → Kernel Routing

| Domain Chat | Primary Action | Kernel Chain |
|---|---|---|
| **Panta** (Crop) | Voice/photo → crop event | SarvamIntelligence(stt) → Trident → record_crop_event. Photo: FileToOcr → SarvamIntelligence(vision) |
| **Dabbu** (Money) | Voice → expense/income entry | SarvamIntelligence(stt) → Trident(R2) → extract intent → record_money_event. UPI: BankReconKernel(parse) |
| **Market** (Mandi) | Price lookup | WebSearch(Agmarknet) → DataTransform → GeometricRetrieval(filter by crop+district) → cached in market_price table |
| **Sarkar** (Govt) | Scheme status check | WebSearch(PM-KISAN endpoint) → SarvamIntelligence(translate to Telugu) → update_scheme_status |
| **People** (P2P) | Messaging with dealers/traders | WhatsAppKernel or STDB WebSocket P2P. Context: Party table enriches conversation |

---

## SECTION 8: Critical Invariants

These rules must NEVER be violated, derived from Phase 18 and production experience:

1. **Outstanding balance is NEVER stored** — always computed from money_events
2. **All money is integer paise (u64)** — no floating point, no decimal
3. **Floor balance at zero** — `max(0, income - expenses)`
4. **Idempotency on payments** — `SHA256(farmer_id|amount|date|reference)` prevents duplicates
5. **Transaction locking on financial writes** — no TOCTOU races
6. **Identity === via String()** — never use `===` on STDB Identity objects
7. **Enum wire format awareness** — CLI lowercase, SDK PascalCase
8. **Version alignment** — STDB CLI version must match SDK version exactly
9. **Vyāpti before alerting** — always check defeating conditions before showing overcharge alerts
10. **SLERP stays on S³** — conversation state ||q|| = 1.0, guaranteed by construction

---

## SECTION 9: What's Genuinely NEW (Not Reusable)

| New Work | Why | Est. Complexity |
|---|---|---|
| Telugu agricultural STT accuracy testing | Dialect-specific, no existing data | Medium |
| Domain chat router (Panta/Dabbu/Market/Sarkar) | New UX concept, glue code | Small |
| Agmarknet API connector | Government-specific, may need scraping | Medium |
| PM-KISAN status API connector | Government-specific | Medium |
| IMD Weather API connector | New integration | Small |
| Tauri v2 mobile shell (Android APK < 15MB) | New deployment target | Medium |
| Farmer-specific STDB schema | Adapt from 003, not copy | Small |
| Onboarding conversation flow | New UX, uses existing SLERP + Sarvam | Small |
| Rural UX design tokens | Adapt Living Geometry for earth tones | Small |
| Telugu content for Learn Mode | New content, uses existing pipeline | Medium |

**Estimated total new code: ~2,000-3,000 lines of glue. Everything else exists.**

---

## SECTION 10: File Path Quick Reference

### STDB Patterns
- `C:\Projects\asymm-kit-factory\experiments\001-ledger\module\CLAUDE.md` — STDB rules
- `C:\Projects\asymm-kit-factory\experiments\001-ledger\STDB_LEARNINGS.md` — Gotchas
- `C:\Projects\asymm-kit-factory\experiments\003-asymmflow-reimagined\module\src\index.ts` — Full ERP schema
- `C:\Projects\asymm-kit-factory\experiments\003-asymmflow-reimagined\ARCHITECTURE.md` — Architecture SSOT

### Math Substrate
- `C:\Projects\asymmetrica-runtime\software-math-empirical-testing\` — 13 experiments
- `C:\Projects\git_versions\asymm_all_math\vedic_qiskit\pkg\vedic\digital_root.go` — DR implementation
- `C:\Projects\git_versions\asymm_all_math\vedic_qiskit\pkg\vedic\williams.go` — Williams batching
- `C:\Projects\git_versions\asymm_all_math\vedic_qiskit\cmd\sarvam_harness\optimizer.go` — Trident
- `C:\Projects\git_versions\asymm_all_math\vedic_qiskit\cmd\sarvam_harness\prism.go` — Prism V2
- `C:\Projects\git_versions\asymm_all_math\vedic_qiskit\cmd\sarvam_harness\conversation.go` — SLERP chains

### Runtime Kernels
- `C:\Projects\asymmetrica-runtime\CLAUDE.md` — Runtime project rules
- `C:\Projects\asymmetrica-runtime\Asymmetrica.Runtime\Asymmetrica.Kernels\` — All 72+ kernels
- SarvamIntelligence, OCR pipeline, WhatsApp, GeometricRetrieval, Invoice, Payment, Ledger, BankRecon, Inventory, DocxComposer, Calendar kernels all live here

### ERP Business Logic
- `C:\Projects\ph-final\ph_holdings\predictor.go` — M⁷⁹ payment prediction (330 LOC)
- `C:\Projects\ph-final\ph_holdings\costing_engine.go` — Cost buildup (650+ LOC)
- `C:\Projects\ph-final\ph_holdings\payment_service.go` — Payment validation + locking (650 LOC)
- `C:\Projects\ph-final\ph_holdings\bank_statement_parser.go` — CSV import (650+ LOC)
- `C:\Projects\ph-final\ph_holdings\bank_transaction_matcher.go` — Fuzzy matching (650+ LOC)
- `C:\Projects\ph-final\ph_holdings\business_invariants.go` — Grade A/B/C/D rules (800+ LOC)
- `C:\Projects\ph-final\ph_holdings\database.go` — Full schema (1,937 LOC)

### Vision & Planning
- `C:\Projects\asymm-kit-factory\experiments\rythu_mitra\docs\asymmetrica-rythu-mitra-v0.1.md` — Full vision doc

---

---

## SECTION 11: STDB v2.0 Capabilities (Updated March 2026)

**Current version:** v2.0.5 (released 2026-03-13)
**Key finding:** STDB v2.0 is far more capable than v1. Three game-changers for Rythu Mitra.

### 11.1 SpacetimeAuth (First-Party Auth)

STDB now has a **first-party OIDC authentication provider** built by ClockworkLabs.

**Supported methods:** Magic link, GitHub, Google, Discord, Twitch, Kick
**Features:** User/role management, customizable login pages, project-based isolation
**Status:** Beta

**Impact on Rythu Mitra:** We do NOT need to build our own auth component. SpacetimeAuth handles identity. For farmers, Magic Link (phone OTP equivalent) is the path. No passwords.

**Docs:** `https://spacetimedb.com/docs/spacetimeauth/`

### 11.2 Procedures (HTTP Calls from STDB!)

**THIS IS MASSIVE.** Procedures are like reducers but CAN make HTTP requests to external services.

**Key differences from reducers:**
- Can call `ctx.http.fetch()` (TypeScript) or `ctx.http.get()`/`ctx.http.send()` (Rust)
- Must manually manage transactions via `ctx.withTx()`
- Cannot hold a transaction open while making HTTP requests
- Return values sent only to caller (not broadcast like reducer side-effects)
- Timeout: 30s request / 180s total (bumped in v2.0.5)
- Status: Beta (TypeScript + Rust supported, C# coming)

**Impact on Rythu Mitra:** Procedures collapse most "Zone 3 server" work into STDB itself:

```typescript
@procedure("fetch_mandi_prices")
async function fetchMandiPrices(ctx: ProcedureCtx, crop: string, district: string) {
    const response = await ctx.http.fetch(`https://agmarknet.gov.in/api/...`);
    const prices = JSON.parse(response.body);
    await ctx.withTx((tx) => {
        for (const p of prices) {
            tx.db.marketPrice.insert({ crop: p.commodity, mandi: p.market, ... });
        }
    });
    return { updated: prices.length };
}
```

**What procedures replace (no separate server needed):**
- Sarvam STT/Chat/Vision/Translate/TTS API calls
- Agmarknet mandi price fetching
- PM-KISAN status checking
- IMD weather data fetching
- WhatsApp message sending (Meta API)

**What still needs a separate server:**
- Heavy ML inference (PlantCV) — timeout limits
- Multi-stage OCR pipeline — compute-heavy (BUT see Section 12: BentoPDF makes this client-side!)
- PDF generation from templates — binary output

**Docs:** `https://spacetimedb.com/docs/procedures`

### 11.3 Row-Level Security (RLS)

SQL-based per-identity row filtering. Server-side enforcement.

**How it works:**
- Rules declared as SQL filters with `:sender` bound to caller's Identity
- Multiple rules per table = logical OR (client sees rows matching ANY rule)
- Recursive: rules can reference other RLS-protected tables
- Module owners bypass all RLS (for admin access)

**Impact on Rythu Mitra:** Lakshmi sees ONLY her rows. No client-side filtering needed.
```sql
-- Example: farmer can only see their own money_events
SELECT * FROM money_event WHERE farmer_id = :sender
```

**Status:** Experimental (requires feature flag)
**Docs:** `https://spacetimedb.com/docs/rls`

### 11.4 Views (Subscribable Computed Queries)

Read-only computed queries that clients can SUBSCRIBE to like tables.

**Impact:** Balance computation, aggregations, season summaries can be Views that auto-update.

### 11.5 Updated STDB Competitive Position

| Capability | Firebase | Convex | Supabase | STDB v2.0 |
|---|---|---|---|---|
| Auth (OAuth, magic link) | Built-in | Component | Built-in | SpacetimeAuth (beta) |
| Real-time subscriptions | Yes | Yes | Yes | Best-in-class |
| HTTP from backend | Cloud Functions | Actions | Edge Functions | Procedures (beta) |
| Row-level security | Rules | Custom | Postgres RLS | RLS with :sender |
| Views (computed) | No | No | Postgres views | Subscribable Views |
| File/blob storage | Built-in | Built-in | Built-in | NOT YET |
| Scheduled functions | Built-in | Cron | pg_cron | NOT YET |
| Component marketplace | Extensions | Components | Extensions | NOT YET (stdb-forge fills this!) |

---

## SECTION 12: Client-Side Document Processing (BentoPDF Patterns)

**Source:** `C:\Projects\asymmetrica-runtime\bentopdf-main\`
**License:** Commercial license owned — free to adapt for any Asymmetrica project
**Architecture:** 100% client-side. ZERO server-side document processing.

### 12.1 Key Insight

BentoPDF proves that serious document processing (OCR, PDF generation, image enhancement) runs entirely in the browser/WebView using WASM + Canvas + Web Workers. No server needed.

**For Rythu Mitra this means:** Bill scanning, report generation, and image processing happen ON Lakshmi's phone. No internet required. No API cost. No server compute.

### 12.2 Relevant Client-Side Capabilities

#### Tesseract.js — Telugu OCR (NO SERVER!)

- **What:** OCR engine running in browser via WASM
- **Languages:** 100+ including Telugu (te), Hindi (hi), Kannada (kn), Tamil (ta), English (en)
- **Performance:** 2-4 seconds per page on low-end phone
- **Size:** ~30-50MB per language pack (cached after first download)
- **Features:**
  - Whitelist presets: currency mode (for ₹ amounts), alphanumeric, forms
  - Binarization toggle for low-contrast scans
  - Resolution scaling (1x-4x) for quality vs speed tradeoff
  - HOCR output with word-level positioning and confidence scores
  - Runs in Web Worker (doesn't freeze UI)
- **Source:** `bentopdf-main/src/js/utils/ocr.ts`

**Rythu Mitra use:** Lakshmi photographs dealer bill → Canvas preprocesses → Tesseract.js extracts Telugu+English text → @asymm/math parses amounts/dates/names → STDB reducer stores structured data. ZERO internet needed.

#### Canvas API — Image Preprocessing (ZERO dependencies)

- **Brightness/contrast adjustment:** `ctx.filter = 'brightness(1.2) contrast(0.8)'`
- **Binarization:** Pixel-level threshold (128) for low-contrast bill photos
- **Crop/rotate:** Align skewed photos before OCR
- **Compression:** Resize + JPEG re-encode for storage efficiency
- **Source:** Native browser API, no library needed

#### pdf-lib — PDF Generation (100KB, pure JS)

- **What:** Create/modify PDFs entirely in JavaScript
- **Size:** ~100KB (tiny!)
- **Features:** Create pages, add text, embed images, set metadata, embed fonts
- **Source:** `bentopdf-main` uses extensively via `src/js/utils/pdf-operations.ts`

**Rythu Mitra use:** Generate season summary PDFs, expense reports for bank loans, crop journal with photos — ALL on device, no server.

#### Web Workers — Background Processing

- **Pattern:** Post ArrayBuffer to Worker → process → return result
- **Benefit:** OCR and PDF generation don't freeze the chat UI
- **Source:** `bentopdf-main/public/workers/` (8 worker templates)

### 12.3 What We DON'T Need From BentoPDF

Skip the heavy WASM modules — Lakshmi doesn't need them:
- PyMuPDF (180MB) — overkill, we only need basic OCR + PDF creation
- Ghostscript (200MB) — PDF/A not needed for farmers
- LibreOffice (250MB) — no Word/Excel conversion needed

**What we DO use:** Tesseract.js (~50MB with Telugu), pdf-lib (~100KB), Canvas (0KB). Total: ~50MB.

### 12.4 The Bill Scanning Pipeline (Zero Server)

```
1. Camera capture → JPEG                                    → 0s
2. Canvas: auto-brightness + binarize (Web Worker)           → 0.2s
3. Tesseract.js: OCR Telugu+English (Web Worker)             → 2-4s
   Output: "నంది విత్తనాలు\nGroundnut Seeds\n₹320\n2 bags"
4. @asymm/math: regex/pattern extraction                     → <1ms
   → amount: 32000 paise, party: "Nandi Seeds", items: "Groundnut Seeds × 2"
5. @asymm/math: MRP comparison (vyāpti + upādhi check)      → <1ms
   → Dealer ₹320 vs MRP ₹290 → check defeating conditions → ALERT
6. STDB reducer: store_document + record_money_event         → <1ms
7. Svelte subscription fires → UI shows Telugu confirmation  → 0ms

TOTAL: 3-5 seconds. ZERO internet. ZERO API cost.
```

### 12.5 Key Source Files

- OCR integration: `bentopdf-main/src/js/utils/ocr.ts`
- OCR UI patterns: `bentopdf-main/src/js/logic/ocr-pdf-page.ts`
- Telugu language config: `bentopdf-main/src/js/config/tesseract-languages.ts`
- Font mappings (Indic): `bentopdf-main/src/js/config/font-mappings.ts`
- Image processing: `bentopdf-main/src/js/utils/image-compress.ts`
- PDF operations: `bentopdf-main/src/js/utils/pdf-operations.ts`
- Worker patterns: `bentopdf-main/public/workers/`
- WASM lazy loading: `bentopdf-main/src/js/utils/wasm-provider.ts`

---

## SECTION 13: Client-Side Compute Architecture

### 13.1 Design Principle: "Frontend Is a Dumb Renderer"

All logic lives in either:
- **Client compute engine** (@asymm/math + BentoPDF patterns) — pure functions, no I/O
- **STDB** (reducers + procedures) — state + external API calls

The Svelte/Tauri UI layer ONLY subscribes to STDB tables and renders. Zero business logic in components.

Since the code is open source, there's no IP to protect in the client. Push everything to compute libraries or STDB.

### 13.2 What Runs Client-Side (ALL < 10ms on ₹10K phone)

**@asymm/math — Pure computation library (target: npm package)**

| Function | Complexity | Time | Use |
|---|---|---|---|
| `digitalRoot(n)` | O(1) | < 1µs | Intent classification, amount flagging |
| `digitalRootChain(drs[])` | O(k) | < 1µs | Batch DR composition without re-scan |
| `classifyRegime(text)` | O(k) | < 0.1ms | R1/R2/R3 detection for API routing |
| `checkBoundaries(r1,r2,r3)` | O(1) | < 1µs | Stability threshold validation |
| `slerp(q1, q2, t)` | O(1) | < 1µs | Conversation state interpolation |
| `geodesicDistance(q1, q2)` | O(1) | < 1µs | Semantic similarity measurement |
| `williamsOptimalBatch(n)` | O(1) | < 1µs | Memory-efficient batch sizing |
| `oilWaterRatio(text)` | O(w) | < 0.5ms | Prompt information density |
| `shunyamContrast(oil, water)` | O(1) | < 1µs | Factored density metric |
| `piEmergenceCheck(conditions)` | O(1) | < 1µs | Convergence prediction |
| `generatePrismPrompt(analysis)` | O(1) | < 0.5ms | Auto-generated system prompt |
| `codonEncode(byte)` / `codonDecode` | O(1) | < 1ns | Byte ↔ quaternion mapping |
| `codonDistance(str1, str2)` | O(n) | < 1ms | Character-level similarity |
| `vyaptiCheck(value, invariant, upadhis)` | O(k) | < 0.1ms | Zero-false-positive alerting |
| `computeBalance(events[])` | O(n) | < 1ms | Sum income - expenses (n < 5000) |
| `categorizeTransaction(text)` | O(1) | < 0.1ms | Keyword → enum mapping |
| `quaternionSearch(query, records)` | O(n) | < 5ms | Semantic search with DR pre-filter |

**Total Trident pipeline: < 2ms for complete optimization of any query.**

**BentoPDF engine — Document processing (Web Workers)**

| Function | Time (low-end phone) | Use |
|---|---|---|
| Canvas binarize/enhance | 0.2s | Preprocess bill photos |
| Tesseract.js OCR (1 page) | 2-4s | Extract text from photos |
| pdf-lib create report | 0.5-1s | Generate season summary PDF |
| Canvas image compress | 0.1s | Reduce photo size for storage |

### 13.3 What Runs in STDB Procedures (Needs Network)

Only 9 procedures need external API calls:

| Procedure | External API | When Called |
|---|---|---|
| `transcribe_voice` | Sarvam STT (Saaras V3) | Voice note → text |
| `chat_ai` | Sarvam Chat (sarvam-m) | AI responses in domain chats |
| `identify_pest` | Sarvam Vision | Crop photo pest identification |
| `translate_text` | Sarvam Translate (Mayura) | English advisories → Telugu |
| `text_to_speech` | Sarvam TTS (Bulbul) | Read confirmations aloud |
| `fetch_mandi_prices` | Agmarknet API | Market price updates |
| `check_scheme_status` | PM-KISAN / state APIs | Government scheme status |
| `fetch_weather` | IMD API | Weather data + alerts |
| `send_whatsapp` | Meta WhatsApp Business | Send messages to contacts |

### 13.4 Offline vs Online Capability Map

**WORKS WITHOUT INTERNET (13 capabilities):**
- Record expenses (typed or from template)
- Photograph bill → OCR → structured entry (Tesseract.js!)
- View running balance (computed from local money_events)
- View expense history by category/season
- Photograph crop → log event with GPS + timestamp
- Browse cached mandi prices (from last sync)
- Generate season summary PDF (pdf-lib!)
- Generate expense report for bank loans (pdf-lib!)
- Search all records (quaternion semantic search, local!)
- MRP overcharge alerts (vyāpti, local!)
- View crop journal timeline
- Add/edit parties (dealers, traders, laborers)
- Full audit trail of all activities

**NEEDS INTERNET (6 capabilities):**
- Voice note transcription (Sarvam STT)
- Pest identification from photo (Sarvam Vision)
- AI chat responses (Sarvam Chat)
- Fresh mandi prices (Agmarknet)
- Government scheme status checks
- WhatsApp messages

### 13.5 Hardware Reality

| Spec | ₹10K Redmi (2024) | Commander's N100 |
|---|---|---|
| CPU | Snapdragon 680, 8 cores, 2.4GHz | Intel N100, 4 cores, 3.4GHz |
| RAM | 4GB (2GB usable after Android) | 16GB |
| Storage | 64GB eMMC | 512GB SSD |
| Compute budget | Similar single-thread perf | Similar |

**Key insight:** If it runs on the N100, it runs on the Redmi. Commander has been accidentally dogfooding the target hardware class. All Vedic math algorithms are O(1) — designed for mental arithmetic 2000+ years ago, naturally optimized for constrained hardware.

**Client-side file size limit:** None! Since processing happens on-device, the limit is phone storage (64GB), not server upload limits. Process a 2GB photo album if you want — it's your phone.

---

## SECTION 14: stdb-forge — Open Source STDB Component System

### 14.1 Vision

An open-source tool that produces **composable, isolated, publishable STDB components** — the "Convex Components" equivalent for SpacetimeDB. Someone on the STDB Discord asked for exactly this.

**Inspired by:**
- CLI-Anything's 7-phase pipeline (Analyze → Design → Implement → Test → Document → Publish)
- Convex Components model ("mini self-contained backends" with isolated tables + functions)

### 14.2 The 7-Phase Pipeline (Adapted from CLI-Anything for STDB)

```
Phase 1: ANALYZE    — Scan source code of open-source tool, extract callable functions,
                      input/output types, state requirements
Phase 2: DESIGN     — Map capabilities to STDB tables + reducers + enums + procedures.
                      Define isolation boundary (what component owns vs host provides)
Phase 3: IMPLEMENT  — Generate STDB module: tables + reducers + procedures + enums.
                      Each "command" = a reducer/procedure. State = tables.
                      Output = table rows the client subscribes to.
Phase 4: PLAN TESTS — Plan reducer/procedure tests (via spacetime call) + integration tests
Phase 5: WRITE TESTS — Implement against real STDB instance
Phase 6: DOCUMENT   — README, API reference, usage examples, composition guide
Phase 7: PUBLISH    — spacetime publish, or npm package, or git submodule
```

### 14.3 Component Isolation Model (Like Convex)

Each component is a "mini self-contained STDB backend":
- OWNS its tables (isolated, host can't access directly)
- EXPOSES reducers/procedures (the public API)
- REQUIRES from host via dependency injection (e.g., caller identity, context IDs)
- Uses RLS for per-identity data isolation within the component

### 14.4 Component Manifest (`stdb-component.yaml`)

```yaml
name: expense-tracker
version: 0.1.0
description: "Voice-friendly expense tracking with computed balances"
author: asymmetrica
license: Apache-2.0
language: typescript

tables:
  - name: transactions
    public: true
    indexes: [by_category, by_date, by_party]

reducers:
  - name: record_transaction
    params: [amount_paise: u64, category: string, description: string]

procedures:
  - name: fetch_bank_statement
    params: [account_id: string]
    http: true  # marks this as needing external API access

enums:
  - TransactionKind: [Income, Expense, Transfer]

requires:
  - identity: true
  - party_id: false  # optional host context

invariants:
  - "balance is NEVER stored — computed from sum of transactions"
  - "all money in integer paise (u64)"
```

### 14.5 First Components to Build

| Component | Source | Universal Use |
|---|---|---|
| `@stdb-forge/expense-tracker` | 001-Ledger + 003-AsymmFlow | Any app needing financial tracking |
| `@stdb-forge/crop-journal` | farmOS + Tania (Go) | Farm management, garden apps |
| `@stdb-forge/market-prices` | Agmarknet patterns | Commodity tracking apps |
| `@stdb-forge/activity-log` | 003-AsymmFlow activity_log | Any app needing audit trail |
| `@stdb-forge/rbac-auth` | 003-AsymmFlow access_key pattern | Any multi-user app |
| `@stdb-forge/document-ocr` | BentoPDF Tesseract.js patterns | Any app needing document scanning |
| `@stdb-forge/chat-ai` | vedic_qiskit Trident + Prism V2 | Any app needing AI chat |
| `@stdb-forge/irrigation-advisor` | PyETo (open source) | Farm management, landscaping |

### 14.6 Three-Layer Separation

```
STDB Reducers (Zone 1):     State, validation, pure logic, state machines
STDB Procedures (Zone 1.5): State + HTTP calls to external APIs (Sarvam, Agmarknet, etc.)
Client Compute (Zone 2):    @asymm/math (O(1) Vedic math), BentoPDF (OCR, PDF gen)
Server Compute (Zone 3):    ONLY for heavy ML inference, multi-stage pipelines
```

Procedures eliminated most of Zone 3. BentoPDF eliminated OCR from Zone 3. What remains server-side is minimal.

---

## SECTION 15: Open Source Agriculture Resources

**Source:** `github.com/brycejohnston/awesome-agriculture` (75+ repos)

### 15.1 Tier 1: Directly Useful

| Tool | Language | What To Reuse |
|---|---|---|
| **Tania** (`github.com/Tanibox/tania-core`) | Go + Vue | Closest tech match — study data model for crops, tasks, inventory |
| **LiteFarm** (`github.com/LiteFarmOrg/LiteFarm`) | React/Node | Best onboarding UX for farmers, crop planning interface |
| **farmOS** (`github.com/farmOS/farmOS`) | Drupal/PHP | Most mature data model (asset types, log types, quantities) |
| **PlantCV** (`github.com/danforthcenter/plantcv`) | Python | Pest/disease identification from photos |
| **PlantVillage** (Kaggle dataset) | — | 54K leaf images for pest ID validation |
| **OpenFarm** (`github.com/openfarmcc/OpenFarm`) | — | Open crop knowledge base + API |
| **PyETo** (`github.com/woodcrafty/PyETo`) | Python | Evapotranspiration → irrigation advisory |
| **AgML** (`github.com/Project-AgML/AgML`) | Python | Crop yield prediction models |
| **Harvest Helper** (`github.com/damwhit/harvest_helper`) | — | Growing/harvesting info + JSON API |
| **FarmVibes.AI** (`github.com/microsoft/farmvibes-ai`) | Python | Microsoft's multi-modal geospatial ML for agriculture |

### 15.2 Tier 2: Useful for Specific Features

| Tool | Use |
|---|---|
| **agroclimatology** (NASA POWER) | Historical weather for crop planning |
| **OpenWeedLocator** | Weed detection from photos (future) |
| **AgOpenGPS** | Field mapping, plot boundaries (future) |
| **Farm-Data-Relay-System** | IoT sensor data in remote areas (future) |
| **CropHarvest** (NASA) | Remote sensing for crop type mapping |

### 15.3 Integration Pattern: STDB-Anything (NOT CLI-Anything)

Instead of wrapping tools as CLI commands (CLI-Anything pattern), we wrap them as STDB components:
- The reducer IS the command
- The table IS the state
- The subscription IS the output
- No subprocess, no stdout parsing, no PATH management

**Why STDB-Anything > CLI-Anything for our use case:**
- Reactive by default (table change → UI update)
- Transactional integrity (reducer throws → nothing committed)
- Offline-first naturally (STDB local)
- Multi-user by default (shared subscriptions)
- No integration tax (shared tables, shared identity)

---

## SECTION 16: Open Source Contribution Strategy

### 16.1 Four Packages

| Package | What | For Whom |
|---|---|---|
| `stdb-forge` | Tooling for generating STDB components from source code | STDB ecosystem |
| `@stdb-forge/*` | Pre-built composable STDB components | STDB developers |
| `@asymm/math` | Pure computation library (Vedic math, quaternions, Trident) | Anyone (no STDB dependency) |
| `@asymm/docengine` | Client-side document processing (Tesseract.js + Canvas + pdf-lib) | Anyone needing offline doc processing |

### 16.2 Positioning

- **stdb-forge** fills the "Convex Components" gap that the STDB community is asking for
- **@asymm/math** is genuinely useful to anyone doing API optimization or semantic search
- **@asymm/docengine** is useful to anyone building offline-first document apps
- **Rythu Mitra** is the first app composed from all four — "the plane flying"
- **Asymmetrica** becomes the ecosystem layer for STDB

### 16.3 License

Apache 2.0 for all open-source packages.

---

## SECTION 17: Engagement Loop & Gamification ("Matti Loop")

### 17.1 Design Philosophy: Clarity Dopamine, Not Anxiety Dopamine

**AVOID:** Silicon Valley gamification (streaks, leaderboards, points, badges that create FOMO/anxiety). Lakshmi has enough stress — weather, pests, debt, market prices.

**USE:** Dopamine from CLARITY — "I understand my farm better today than yesterday." The joy of ₹30 saved. The satisfaction of a complete journal. The pride of a professional PDF report.

**Reference frame:** Not Duolingo. A well-kept notebook that gives you compliments.

### 17.2 Three Dopamine Sources

1. **Discovery Dopamine** — "I didn't know that!" Information that was invisible becoming visible (overcharges caught, better mandi prices, scheme status, cost comparisons)
2. **Completion Dopamine** — "I recorded everything." Season journal filling up, all categories tracked, PDF report generated
3. **Growth Dopamine** — "My farm is improving." Cost per quintal decreasing, yield increasing, better decisions over seasons

### 17.3 Engagement Mechanics

#### A. Matti Score — Farm Health Index (Private, Not Competitive)

Composite score reflecting actual farm business health:
- Record Keeping (30%) — expenses/income logged regularly?
- Crop Care (25%) — crop events documented with photos?
- Financial Health (25%) — profit trending up vs last season?
- Market Awareness (20%) — checking prices, catching overcharges?

**Visual:** Rangoli progress ring on home screen. Brass when healthy, fades when neglected. PRIVATE — no leaderboards, no comparison with neighbors. This is YOUR farm getting healthier.

**Implementation:** STDB View aggregating money_events + crop_events + market checks. Score calculation in @asymm/math (client-side).

#### B. Poddu Parichayam — Morning Briefing Ritual

Daily hook generated from STDB data. Each morning a fresh card:
- Day 1: Mandi prices updated
- Day 2: "నిన్న ₹800 నమోదు చేశారు. బాగా చేస్తున్నారు!" (nice logging!)
- Day 3: "⚠️ రేపు వేప నూనె పిచికారీ రోజు" (pest treatment reminder)
- Day 4: "🎉 ఈ వారం ₹1,200 ఆదా!" (you saved ₹1,200 this week)
- Day 5: "కోతకు 20 రోజులు!" (harvest countdown)

**Implementation:** Client-side assembly from STDB data. No manual content curation needed.

#### C. Season Story — మీ సీజన్ కథ

End-of-season narrative PDF generated client-side (pdf-lib):
- Complete timeline of crop events
- Total income, expenses, profit/loss
- Comparison with previous season ("8% ఎక్కువ లాభం!")
- Photo gallery from crop journal
- Shareable via WhatsApp

**Viral loop:** Venkatamma sees Lakshmi's season report → "ఇది ఎలా చేశావు?" → organic adoption.

**Bank utility:** This PDF IS the financial documentation for crop loan applications.

**Implementation:** pdf-lib client-side from STDB money_events + crop_events. ZERO server.

#### D. Micro-Celebrations

Small, earned celebrations for real productive activity:

| Trigger | Message | Animation |
|---|---|---|
| First expense logged | "మొదటి నమోదు! 🌱 మంచి ప్రారంభం!" | Earth-toned confetti particles |
| 7 consecutive days logging | "వరుసగా 7 రోజులు! 💪" | Rangoli ring spin |
| Overcharge caught | "₹30 ఆదా! 🛡️" | Shield pulse + amount counter |
| Season journal complete | "పూర్తి జర్నల్! 📚" | Photo mosaic animation |
| First PDF generated | "మొదటి నివేదిక! 📄" | Sparkle effect |
| 100th transaction | "100 లావాదేవీలు! 🏆" | Brass milestone stamp |

**Style:** Earth-toned particles (turmeric dust, mango leaf, brass sparkle). 2 seconds max. Ephemeral like a kolam.

**Implementation:** Reducer counting milestones in STDB. Animation trigger client-side.

#### E. Panchayat Wisdom Cards

Contextual farming tips triggered by actual farm events:
- Log irrigation → "డ్రిప్ ఇరిగేషన్ 40% నీరు ఆదా చేస్తుంది"
- Price above MSP → "అమ్మడానికి మంచి సమయం!"
- 3 days no login → "మీ పొలం ఎలా ఉంది? ఒక్క ఫోటో చాలు!"
- After pest ID → "10 రోజుల్లో మళ్ళీ తనిఖీ చేయండి"

**Source:** OpenFarm knowledge base + Sarvam translation + STDB event triggers.

**Implementation:** `wisdom_card` table with trigger conditions. Condition matching in @asymm/math.

#### F. Season Comparison — Your Own Progress

Compare with YOUR past self, never with other farmers:
- Current vs previous season: expenses, income, profit
- Delta highlighting: "₹1,550 తక్కువ ఖర్చు (కూలి ఆదా)"
- Trend direction with percentage

**Implementation:** STDB View comparing date-ranged money_events across seasons. Delta calc client-side.

#### G. Harvest Countdown

Progress bar counting down to harvest day:
- Shows days remaining, percentage complete
- Estimated profit based on current mandi prices
- Intensifies as harvest approaches (daily updates in last 10 days)
- Harvest day celebration: "కోత రోజు వచ్చింది! 🎉 📸 కోత ఫోటో తీయండి"

**Implementation:** Computed from farmer_context.season_stage + planting date. Pure client-side.

#### H. Ittadi Stamps — Brass Achievement Marks

5-7 meaningful stamps (not 100 trivial badges). Metaphor: brass stamps on grain bags at mandis.

| Stamp | Name | How Earned |
|---|---|---|
| 🟤 | మట్టి ముద్ర (Earth) | Complete first season with records |
| 🟡 | పసుపు ముద్ర (Turmeric) | Catch first overcharge |
| 🟢 | పచ్చి ముద్ర (Green) | Grow profit vs previous season |
| 🔵 | నీలి ముద్ర (Indigo) | Use all 4 domain features |
| 🟠 | ఇత్తడి ముద్ర (Brass) | Generate first season report PDF |

**Implementation:** `achievement` table (farmer_id, stamp_type, earned_at). Small table, checked on relevant events.

### 17.4 The Loop: Daily → Weekly → Seasonal

```
DAILY (1-2 min):
  Open → Morning briefing → Log 1-2 expenses by voice → See balance → Close
  REWARD: "I know where my money went today"

WEEKLY (5 min):
  Week summary → Check mandi prices → Compare dealers → Log crop event
  REWARD: "I saved money / I documented my crop"

SEASONAL (harvest time):
  Season review → Generate PDF → Compare with last season → Share → Take to bank
  REWARD: "I have proof I'm a good farm manager"

ANNUAL (new year):
  Year review → All seasons compared → Total profit/loss → Achievement stamps
  REWARD: "My farm business is growing"
```

### 17.5 Anti-Anxiety Design Principles

- **No streak penalty** — Missing days doesn't "break" anything. Welcome back warmly.
- **No social comparison** — Matti Score is private. No leaderboards.
- **Real monetary rewards** — Every overcharge caught = real rupees saved.
- **Seasonal tempo** — App intensity matches agricultural calendar. Relaxes during growth, intensifies at planting/harvest.
- **The PDF is the ultimate reward** — For someone who never had organized financial records, a professional PDF with their name and data is not gamification. It's dignity.

### 17.6 Backend Requirements (Minimal)

| Mechanic | New STDB Tables | Client Compute |
|---|---|---|
| Matti Score | View (no new table) | @asymm/math score calc |
| Morning Briefing | None (uses existing data) | Card assembly (client) |
| Season Story | None | pdf-lib generation (client) |
| Micro-celebrations | milestone counter in activity_log | Animation trigger (client) |
| Wisdom Cards | `wisdom_card` (trigger conditions + content) | Condition matching (client) |
| Harvest Countdown | None (computed from farmer_context) | Date math (client) |
| Brass Stamps | `achievement` (farmer_id, type, earned_at) | Animation trigger (client) |

**Total new tables: 2 (wisdom_card, achievement). Everything else is Views over existing data + client-side computation.**

---

## SECTION 18: UI/UX Mockups & Design System ("Matti")

### 18.1 Design System: Matti (మట్టి — Earth)

**Philosophy:** Same Living Geometry mathematical DNA as the gold standard wabi-sabi mockups (phi spacing, Fibonacci timing, breathing animations), but expressed through Deccan/Telugu visual culture.

**Color Palette:**
- Matti (Earth): #8B4513 — laterite red soil of Rayalaseema
- Pasupu (Turmeric): #E8A317 — sacred yellow, FAB + highlights
- Neeli (Indigo): #1B4F72 — natural dye, trust + government
- Patti (Cotton): #FAF7F0 — raw cotton white, app background
- Nalupurugu (Dust): #D4C5A9 — dry season, borders/dividers
- Pacchi (Green): #2D6A4F — crop green, income
- Erra (Red): #C0392B — vermillion, alerts + expenses
- Ittadi (Brass): #B8860B — brass vessel accent

**Typography:** Noto Sans Telugu (body) + Noto Serif Telugu (display). Phi-derived scale.

**Spacing:** Fibonacci sequence (1, 2, 3, 5, 8, 13, 21, 34, 55px)

**Animation durations:** Fibonacci (89, 144, 233, 377, 610, 987ms)

**Background:** Kolam dot grid (Canvas, 2.5% opacity, golden angle arcs) — culturally rooted, mathematically identical to phyllotaxis

**Border-radius:** Irregular wabi-sabi (e.g., 3px 13px 5px 8px) — handmade feel

**Light theme ONLY** — designed for outdoor phone use in sunlight

**Touch targets:** 48px minimum — for farm-weathered hands

### 18.2 Mockup Files

| File | Screen | Key Components |
|---|---|---|
| `matti_v1_morning_briefing.html` | హోం (Home) | Greeting, balance hero, season ring, briefing cards, transactions |
| `matti_v2_dabbu.html` | దబ్బు (Money) | Donut chart, quick entry, transaction timeline, voice bottom sheet, season P&L |
| `matti_v3_market.html` | మార్కెట్ (Market) | Crop pills, hero price, turmeric wash trend chart, 5-mandi comparison, price alert |
| `matti_v4_panta.html` | పంట (Crop) | Lifecycle timeline, pest alert, status card, quick log forms, event journal, cost breakdown |
| `matti_app_prototype.html` | **All 4 unified** | Single-page app with tab navigation, shared FAB + toasts + kolam |

**Location:** `C:\Projects\asymm-kit-factory\experiments\rythu_mitra\uiux-mockups\`

**Component parts:** `uiux-mockups/parts/` — 9 files (CSS + HTML fragments + JS engine) assembled into the unified prototype

### 18.3 Micro-Animations (Baked In, Not Afterthought)

All 20 micro-animations present from first mockup:
1. Kolam dot grid background (Canvas, golden angle)
2. Staggered card entry (IntersectionObserver + Fibonacci delays)
3. Brass gold ripple on ALL interactive elements
4. Balance counter animation (0 → target, ease-out-cubic)
5. Voice FAB breathing ring (4s cycle)
6. Voice FAB listening state (vermillion + mic bounce)
7. Mango leaf toasts (slide + rotation + float + auto-dismiss)
8. Card hover lift (2px + shadow)
9. Card active press (scale 0.98, 89ms)
10. Nav active indicator (brass top bar)
11. Donut chart animated draw (987ms)
12. Price bars grow from zero (spring easing)
13. Turmeric wash trend chart (progressive brush stroke draw)
14. Crop lifecycle SVG path draw
15. Current crop stage breathing pulse
16. Season ring SVG draw animation
17. Transaction items slide-in-left
18. Shimmer bars on hero cards (3s breathing)
19. Price alert slider live gradient
20. Pest alert border pulse

---

*This document is a living reference. Update as capabilities are wired or new patterns discovered.*
*Om Lokah Samastah Sukhino Bhavantu — May all beings benefit from this work.*
