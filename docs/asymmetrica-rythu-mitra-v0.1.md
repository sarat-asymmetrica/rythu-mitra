# Asymmetrica — Vernacular Business Platform for Underserved Entrepreneurs

**Implementation Plan v0.1 — Living Document**
**Date:** March 14, 2026
**Author:** Sarat (Asymmetrica AI) + Claude (thought partner)
**Status:** Concept crystallization → architecture → first build

---

## 1. The Core Thesis

Software has failed underserved entrepreneurs — not because they lack smartphones or connectivity, but because every product built for them either (a) asks them to learn new interaction patterns, (b) treats them as a demographic category rather than whole people, or (c) tries to replace WhatsApp instead of filling the gaps WhatsApp structurally cannot.

India has 63+ million micro and small enterprises. The vast majority run on a combination of WhatsApp (communication, ordering, record-keeping), a physical notebook (accounting), mental math (financial planning), and camera roll photos (documentation). UPI digitized their payments but not their accounting. YouTube became their knowledge base but not their decision-support system. Government apps were installed once and never opened.

**Our position:** We are not building a messenger. We are not building "an app for farmers." We are building a **vernacular-first, chat-native, AI-powered business management platform** where the interface is conversation and the output is structured, persistent, trustworthy data. Communication capabilities exist so participants can transact *in context* — but the product is the structured intelligence layer, not the messaging.

**The one-liner:** WhatsApp is for your life. This is for your livelihood.

---

## 2. Why This Is Different From Everything That Failed Before

### 2.1 The Arattai Lesson (Zoho, 2021–2025)

Zoho's Arattai messenger hit #1 on Indian app stores in September 2025 after government endorsement, with sign-ups surging from 3,000/day to 350,000/day. Within one month, it fell out of the top 100. DAUs peaked at ~2 lakh against WhatsApp's 500 million.

**What Arattai got right:** Indic language support, lightweight performance on budget devices, privacy-first positioning, a "Pocket" feature recognizing that people use messengers as filing cabinets.

**What Arattai got wrong:** Competed directly on communication — the one thing WhatsApp does well enough that nobody has a reason to switch. Didn't have end-to-end encryption for text chats despite a privacy pitch. Built a WhatsApp clone when they should have built something WhatsApp *can't be*.

**Our takeaway:** Never compete on the communication layer. Build on the *gap* — structured data, business logic, decision support — and let communication be a feature, not the product.

### 2.2 The Digital Khata / Farm App Graveyard

Every "digital khata" app for kirana stores and every "farm management" app follows the same pattern: download spike from a marketing push or government mandate, rapid abandonment because the app demands new behaviors (fill forms, categorize transactions, navigate menus) that are slower and less natural than the notebook + WhatsApp + memory system people already use.

**Our takeaway:** The interaction pattern must be the one they already use — talking, voice notes, photos. The system does the structuring. The user just... talks.

### 2.3 The ShareChat Signal

ShareChat proved that 100+ million Indians will adopt new apps if the app treats their language as a first-class citizen, not a translation. The conventional wisdom that "they'll only ever use WhatsApp" is wrong. The insight is that they'll only use something *new* if it offers something WhatsApp *can't*.

### 2.4 Why WhatsApp Can't Do This

WhatsApp is structurally unable to become a business management platform because:

- Meta's business model requires data. Ours doesn't.
- WhatsApp is a general-purpose communication tool. Adding business logic would confuse 2 billion users.
- WhatsApp's architecture stores messages on servers. Ours keeps business data on the device.
- WhatsApp can't run AI inference on conversations without accessing message content, which contradicts E2E encryption.
- WhatsApp Business exists but is designed for *customers messaging businesses*, not for *businesses managing themselves*.

---

## 3. Entry Point: AP/Telangana Telugu-Speaking Farmers

### 3.1 Why Farmers First

The farmer persona has the **largest delta** between "data that exists" and "data that's structured." Unlike kirana owners (who have notebooks) or artisans (who have Instagram), farmers have *nothing* — financial life, crop decisions, input purchases, labor costs, government subsidy tracking all exist in memory, scattered WhatsApp messages, and unorganized camera rolls.

