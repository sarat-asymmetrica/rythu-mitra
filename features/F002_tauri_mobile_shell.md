# F002 — Tauri v2 Android Mobile Shell

**Status:** ✅ Live
**Wave:** 0 (Foundation)
**Owner:** Commander + Claude
**Created:** 2026-03-16

---

## 1. User Story

As **Lakshmi**, I need an **app on my ₹10K Redmi phone that opens fast, looks familiar, and works even when my 3G drops**, so that **I trust it enough to use it every day alongside WhatsApp**.

---

## 2. Acceptance Criteria

- [ ] AC1: Tauri v2 project scaffolded with Android target, builds APK
- [ ] AC2: APK size < 15 MB (hard constraint — Lakshmi's phone has limited storage)
- [ ] AC3: App launches in < 3 seconds on Android 10+ emulator
- [ ] AC4: Matti design system tokens loaded (earth palette, Fibonacci spacing, Noto Telugu fonts)
- [ ] AC5: 4-screen navigation works (Home, Dabbu, Market, Panta) with bottom nav bar
- [ ] AC6: Voice FAB button renders and responds to tap (no actual recording yet — that's F004)
- [ ] AC7: Kolam background canvas renders without janking scroll
- [ ] AC8: Local SQLite initialized via Tauri for offline cache
- [ ] AC9: STDB SDK connects to a local/cloud SpacetimeDB instance
- [ ] AC10: Telugu text renders correctly (Noto Sans Telugu loaded)

---

## 3. Full-Stack Contract

### 3a. Schema (STDB Module)

Not modified by F002. But the client must:
- Import generated STDB SDK types from F001's published module
- Establish connection with `DbConnection.builder()`
- Subscribe to relevant tables (initially: `farmer`, `money_event`, `market_price`)

### 3b. Client (Svelte + Tauri) — THIS IS THE FEATURE

**Project structure:**

```
rythu_mitra/src/
├── client/
│   ├── src-tauri/              # Tauri Rust backend
│   │   ├── Cargo.toml
│   │   ├── tauri.conf.json     # App metadata, permissions, Android config
│   │   ├── gen/android/        # Generated Android project
│   │   └── src/
│   │       └── lib.rs          # Tauri commands (camera, mic, file access)
│   ├── src/                    # Svelte frontend
│   │   ├── App.svelte          # Root: screen router + bottom nav + FAB
│   │   ├── lib/
│   │   │   ├── db.ts           # STDB connection, stores, subscriptions
│   │   │   ├── stores.ts       # Svelte writable stores per table
│   │   │   └── engine/         # Living Geometry engine (placeholder → F003)
│   │   ├── screens/
│   │   │   ├── Home.svelte     # Morning briefing (from matti_v1 mockup)
│   │   │   ├── Dabbu.svelte    # Money tracking (from matti_v2 mockup)
│   │   │   ├── Market.svelte   # Mandi prices (from matti_v3 mockup)
│   │   │   └── Panta.svelte    # Crop journal (from matti_v4 mockup)
│   │   ├── components/
│   │   │   ├── BottomNav.svelte
│   │   │   ├── VoiceFab.svelte
│   │   │   ├── Toast.svelte
│   │   │   ├── KolamCanvas.svelte
│   │   │   └── BriefingCard.svelte
│   │   └── styles/
│   │       └── matti.css       # Design tokens (ported from 01_styles.css mockup)
│   ├── index.html
│   ├── package.json
│   ├── svelte.config.js
│   └── vite.config.ts
```

**Key patterns (from 001-Ledger client):**

```
Connection:
  connect() → store token in localStorage → register onInsert/onDelete
  callbacks BEFORE subscribe → subscribe to tables

Stores:
  One writable Svelte store per STDB table subscription
  Derived stores for computed values (e.g., balance from money_events)
  syncTable() helper that iterates and updates store
```

**Screen navigation:**

```
State machine:
  activeScreen: "home" | "dabbu" | "market" | "panta"

  Transition: fade-out current (144ms) → fade-in next (233ms)
  (Ported from 06_engine.js switchScreen() logic)

  Scroll position remembered per screen (WeakMap)
```

**Tauri commands (Rust side):**

```rust
#[tauri::command]
async fn capture_photo() -> Result<Vec<u8>, String>
// → Camera access for crop photos (F006)

#[tauri::command]
async fn record_audio(duration_ms: u32) -> Result<Vec<u8>, String>
// → Microphone access for voice notes (F004)

#[tauri::command]
async fn get_gps() -> Result<(f64, f64), String>
// → GPS for crop event location (F006)
```

These commands are STUBS in F002 — wired up in F004/F006.

### 3c. Design (Living Geometry / Matti)

**Tokens ported from mockup `01_styles.css`:**

```css
/* Earth Palette */
--matti: #8B4513;          --matti-light: #A0522D;
--pasupu: #E8A317;         --pasupu-soft: #F5D98E;
--neeli: #1B4F72;          --neeli-light: #2980B9;
--patti: #FAF7F0;          --patti-warm: #F5F0E6;
--nalupurugu: #D4C5A9;
--pacchi: #2D6A4F;         --pacchi-light: #40916C;
--erra: #C0392B;
--ittadi: #B8860B;

/* Ink Hierarchy */
--ink-primary: #1C1410;    --ink-secondary: #5D4E37;
--ink-tertiary: #8B7D6B;   --ink-faint: #B8A99A;

/* Typography */
--font-te: 'Noto Sans Telugu', sans-serif;
--font-te-display: 'Noto Serif Telugu', serif;
--font-mono: 'Courier Prime', monospace;

/* Fibonacci spacing: 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144 */
/* Fibonacci durations: 89, 144, 233, 377, 610, 987 ms */
```

**Components from mockup to port:**

| Mockup Element | Svelte Component | Source File |
|---|---|---|
| Bottom nav bar (4 items + FAB) | BottomNav.svelte | matti_app_prototype.html |
| Voice mic FAB (pasupu circle) | VoiceFab.svelte | 06_engine.js §07 |
| Mango-leaf toast | Toast.svelte | 06_engine.js §08 |
| Kolam dot grid background | KolamCanvas.svelte | 06_engine.js §02 |
| Briefing card (home screen) | BriefingCard.svelte | 02_screen_home.html |
| Balance strip | BalanceStrip.svelte | 02_screen_home.html |

**Animations preserved from mockup:**

- Card entrance: `opacity 0 → 1, translateY(15px → 0)` over 610ms with stagger
- Ripple on tap: brass-gold radial gradient, 610ms expand
- Screen transition: fade 144ms out + 233ms in
- Kolam canvas: 34px grid, golden-angle arcs on every 3rd dot

### 3d. AI Integration

N/A for F002. Voice FAB taps show a toast placeholder. Real AI wiring is F004.

---

## 4. Dependencies

- **Requires:** Nothing (parallel with F001, connects to F001 once published)
- **Soft-requires:** F001 (STDB module — can develop with mock data until F001 is live)
- **Blocks:** F004, F005, F006 (all user-facing features need the shell)

---

## 5. Architecture Notes

### Why Tauri v2 (not React Native, not Flutter, not PWA)

- **Size:** Tauri APKs are 2-8 MB base. Flutter is 15-20 MB minimum. React Native is 10-15 MB.
  Lakshmi's phone may have <1 GB free storage. Every MB matters.
- **WebView reuse:** Android's system WebView is already on every phone. No bundled runtime.
- **Rust bridge:** Camera, mic, GPS, and file system access via Tauri commands.
  Secure by default — explicit permission per command.
- **Web tech frontend:** Svelte compiles to tiny vanilla JS. The mockup engine.js (1158 lines)
  proves the entire interaction model works in pure web tech.
- **Offline:** Tauri + local SQLite + STDB offline queue = full offline capability.

### Why Svelte 5 (not React, not Vue)

- Smallest bundle size of any framework. Critical for 3G.
- Runes ($state, $derived) map naturally to STDB subscriptions.
- 001-Ledger and 003-AsymmFlow already use Svelte 5 — patterns transfer.
- No virtual DOM overhead — direct DOM updates, better on cheap hardware.

### Port strategy from mockups

The mockups (`matti_v1` through `matti_v4` + `matti_app_prototype.html`) are the
visual spec. The port strategy:

1. Extract `01_styles.css` → `matti.css` (design tokens, keep verbatim)
2. Extract each screen's HTML → individual `.svelte` component (structural port)
3. Extract `06_engine.js` → split into Svelte lifecycle hooks per component
4. Canvas elements (Kolam, donut chart, trend chart) → dedicated `<canvas>` components
5. Test on Android emulator with Telugu locale set

### Font loading strategy

Noto Sans Telugu is ~400KB. On 3G this matters.
- Bundle subset (basic Telugu + numerals + common punctuation) in the APK (~80KB)
- Load full font set lazily after first meaningful paint
- Fallback: system Telugu font (present on all Indian Android phones)

---

## 6. Test Plan

- [ ] **Build:** `cargo tauri android build` produces APK without errors
- [ ] **Size:** APK < 15 MB (measure with `ls -la`)
- [ ] **Launch:** App opens within 3 seconds on Android 10 emulator
- [ ] **Navigation:** Tap each nav item → correct screen shows with transition
- [ ] **Telugu:** Telugu text renders in both Noto Sans and Noto Serif variants
- [ ] **Kolam:** Background canvas renders 34px grid without scroll jank
- [ ] **FAB:** Voice button shows toast on tap
- [ ] **Toast:** Mango-leaf toast appears, bobs, auto-dismisses
- [ ] **Ripple:** Tap on card shows brass-gold ripple effect
- [ ] **STDB:** Client connects to published module (or shows "offline" gracefully)
- [ ] **Offline:** App loads and shows cached data when airplane mode is on

---

## 7. Session Log

| Date | Session | What Happened | Next Step |
|------|---------|---------------|-----------|
| 2026-03-16 | Spec session | Created full contract with project structure, component map, port strategy | Scaffold Tauri project |
| 2026-03-16 | Build wave 0 | Agent built 2,736 LOC across 23 files. 7 components, 4 screens, 3 canvases | Fix errors |
| 2026-03-16 | Fix wave 0.1 | Fixed Toast export (new toast.ts store), a11y (button+aria), Svelte 5 migration ($props), TS nulls, unused var. `vite build` 0 err/0 warn. `svelte-check` 121 files clean. | Wire to F001 STDB |
