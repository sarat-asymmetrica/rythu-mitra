# Rythu Mitra — STDB Module Rules

## Build Commands

```bash
cd C:\Projects\asymm-kit-factory\experiments\rythu_mitra\module\spacetimedb

# Install deps
npm install

# Build (compile check)
spacetime build

# Publish to maincloud
spacetime publish rythu-mitra

# Publish with clean slate (DESTROYS ALL DATA)
spacetime publish rythu-mitra --clear-database -y

# Generate client bindings
spacetime generate --lang typescript --out-dir ../../client/src/module_bindings

# View logs
spacetime logs rythu-mitra
```

## STDB Version Requirements

- CLI: `spacetime 2.0.x`
- SDK: `spacetimedb@^2.0.1`
- TypeScript: `~5.6.2`
- **ALL THREE MUST MATCH** (see STDB_LEARNINGS.md #15)

## Key Invariants (NEVER VIOLATE)

1. **Balance is NEVER stored** — always computed from `money_event` table via the `farmer_balance` view. This is the Phase 18 invariant.
2. **All money is integer paise (u64)** — Rs 1 = 100 paise. NO floating point. NO exceptions.
3. **Idempotency key on financial writes** — `record_money_event` requires a unique `idempotency_key` (SHA256). Duplicate keys are rejected.
4. **Identity comparison via `String()`** — NEVER use `===` on Identity objects. Always `String(a) === String(b)`.
5. **All table names use snake_case** — with explicit `name` overrides in `table()` options.
6. **Reducer auth** — every reducer checks `ctx.db.farmer.identity.find(ctx.sender)` before mutating data.

## Tables (11)

| Table | PK | Purpose |
|-------|----|----|
| farmer | identity | Core identity |
| farmer_context | farmer_id (identity) | Farming profile |
| money_event | id (auto-inc) | Financial ledger |
| crop_event | id (auto-inc) | Field diary |
| market_price | id (auto-inc) | Mandi rates (public) |
| scheme_status | id (auto-inc) | Govt scheme tracking |
| document | id (auto-inc) | Bills, receipts, photos |
| party | id (auto-inc) | Dealers, traders, laborers |
| activity_log | id (auto-inc) | Audit trail |
| learning_profile | farmer_id (identity) | Adaptive learning state |
| curriculum_item | id (auto-inc) | Learning content |

## Indexes

- `money_event_farmer_id` — btree on money_event.farmer_id
- `crop_event_farmer_id` — btree on crop_event.farmer_id
- `market_price_crop` — btree on market_price.crop
- `market_price_district` — btree on market_price.district
- `scheme_status_farmer_id` — btree on scheme_status.farmer_id
- `document_farmer_id` — btree on document.farmer_id
- `party_farmer_id` — btree on party.farmer_id
- `activity_log_farmer_id` — btree on activity_log.farmer_id
- `curriculum_item_farmer_id` — btree on curriculum_item.farmer_id
- `idempotency_key` — automatic unique index on money_event.idempotency_key

## Gotchas (from 001-ledger, apply here too)

1. Enum wire format (CLI) differs from SDK runtime: wire = `{"variant":{}}`, SDK = `{tag:"Variant"}`
2. `throw new Error()` = WASM panic = HTTP 530 = transaction rollback (expected)
3. No ORDER BY in STDB SQL — sort client-side
4. Client SDK reducers use named objects: `conn.reducers.recordMoneyEvent({ kind: "CropSale", ... })`
5. BigInt everywhere: `0n`, `1n` — never bare `0`, `1` for u64 fields
6. Procedures need `ctx.withTx()` for DB access — no `ctx.db` directly
7. Multi-column indexes are BROKEN — use single-column + manual filter

## Procedures (Beta)

Three procedures integrate external APIs:
- `transcribe_voice_note` — Sarvam AI STT (does NOT write to DB)
- `fetch_mandi_prices` — Agmarknet mandi data
- `check_scheme_status` — PM-KISAN/PMFBY status

API keys are placeholders (`__SARVAM_API_KEY__`, `__DATA_GOV_API_KEY__`). Commander configures these via module secrets.

## RLS Status

RLS is deprecated in STDB v2.0. Data isolation is handled via:
1. Reducer-level auth checks (every reducer validates `ctx.sender`)
2. The `farmer_balance` per-sender view
3. Client-side filtered subscriptions: `SELECT * FROM money_event WHERE farmer_id = '...'`