Agriculture also has **single-player mode value**. A farmer doesn't need her network to join the platform first. Mandi prices, PM-KISAN status, pest identification, expense tracking — all of these deliver value on day one for a single user. The network effect comes later when input dealers, traders, and fellow farmers join, but it's not a prerequisite.

### 3.2 Why AP/Telangana First

- **Founder context:** Sarat is from a village near Renigunta. He speaks Telugu natively, can read technical documents in Telugu, and understands the cultural and agricultural context of Rayalaseema and coastal AP. Testing, iterating, and getting the *feel* right is dramatically easier.
- **Language strength:** Sarvam AI's Telugu models are strong. Telugu is one of India's most spoken languages — AP + Telangana represents ~85 million people, a market larger than most European countries.
- **Government alignment:** AP has historically championed technology adoption in agriculture. State-specific schemes (YSR Rythu Bharosa, AP e-market) provide immediate utility hooks.
- **Focused launch:** Narrow enough to be a focused cohort, large enough to be a meaningful market. Prove everything here, then expand to Kannada, Tamil, Hindi, Marathi as localization on a proven architecture.

### 3.3 The User: Lakshmi

**Lakshmi, 38, Anantapur district, AP.** Groundnut and cotton farmer, 4 acres dryland. Husband drives a lorry, away 20 days/month. Two school-age children. She is the household CFO, the farm manager, the school-fee tracker, the capital investment decision-maker. Her entire digital life is a ₹10-12K Redmi phone.

**Current software touchpoints:** WhatsApp (husband, farmer groups, input dealer, school group), YouTube (agricultural learning, entertainment), PhonePe (checking PM-KISAN deposits, UPI payments), camera (crop photos, price list photos), one government agriculture app installed and never opened. Zero financial tracking. All decisions based on memory and peer WhatsApp groups.

**The gap we fill:** Lakshmi generates business data every single day — labor payments, input purchases, crop observations, market prices, government transfers. That data currently has nowhere to land in structured form. We give it a home, through the interaction pattern she already knows: conversation.

---

## 4. Product Architecture

### 4.1 Interaction Model: Chat-Native Business Management

The app presents as a chat interface — familiar, vernacular-first, voice-note-friendly. But the "chats" aren't just conversations with people. They are conversations with the user's business domains:

- **"Panta" (Crop):** Voice note or photo → crop event logging, pest identification, input tracking, seasonal history
- **"Dabbu" (Money):** Voice note or UPI notification → expense/income categorization, running balance, cash flow view
- **"Market" (Mandi):** Automatic price feeds, MSP updates, comparison across mandis, historical trends
- **"Sarkar" (Government):** PM-KISAN status, crop insurance, scheme eligibility, application status
- **"People" (Contacts):** Actual P2P messaging with input dealers, traders, fellow farmers — but every conversation is *in context* of the business relationship

Each domain chat is powered by AI that understands Telugu voice notes, extracts intent, structures data, and confirms in natural Telugu. Most interactions are one or two turns.

### 4.2 A Day With the App: Lakshmi's Transformed Workflow

**5:00 AM** — Opens the app. A card in Telugu: "Rabi mandi prices updated: Groundnut ₹5,840/quintal (Anantapur), ₹5,920 (Kurnool)." She didn't search — the system knows her crop and district.

**7:00 AM** — Voice-notes into "Dabbu": "Rendu kooliga vaallu vastunnaru, okkodiki 400 rupayalu." System logs: Labor expense ₹800, today's date, linked to groundnut plot, rabi season. Confirmation in Telugu. Done.

**8:00 AM** — Takes a photo of pest damage in "Panta." AI identifies it (or flags for community help). Logged as a crop event with photo, GPS, date — linked to her field. Next season, she has a history.

**12:00 PM** — Asks in "Sarkar": "Naa PM-KISAN installment vachinda?" System checks and responds: "Inka raaledhu. Last installment June 14. Next expected: December."

