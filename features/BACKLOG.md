# Rythu Mitra — Feature Backlog

**Last updated:** 2026-03-17 (Day 2 complete! See SPRINT_2026_03_17.md for full report)
**Status key:** 📋 Specced | 🔨 Building | ✅ Live | ⏸️ Blocked | — Not yet specced

---

## Wave 0: Foundation

These are load-bearing. Everything else depends on them. No shortcuts.

| ID | Feature | Status | Depends On | Contract |
|----|---------|--------|------------|----------|
| F001 | STDB Schema + Module | ✅ Live | — | [F001](F001_stdb_foundation.md) |
| F002 | Tauri v2 Android Shell | ✅ Live | — | [F002](F002_tauri_mobile_shell.md) |
| F003 | Living Geometry TS Engine (@asymm/qgif-web) | — | — | — |

**Wave 0 exit criteria:** `spacetimedb publish` succeeds with 11 tables + reducers. Tauri Android emulator shows Matti home screen with navigation. Living Geometry engine resolves quaternion → CSS props.

---

## Wave 1: Core Loop

The minimum interactions that prove the thesis: "voice in, structured data out."

| ID | Feature | Status | Depends On | Contract |
|----|---------|--------|------------|----------|
| F004 | Voice → Expense Entry (Dabbu) | ✅ Live | F001, F002 | [F004](F004_voice_expense_entry.md) |
| F005 | Morning Briefing (Home Screen) | ✅ Live | F001, F002 | [F005](F005_morning_briefing.md) |
| F006 | Crop Photo Event (Panta) | ✅ Live | F001, F002 | — |

**Wave 1 exit criteria:** Lakshmi can voice-note an expense in Telugu, see her balance on the home screen with mandi prices, and photograph a pest for crop logging. All data persists locally and syncs.

---

## Wave 2: Intelligence

Where the mathematical substrate earns its keep.

| ID | Feature | Status | Depends On | Contract |
|----|---------|--------|------------|----------|
| F007 | Mandi Price Feed (Market) | ✅ Live | F001 | — |
| F014 | Collapsible Chat Interface (THE PRODUCT) | ✅ Live | F001, F002, F004 | [F014](F014_chat_interface.md) |
| F008 | MRP Overcharge Detection (Vyapti) | ✅ Live | F007 | — |
| F009 | PM-KISAN Status Check (Sarkar) | ✅ Live | F001 | — |
| F010 | Season Summary PDF (Reports) | ✅ Live | F001, F004 | — |

**Wave 2 exit criteria:** Market screen shows live mandi prices. Photographing a dealer bill flags overcharges (0 false positives via vyapti). PM-KISAN status in Telugu. PDF report generated on-device.

---

## Wave 3: Network + Learning

Single-player value proven → add multiplayer + education.

| ID | Feature | Status | Depends On | Contract |
|----|---------|--------|------------|----------|
| F011 | P2P Messaging (People) | — | F001, F002 | — |
| F012 | Learn Mode (Curriculum) | — | F001 | — |
| F013 | Onboarding Conversation | ✅ Live | F001, F002, F004 | — |

---

## Cross-Cutting Decisions

Architectural choices that affect multiple features. See `decisions/` directory.

| ID | Decision | Status | Ref |
|----|----------|--------|-----|
| ADR001 | STDB Procedures vs Separate Server | Decided | [ADR001](../decisions/ADR001_procedures_vs_server.md) |
| ADR002 | Client-Side OCR (Tesseract.js) vs Server OCR | — | — |
| ADR003 | Auth: SpacetimeAuth Magic Link vs Custom OTP | — | — |

---

## Invariants (Apply to ALL features)

These are non-negotiable across every feature contract. Derived from Phase 18 learnings and production experience.

1. **Outstanding balance is NEVER stored** — always computed from money_events
2. **All money is integer paise (u64)** — no floating point, no decimal, ever
3. **Floor balance at zero** — `max(0, income - expenses)`
4. **Idempotency on financial writes** — `SHA256(farmer_id|amount|date|reference)`
5. **Transaction locking** — no TOCTOU races on financial state
6. **Identity === via String()** — never use `===` on STDB Identity objects directly
7. **Enum wire format awareness** — CLI lowercase, SDK PascalCase
8. **Version alignment** — STDB CLI version must match SDK version exactly
9. **Vyapti before alerting** — always check defeating conditions before showing alerts
10. **SLERP stays on S3** — conversation state ||q|| = 1.0, guaranteed by construction
