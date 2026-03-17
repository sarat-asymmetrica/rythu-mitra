# ADR001 — STDB Procedures vs Separate API Server

**Status:** Decided
**Date:** 2026-03-16
**Deciders:** Commander (Sarat) + Claude

---

## Context

Rythu Mitra needs to call external HTTP APIs:
- **Sarvam AI** (STT, Chat, Vision, Translate, TTS) — the AI interface
- **Agmarknet** — mandi price data
- **PM-KISAN** — government subsidy status
- **IMD** — weather data
- **WhatsApp/Meta API** — notifications (future)

The traditional approach: deploy a separate API server (Express/Fastify/Hono on Node, or Go) that acts as middleware between the client and these APIs. The client calls our server, our server calls the external API, our server writes to the database.

SpacetimeDB v2.0 introduced **Procedures** (beta, March 2026): reducer-like functions that CAN make HTTP requests via `ctx.http.fetch()`. They run inside the STDB module process itself.

## Decision

**Use STDB Procedures for all external API calls. No separate API server.**

## Rationale

### Arguments FOR Procedures (why we chose this):

1. **One deployment target instead of two.**
   - `spacetimedb publish` deploys everything. No Docker, no PM2, no separate hosting.
   - For a two-person team (Commander + Claude), eliminating an entire deployment surface is huge.

2. **Transactional consistency.**
   - Procedure fetches mandi prices → writes to `market_price` table inside `ctx.withTx()`.
   - No failure mode where "the API returned data but the DB write failed."
   - This is exactly the pattern STDB designed Procedures for.

3. **Simpler client.**
   - Client calls a Procedure like it calls a Reducer — same SDK, same pattern.
   - No separate HTTP client, no auth tokens for our middleware, no CORS.

4. **Cost: $0 extra infrastructure.**
   - STDB hosting covers both data and compute.
   - A separate server = another bill (Sliplane, Railway, Fly.io, etc.).

5. **The calls are short and transactional.**
   - Sarvam STT: ~2-5 seconds. Well within 30s Procedure timeout.
   - Agmarknet price fetch: ~1-3 seconds.
   - PM-KISAN check: ~1-3 seconds.
   - None of these are long-running jobs.

### Arguments AGAINST Procedures (risks we accept):

1. **Beta feature.** Procedures are beta in STDB v2.0. API may change.
   - *Mitigation:* We're already on the STDB beta path (RLS, Views also beta).
     If Procedures break, we can extract to a standalone server — the HTTP call
     logic is portable.

2. **30-second timeout.** If Sarvam is slow, Procedure may time out.
   - *Mitigation:* Sarvam STT typically responds in 2-5 seconds. The 180-second
     total timeout (bumped in v2.0.5) gives headroom. For truly long operations
     (batch OCR), we still use client-side processing (Tesseract.js — see
     CAPABILITY_REFERENCE §12).

3. **No transaction during HTTP call.** `ctx.withTx()` must be called AFTER
   the HTTP response — can't hold a transaction open during network I/O.
   - *Mitigation:* This is by design. Fetch → parse → then transact. Our use
     cases are all fetch-then-write, not read-modify-write across HTTP.

4. **Secrets management.** STDB Procedure code runs on STDB's infrastructure.
   API keys (Sarvam, etc.) must be accessible there.
   - *Mitigation:* STDB supports environment variables / secrets for modules.
     Standard pattern for serverless-style deployments.

5. **No WebSocket/streaming from Procedures.** Can't stream Sarvam responses.
   - *Mitigation:* For v1, we don't need streaming. Voice note is recorded
     fully → sent as complete audio → get complete text back. Streaming is a
     v2+ optimization.

## Consequences

- **F001 (STDB Foundation):** Module includes Procedure definitions for Sarvam, Agmarknet, PM-KISAN.
- **F002 (Tauri Shell):** Client calls Procedures via STDB SDK, not a separate HTTP endpoint.
- **F004 (Voice Expense):** Voice audio → client records → calls `transcribe_voice_note` Procedure → gets text → calls `record_money_event` Reducer.
- **Deployment:** Single `spacetimedb publish` deploys ALL backend logic.
- **Fallback plan:** If Procedures prove unreliable in production, extract the HTTP logic to a lightweight Hono server on Sliplane. The Procedure signatures become API route signatures — minimal rework.

## What This Replaces

```
BEFORE (traditional):
  Client → Our API Server → Sarvam API
  Client → Our API Server → Agmarknet
  Client → Our API Server → STDB (for writes)
  [3 deployment targets: STDB, API server, client]

AFTER (Procedures):
  Client → STDB Procedure → Sarvam API (inside same process)
  Client → STDB Procedure → Agmarknet (inside same process)
  Client → STDB Reducer → STDB (direct writes)
  [2 deployment targets: STDB module, client]
```

---

## References

- STDB Procedures docs: `https://spacetimedb.com/docs/procedures`
- CAPABILITY_REFERENCE.md §11.2 (Procedures deep-dive)
- 001-Ledger STDB_LEARNINGS.md (general STDB gotchas)