**1:00 PM** — Forwards input dealer's WhatsApp photo to the app. OCR extracts product name and price. System cross-references: "Approved MRP ₹290. Dealer charging ₹320. ₹30 ekkuva." Information asymmetry now works *for* her.

**3:00 PM** — Opens "Dabbu" money view. UPI notifications passively categorized. "This month — Income: ₹12,400. Expenses: ₹6,200. Pending: school fees ₹3,500." First time she can *see* cash flow instead of holding it in her head.

**7:00 PM** — Husband calls about drip irrigation investment. She pulls up actual numbers: "Last rabi total input cost ₹18,000, labor ₹12,000." A capital decision made with *data*, not gut feel.

### 4.3 Technical Architecture

```
┌─────────────────────────────────────────────────┐
│                   USER'S PHONE                   │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Chat UI  │  │  Local   │  │  P2P Messenger │  │
│  │ (Telugu) │  │ SpaceTime│  │  (WebRTC/STDB) │  │
│  │          │  │ DB Lite  │  │                │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │                │          │
│       │         ┌────┴─────┐          │          │
│       │         │ Verified │          │          │
│       │         │ .NET     │          │          │
│       │         │ Kernels  │          │          │
│       │         └──────────┘          │          │
└───────┼──────────────┼────────────────┼──────────┘
        │              │                │
   ┌────▼────┐    ┌────▼─────┐    ┌────▼─────┐
   │ Sarvam  │    │ SpaceTime│    │  Direct   │
   │ API     │    │ DB Cloud │    │  P2P      │
   │ (STT +  │    │ (Sync    │    │  (No      │
   │  NLU)   │    │  layer)  │    │  server)  │
   └─────────┘    └──────────┘    └──────────┘
        │
   ┌────▼──────────────────────┐
   │ External Data APIs        │
   │ - Mandi prices (Agmarknet)│
   │ - PM-KISAN status         │
   │ - Weather (IMD)           │
   │ - Crop advisory           │
   └───────────────────────────┘
```

**Core components:**

- **Chat UI:** Lightweight, Telugu-first. Voice note input as primary mode. Minimal UI chrome — the conversation IS the interface. Targets Android 10+ on ₹10K devices. PWA or lightweight APK (< 15 MB).
- **Local SpacetimeDB Lite:** All structured business data lives on-device. Offline-first. Syncs to cloud when connectivity is available. The user's khata, crop log, expenses — all local, all theirs.
- **Verified .NET Kernels:** Formally verified computational kernels handle arithmetic, balance calculations, data integrity checks. Guarantees: Lakshmi's running total is provably correct, expense entries are atomic (they land fully or not at all), no data corruption. She doesn't know about formal verification. She just knows *the numbers are always right*.
- **Sarvam AI API:** Telugu speech-to-text, intent extraction, entity recognition, response generation. Called via API for each interaction. Short, transactional — mostly 1-2 turn flows. No conversation history stored on Sarvam's side.
- **P2P Messaging (WebRTC/STDB WebSockets):** Person-to-person communication is device-to-device. Messages do not transit through our servers. Privacy is architectural, not policy. We *cannot* read their messages because we never see them.
- **SpacetimeDB Cloud Sync:** Encrypted sync layer for backup and cross-device access. We hold encrypted blobs we cannot decrypt. The user's data is theirs — we are infrastructure, not a data company.
- **External Data APIs:** Government and market data piped in and presented conversationally. Mandi prices, weather, scheme status, crop advisories — all delivered proactively based on user context (crop, location, season).

### 4.4 The Data Philosophy

**We do not want their data.**

This is not a privacy policy. This is an architectural decision. Specifically:

- Business data (expenses, income, crop logs) → stored locally on device, encrypted sync to cloud as backup
- P2P messages → device-to-device, never touch our servers
- AI inference calls → sent to Sarvam for processing, not stored on our side, Sarvam's retention policy applies
- Usage analytics → minimal, anonymized, aggregate only (e.g., "X users in Anantapur district used pest ID this week")

**Why this matters:** Every competitor either harvests data for advertising (Meta/WhatsApp) or stores it in ways that create privacy risk (most startups). Our architecture makes data harvesting *impossible by design*. For a demographic that has been burned by Paytm, confused by WhatsApp's privacy policy changes, and is generally suspicious of "free apps that want your information" — "your data stays on your phone" is a trust signal that resonates deeply.

