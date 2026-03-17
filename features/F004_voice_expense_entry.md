# F004 — Voice → Expense Entry (Dabbu)

**Status:** ✅ Live
**Wave:** 1 (Core Loop)
**Owner:** Commander + Claude
**Created:** 2026-03-16

---

## 1. User Story

As **Lakshmi** (38, Anantapur, groundnut farmer, ₹10K Redmi phone),
I want to **speak a voice note in Telugu saying "rendu kooliga vaallu vastunnaru, okkodiki 400 rupayalu"**,
so that **it gets recorded as a structured expense (Labor, ₹800, today's date) without me typing anything**.

This is the **flagship interaction** — the one that proves the thesis. If this works, the product works.

---

## 2. Acceptance Criteria

- [ ] AC1: Tap voice FAB on Dabbu screen → bottom sheet opens with waveform
- [ ] AC2: Voice recording captures audio (Tauri mic command or Web Audio API)
- [ ] AC3: Audio sent to Sarvam STT → Telugu transcription returned
- [ ] AC4: AI extracts intent: kind (LaborPayment), amount (80000 paise), description (original Telugu)
- [ ] AC5: Parsed result shown in confirmation card: "కూలి — ₹800 — నేడు"
- [ ] AC6: User taps "✓ సరే" → record_money_event reducer called
- [ ] AC7: User taps "✏️ మార్చు" → inline edit of amount/category before saving
- [ ] AC8: Transaction appears in Dabbu timeline immediately after save
- [ ] AC9: Balance updates in real-time (computed from money_events)
- [ ] AC10: Works offline: queues the event locally, syncs when online
- [ ] AC11: Idempotency key prevents duplicate entries on retry

---

## 3. Full-Stack Contract

### 3a. Schema (STDB Module — F001, already live)

Tables touched: `money_event`, `activity_log`, `party`
Reducers used: `record_money_event`, `log_activity`, `upsert_party`
Procedures used: `transcribe_voice_note` (Sarvam STT)

No schema changes needed — F001 covers everything.

### 3b. Client (Svelte + Tauri)

**New/modified components:**

| Component | Purpose |
|-----------|---------|
| `VoiceSheet.svelte` | NEW — Bottom sheet with waveform, transcription, confirmation |
| `VoiceFab.svelte` | MODIFY — On Dabbu screen, open VoiceSheet instead of toast |
| `ParsedExpenseCard.svelte` | NEW — Shows extracted: kind, amount, description, party |
| `Dabbu.svelte` | MODIFY — Add live transaction list from STDB subscription |

**State machine for voice flow:**

```
idle → recording → transcribing → parsed → [confirming | editing] → saving → saved
  ↑                                                                           |
  └───────────────────────────────────────────────────────────────────────────┘
```

**Waveform canvas:** Port from 06_engine.js §11 (3 overlapping sine waves in pasupu).

### 3c. Design (Living Geometry / Matti)

- Bottom sheet: slides up with spring easing (377ms, cubic-bezier(0.34, 1.56, 0.64, 1))
- Waveform: pasupu (#E8A317) multi-sine, 60fps
- Parsed card: patti-warm background, matti border, pacchi for income / erra for expense
- Confirmation buttons: "✓ సరే" (pacchi green), "✏️ మార్చు" (neeli blue)
- Regime: R2 (Optimization — precise financial data entry)

### 3d. AI Integration

**Pipeline:**
1. Record audio (Web Audio API → WAV/OGG blob)
2. Convert to base64
3. Call `transcribe_voice_note` STDB procedure → Sarvam STT → Telugu text
4. Parse Telugu text for: amount (regex for Telugu/Arabic numerals + "rupayalu/velu"),
   kind (keyword mapping: "kooliga"→Labor, "vittanalu"→Seeds, "eruvulu"→Fertilizer),
   party name (if mentioned)
5. If parsing uncertain → ask Sarvam chat for structured extraction
6. Show parsed result for confirmation

**Fallback (offline/API fail):**
- Store raw audio locally
- Show text input fallback: "మీరు టైప్ చేయండి" (Type it yourself)
- Queue for processing when online

---

## 4. Dependencies

- **Requires:** F001 (✅ Live), F002 (✅ Live)
- **Soft-requires:** STDB published + client wired (happening in parallel)
- **Blocks:** F010 (Season Summary PDF needs expense data)

---

## 5. Architecture Notes

### Why voice-first (not text-first with voice as alternative)

Lakshmi's primary digital interaction is voice notes on WhatsApp. Text input on a ₹10K phone
with Telugu keyboard is slow and error-prone. Voice is the natural modality.
Text fallback exists but is secondary.

### Why parse on client (not server)

Amount extraction from Telugu text is regex-based (fast, offline-capable).
Only ambiguous cases go to Sarvam chat. This minimizes API calls (54.1% token savings
from Trident optimization applies here).

### Telugu amount patterns to handle

```
"నాలుగు వందలు"          → 400
"ఐదు వేలు"              → 5000
"రెండు వేల ఐదు వందలు"  → 2500
"400 రూపాయలు"           → 400
"₹800"                   → 800
"ఎనిమిది వందలు"        → 800
```

### Category keyword mapping (Telugu → MoneyEventKind)

```
కూలి / కూలీలు / లేబర్   → LaborPayment
విత్తనాలు / వీడ్లు       → InputPurchase (seeds)
ఎరువులు / యూరియా        → InputPurchase (fertilizer)
మందు / పురుగు మందు      → InputPurchase (pesticide)
అమ్మకం / అమ్మిన         → CropSale
నీళ్ళు / నీటిపారుదల     → InputPurchase (irrigation)
PM-KISAN / సర్కారు       → GovernmentTransfer
```

---

## 6. Test Plan

- [ ] Voice FAB opens bottom sheet on Dabbu screen
- [ ] Waveform animates during recording
- [ ] Sarvam STT returns Telugu transcription (live API test)
- [ ] Amount extracted correctly from "రెండు కూలీలకు నాలుగు వందలు" → ₹800
- [ ] Parsed card shows correct kind, amount, description
- [ ] Confirm saves to STDB via record_money_event
- [ ] Idempotency key prevents double-tap duplicate
- [ ] Transaction appears in Dabbu timeline
- [ ] Balance updates after save
- [ ] Edit flow allows changing amount before save
- [ ] Offline fallback shows text input

---

## 7. Session Log

| Date | Session | What Happened | Next Step |
|------|---------|---------------|-----------|
| 2026-03-16 | Spec session | Created feature contract with full voice flow, Telugu parsing, state machine | Build in Wave 1 |
| 2026-03-16 | Build wave 1 | Built voice.ts (400 LOC), VoiceSheet.svelte (571 LOC), ParsedExpenseCard.svelte (272 LOC). Telugu parser passes all 7 tests including flagship "రెండు కూలీలకు నాలుగు వందలు"=₹800. State machine complete. Waveform ported from mockup. svelte-check: 0 err/0 warn. | Wire to live Sarvam STT |