---

## 5. Differentiation Matrix

| Dimension | WhatsApp | Digital Khata Apps | Farm Management Apps | This Platform |
|---|---|---|---|---|
| Primary purpose | Communication | Accounting | Crop management | Unified business management |
| Interaction model | Chat (with humans) | Forms and menus | Forms and menus | Chat (with AI + humans) |
| Language approach | Translation layer | Basic Hindi/English | English-first | Telugu-native (then expand) |
| Data storage | Their servers | Their cloud | Their cloud | User's device (local-first) |
| Voice input | Voice notes (unstructured) | None | None | Voice notes → structured data |
| Offline capability | Message queue only | Limited/none | Limited/none | Full offline, sync when available |
| Network effect needed | Yes (can't message alone) | No | No | No (single-player value first) |
| Data privacy | Meta sees metadata | Startup sees everything | Startup sees everything | Architectural impossibility of access |
| Financial tracking | None | Yes (manual entry) | Partial | Automatic from conversation + UPI |
| Government scheme access | None | None | Partial (advisory only) | Direct status checks, eligibility, applications |
| Computational trust | N/A | Unverified | Unverified | Formally verified kernels |

---

## 6. Strategic Position Within Asymmetrica

This platform is **the open-source showcase** for Asymmetrica's core technology thesis: *logic in the substrate, truth in the database*.

- **SpacetimeDB** provides the persistent state layer — reducers for transactional integrity, WebSocket-based real-time sync, client-DB direct connection that eliminates heavy backend infrastructure.
- **Formally verified .NET kernels** provide the computational trust layer — arithmetic that's provably correct, data operations that are atomic, business logic that can't silently fail.
- **Sarvam AI** provides the natural language interface layer — but as a stateless compute function on top of the verified substrate, not as the source of truth.

This is the Asymmetrica architecture applied to the most challenging deployment context possible: cheap hardware, intermittent connectivity, non-English languages, zero technical literacy users. If it works here, it works anywhere. And the open-source cookbooks that emerge from this build become the proof that the architecture is real — "here's the plane flying."

For the broader Asymmetrica product ecosystem:
- **runtime.asymmetrica.ai** provides the verified kernel infrastructure
- **asymmflow.asymmetrica.ai** serves professionals and SMBs (the "Ramesh" and "Reshma" personas graduate here as they grow)
- **This platform** serves the underserved base — the farmers, micro-entrepreneurs, and small-town business owners who will never use a SaaS product but desperately need structured business management

The three surfaces share the same substrate. Different interfaces for different demographics, same truth layer underneath.

---

## 7. Go-to-Market: How Does Lakshmi Find This?

### 7.1 The Trust Chain

Adoption in this demographic follows trust networks, not app store discovery. The path:

1. **Seed through agricultural extension workers and FPOs (Farmer Producer Organizations).** AP has an active extension network. One worker who installs the app on 20 farmers' phones and shows them a 3-minute Telugu demo = 20 activated users, each of whom tells their neighbor.
2. **YouTube Telugu agricultural content.** This is where farmers *already* learn. Short Telugu videos showing a real farmer using voice notes to track expenses, check mandi prices, identify pests. Not polished marketing — raw, authentic, "look what this app does" content. The same format they already trust.
3. **WhatsApp group seeding.** A shareable Telugu infographic or 30-second video clip that can propagate through the farmer WhatsApp groups that already exist. "Mee phone lo mee vyapaaram" (Your business, on your phone).
4. **Government channel alignment.** AP's agriculture department, Digital India programs, state-level rural development initiatives. The product aligns perfectly with policy goals. The Chandrababu Naidu connection (long-term, not launch-dependent) represents a potential policy champion.
5. **Word of mouth.** The most powerful channel. If Lakshmi uses the app to catch an input dealer overcharging by ₹30/bag, she tells Venkatamma. Venkatamma tells the whole village. This is how adoption works in rural India — one compelling story at a time.

### 7.2 Onboarding

Must be completable in under 2 minutes on a ₹10K phone:

1. Install (< 15 MB APK, available on Play Store + direct APK download for those without Play Store access)
2. Phone number verification (OTP — they know this pattern from UPI)
3. Select language (Telugu pre-selected based on phone language, but explicit choice)
4. Select district (Anantapur, Kurnool, Prakasam, etc.)
5. Voice-note prompt: "Meeru em pantalu vestunnaru?" (What crops do you grow?) — this single interaction seeds the crop context, season, and triggers relevant mandi price feeds
6. Done. First mandi price card appears immediately. App is useful in 30 seconds.

No email. No profile photo. No social graph import. No tutorial screens. No permissions beyond microphone and camera.

---

## 8. Business Model

### 8.1 Principles

- **Free for core usage.** Expense tracking, mandi prices, crop logging, basic AI interactions — free, forever. This is the social impact layer and the adoption driver.
- **No advertising.** Ever. The business model is not attention harvesting.
- **No data selling.** Architecturally impossible, as described above.

### 8.2 Revenue Paths (Future, Post-Adoption)

- **Premium AI features:** Deeper crop advisory, predictive analytics, season planning — powered by heavier Sarvam model calls. Pay-as-you-go credits, Asymmetrica's standard model.
- **B2B data insights (anonymized, aggregate only):** Input companies, government agencies, and agricultural researchers would pay for anonymized, aggregate insights — "What percentage of Anantapur groundnut farmers reported bollworm this rabi?" No individual data, ever. Only statistical patterns with sufficient k-anonymity.
- **Platform transaction fees:** When the network effect materializes and farmers transact with input dealers, traders, and FPOs through the platform — a thin transaction facilitation fee. Think UPI-thin, not marketplace-fat.
- **Government and institutional partnerships:** State agriculture departments, NABARD, FPOs paying for deployment and integration with their schemes and programs.
- **Graduation to AsymmFlow:** As micro-entrepreneurs grow — Ramesh's kirana expanding, Reshma's artisan business formalizing — they graduate to AsymmFlow for full ERP/CRM. The farmer platform is the top of the funnel for the broader Asymmetrica ecosystem.

---

## 9. Implementation Phases

### Phase 0: Architecture Validation (Weeks 1–4)

- Stand up SpacetimeDB local-first architecture on a test Android device
- Validate Sarvam Telugu STT accuracy on agricultural vocabulary voice notes
- Build one end-to-end flow: Telugu voice note → structured expense entry → local storage → Telugu confirmation
- Test on ₹10K Android device over 3G/4G
- Establish P2P messaging proof-of-concept via STDB WebSockets

**Exit criteria:** One voice note in Telugu becomes one correct, persistent, queryable data entry on a cheap phone.

### Phase 1: Core MVP (Weeks 5–12)

- "Dabbu" (Money) chat: voice note expense/income tracking, UPI notification parsing, running balance, monthly summary
- "Panta" (Crop) chat: photo-based crop event logging, basic pest identification (Sarvam vision or community fallback), seasonal timeline
- "Market" chat: automated mandi price feeds for user's crop and district (Agmarknet API integration)
- Telugu voice + text interface throughout
- Local-first storage with encrypted cloud backup
- Basic onboarding flow (< 2 minutes)
- APK under 15 MB

**Exit criteria:** 10 real farmers in Anantapur district use the app daily for 2+ weeks without hand-holding.

### Phase 2: Expansion + Network (Weeks 13–24)

- "Sarkar" (Government) chat: PM-KISAN status, crop insurance integration, scheme eligibility
- P2P messaging: farmer-to-dealer, farmer-to-trader communication in context
- MRP cross-referencing for input purchases
- Verified .NET kernel integration for all arithmetic and balance operations
- Weather integration (IMD API) with proactive alerts
- Community features: pest identification crowd-sourcing within district groups

**Exit criteria:** 500+ active users in AP/Telangana. Measurable reduction in information asymmetry (users reporting price discrepancies, checking scheme status). At least one organic word-of-mouth growth signal.

### Phase 3: Scale + Second Language (Weeks 25–40)

- Kannada localization (Karnataka farmer cohort — natural geographic adjacency)
- Hindi localization (opens UP, MP, Rajasthan)
- Premium AI features (deeper crop advisory, season planning)
- B2B aggregate insights pilot
- FPO and extension worker partnership program
- AsymmFlow graduation pathway for growing micro-enterprises

**Exit criteria:** Multi-language platform serving 5,000+ active users. Revenue from at least one path. Clear evidence of single-player value + emerging network effects.

---

## 10. What This Becomes

Start narrow: Telugu-speaking farmers in Andhra Pradesh.

But the *model* is universal. A vernacular-first, chat-native, AI-powered, local-first business management platform for underserved entrepreneurs is needed everywhere:

- **India:** Kirana owners (Hindi, Marathi, Tamil), artisans (Rajasthani, Bengali), fishermen (Kerala, Goa), street food vendors
- **Southeast Asia:** Smallholder farmers in Indonesia, market traders in Vietnam, micro-entrepreneurs in Philippines
- **Africa:** Farmers in Kenya and Nigeria, traders in West African markets, artisans across the continent
- **Latin America:** Smallholder farmers in Brazil, market vendors in Mexico, micro-entrepreneurs in Colombia

The specific implementation changes. The architecture, the philosophy, and the model don't. Formally verified computation, local-first data, vernacular AI interface, communication as a feature not a product.

**This is Asymmetrica's thesis applied at the base of the pyramid: logic in the substrate, truth in the database, language as the interface, and the user's data on the user's device.**

---

## Appendix A: Naming Exploration

The name must feel like *theirs* — a word Lakshmi would use naturally, not a tech brand.

Telugu candidates to explore:

- **Pantam** (పంటం) — harvest, crop, livelihood
- **Bandi** (బండి) — cart, vehicle — metaphor for "the thing that carries your business"
- **Vennela** (వెన్నెల) — moonlight — poetic but perhaps too abstract
- **Poddu** (పొద్దు) — dawn, the working day — "your working day, organized"
- **Rekka** (రెక్క) — wing — "wings for your livelihood"

Cross-language candidates (should feel natural in Telugu but also work as you expand):

- **Phalak** — slate/board (Hindi/Sanskrit origin, understood across languages) — callback to the school slate, the original "interface"
- **Hisaab** — accounts/reckoning (Urdu/Hindi, widely understood) — direct reference to what the app does

*Final naming decision deferred — needs testing with actual target users.*

---

## Appendix B: Key Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Sarvam Telugu STT accuracy on agricultural dialect | High | Early testing with real voice samples from Anantapur; fallback to text input; community correction mechanism |
| Adoption requires behavior change despite chat-native design | High | Seed through trusted intermediaries (extension workers, FPOs); ensure < 30 second time-to-value on first use |
| Government API reliability (Agmarknet, PM-KISAN) | Medium | Cache aggressively; graceful degradation; manual fallback options |
| P2P architecture complexity on low-end devices | Medium | Progressive enhancement — start with server-relayed messaging, migrate to true P2P as architecture matures |
| Connectivity in rural AP | Medium | Offline-first architecture; all core features work without internet; sync on reconnect |
| Competition from WhatsApp adding business features | Low-Medium | WhatsApp's business features target businesses serving customers, not self-management. Architectural constraints (Meta's data model) prevent them from building what we're building |
| Scaling beyond AP/Telangana requires new language models | Medium | Sarvam's multi-language support; architecture designed for language-agnostic core with pluggable language layers |

---

## Appendix C: The Philosophical Foundation

This project inherits Asymmetrica's core philosophical commitments:

**From Advaita Vedanta:** The distinction between vyavaharika (transactional reality) and paramarthika (ultimate reality) maps directly to our architecture. The chat interface is vyavaharika — the transactional surface through which the user experiences the system. The verified substrate is paramarthika — the invariant truth layer that doesn't change regardless of how you interact with it. The user sees conversation. The system maintains truth.

**From the Asymmetrica thesis ("logic in the substrate, truth in the database"):** The farmer's data is the truth. The AI is a stateless interpreter. The verified kernels are the logic. Nothing is improvised at the layer that matters. The numbers are always right not because we try hard, but because the system is designed so they *cannot* be wrong.

**From the open-source commitment:** This will be built in the open. The architecture, the code, the methodology — all public. "Show the plane flying, hand off the blueprints." If the model works for AP farmers, anyone should be able to adapt it for their own context. Asymmetrica's moat is not secrecy — it's the substrate.

---

*This is a living document. Version 0.1 captures the concept as crystallized on March 14, 2026. It will evolve as we validate assumptions, test with real users, and learn from what doesn't work.*

*Next actions:*
- *Sarat: Review, annotate, share with Rahul and Oindrilla for feedback*
- *Technical: Sarvam Telugu STT accuracy test on agricultural voice samples*
- *Technical: SpacetimeDB local-first Android proof-of-concept*
- *Research: AP government scheme API availability and documentation*
- *Research: FPO network mapping in Anantapur and Kurnool districts*


Love this. Let’s turn all of this into something you can actually start wiring up from the terminal.

---

## 1. Core stack decisions

**Backend:**
- **SpacetimeDB 2.x** for real-time state + reducers.
- OCR microservice (Rust or Go) behind HTTP.
- AI gateway for:
  - **Sarvam 105B** (reasoning, onboarding, pedagogy).
  - **Saaras V3** (STT).
  - **Mayura** (translation).

**Client:**
- **Tauri v2** mobile-first app (Android first, iOS later).
- WebView UI (Svelte/React/Vanilla).
- Local **SQLite** for offline cache.

**Storage:**
- SpacetimeDB tables for:
  - Farmer profiles, context, workflows.
  - Documents (byte streams + metadata).
  - Learning profiles + curriculum.
- Optional object storage for large images.

---

## 2. Phase 1 – Skeleton: backend + mobile shell

### 2.1 SpacetimeDB project

**Tables (first pass):**

- **farmers**
  - `id`, `name`, `phone`, `village`, `language`, `literacy_level`, `created_at`

- **farmer_context**
  - `farmer_id`, `crops`, `acres`, `plots`, `irrigation`, `labour_pattern`, `buyers`, `dealers`, `bank`, `season_stage`, `pain_points`, `raw_story_json`

- **documents**
  - `id`, `farmer_id`, `kind`, `bytes`, `ocr_text`, `structured_fields_json`, `created_at`, `hot_cold_state`

- **learning_profile**
  - `farmer_id`, `literacy_level`, `preferred_mode`, `pace`, `topics_needed_json`, `last_updated`

- **curriculum_items**
  - `id`, `farmer_id`, `topic`, `stage`, `content_te`, `source_url`, `citations_json`, `status`, `created_at`

**Reducers (first pass):**

- `onboard_farmer_start`
- `onboard_farmer_update_schema`
- `store_document`
- `update_document_ocr`
- `update_learning_profile`
- `add_curriculum_item`

---

### 2.2 Tauri v2 app skeleton

From terminal:

```bash
cargo install create-tauri-app
create-tauri-app farmer-erp
# choose mobile template
cd farmer-erp
tauri android init
```

First features:
- Basic chat UI screen.
- Local SQLite setup.
- Simple “ping SpacetimeDB” reducer call.

---

## 3. Phase 2 – AI-led onboarding flow

### 3.1 Onboarding chat protocol

**Client responsibilities:**
- Capture text/voice (Saaras V3 for STT).
- Send messages + current partial schema to AI gateway.
- Render AI messages + “soft checklist” views.
- On farmer confirmation → call `onboard_farmer_update_schema`.

**AI gateway:**
- System prompt: “Onboarding mode” (schema + story).
- Tools:
  - `update_farmer_schema(farmer_id, fields_json)`
  - `append_farmer_story(farmer_id, story_chunk)`
- Output:
  - Next question.
  - Updated schema snapshot.
  - Edge-case notes.

**SpacetimeDB:**
- `farmers` + `farmer_context` updated incrementally.
- After onboarding complete → set `season_stage`, `primary_crops`, etc.

---

## 4. Phase 3 – Document pipeline (OCR + byte streams)

### 4.1 Client-side

- Capture image via camera.
- Compress + resize in Rust (Tauri command).
- Encode to byte array.
- Store locally (SQLite) as “pending_upload”.
- Call `store_document` reducer with:
  - `kind`, `bytes`, `farmer_id`, `created_at`.

### 4.2 Backend-side

- `store_document`:
  - Persist bytes + metadata.
  - Enqueue OCR job.

- OCR service:
  - Pulls document.
  - Runs OCR.
  - Extracts:
    - date, amount, quantity, crop, buyer/seller, etc.
  - Calls `update_document_ocr`.

- `update_document_ocr`:
  - Store `ocr_text`, `structured_fields_json`.
  - Optionally mark `hot_cold_state = "hot"`.

### 4.3 Hot → cold lifecycle

- Cron/reducer:
  - After N days, mark old docs as `cold`.
  - Optionally drop PNG cache on device; keep bytes + metadata.

---

## 5. Phase 4 – Learning engine (“learn mode”)

### 5.1 Scraper → knowledge store

- Simple scraper (Rust/Go/Python) that:
  - Fetches: agri advisories, schemes, pest alerts, mandi news.
  - Stores raw HTML/text in a `knowledge_items` table:
    - `id`, `source`, `url`, `raw_text`, `tags`, `created_at`.

### 5.2 Sarvam “learn mode” pipeline

For each farmer (or batch):

1. Fetch:
   - `farmer_context`
   - `learning_profile`
   - recent `knowledge_items`.

2. Call Sarvam 105B with system prompt:
   - “You are in LEARN MODE. Given farmer profile + knowledge items, select relevant items, summarize, contextualize, and generate Telugu content with citations.”

3. For English-only content:
   - Pipe through Mayura translation → Telugu.

4. Store in `curriculum_items`:
   - `topic`, `stage`, `content_te`, `source_url`, `citations_json`.

### 5.3 Client-side learning UI

- “Today’s learning” section on home screen:
  - 2–3 items max.
- Each item:
  - Short explanation.
  - “Explain more” button.
  - “Mark as understood / not relevant”.

- Feedback updates `learning_profile`:
  - Pace, depth, topic preferences.

---

## 6. Phase 5 – Home screen & modes of operation

### 6.1 Second login home screen

Based on:

- `season_stage`
- `primary_crops`
- `pending_docs`
- `curriculum_items`
- `recent expenses/sales`

Show:

- **Top strip:** “Today” (weather, key alert, one learning item).
- **Middle:** Quick actions:
  - Add expense
  - Add sale
  - Upload bill
  - Ask a question
- **Bottom:** “Your farm this season” (profit snapshot, tasks).

### 6.2 Modes of operation

- **Record mode:** expenses, sales, labour, inventory.
- **Learn mode:** curriculum, Q&A, explanations.
- **Recall mode:** documents, PDFs, history.
- **Plan mode:** crop planning, what-if, next season.

All share the same context + schema.

---

## 7. Phase 6 – PDFs & reports

### 7.1 Local PDF generation (Tauri/Rust)

- Use a Rust PDF crate.
- Generate:
  - Season summary.
  - Expense report.
  - Sales ledger.
  - Loan support doc.
  - Insurance claim packet.

- Store:
  - Locally (for offline).
  - In SpacetimeDB as `generated_documents` with metadata.

---

## 8. Phase 7 – Hardening & field reality

- Add offline-first sync queue with:
  - Retries.
  - Conflict resolution (server wins + local patch).
- Add basic telemetry (without PII).
- Test on:
  - 2–3 low-end Android phones.
  - Patchy 3G/4G.
- Do 1–2 real farmer pilots:
  - Observe onboarding.
  - Observe document capture.
  - Observe learning usage.

---

If you want, next step we can zoom into **one concrete thing** you can start coding today—e.g.:

- SpacetimeDB schema + first reducers, or  
- Tauri v2 project + local SQLite + simple chat loop.

Tell me which one you want to crack open first from the terminal.