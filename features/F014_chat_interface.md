# F014 — Collapsible Chat Interface (The Product's Heart)

**Status:** 📋 Specced
**Wave:** 2 (Intelligence)
**Owner:** Commander + Claude
**Created:** 2026-03-16

---

## 0. Philosophy — Why This Changes Everything

> "People know what they want to GET DONE, not how to do it."
> — Commander, March 16, 2026

The current app has screens that show data and a voice button that records expenses. This treats Lakshmi as someone who already knows what tool she needs. She doesn't. She has a *situation* — "I need to figure out when to sell my groundnut" or "that dealer bill seemed expensive" or just "what should I do today?" — and she needs a companion who understands her context, presents options, and helps her act.

**The chat interface IS the product.** The screens (Home, Dabbu, Market, Panta) become *views into the data*, but the chat is how Lakshmi *interacts* with her farm business. One familiar interface — the same pattern she uses 50 times a day on WhatsApp — that handles everything.

### Core Design Principles

1. **Friend, not cold intelligence.** Warm, patient, encouraging. "అయ్యో, ఆ డీలర్ ₹20 ఎక్కువ వేస్తున్నాడు!" not "Price discrepancy detected: +₹20."
2. **Present options, not just answers.** "Sell or wait?" → "ధర MSP కంటే ₹240 ఎక్కువ. ట్రెండ్ పైకి ఉంది. రెండు ఆప్షన్లు: (1) ఇప్పుడు అమ్మితే ₹5,840/q (2) వారం వేచి ఉంటే ₹5,900-6,000 possible. మీ ఇష్టం!"
3. **If you don't know, say so.** "అది నాకు ఖచ్చితంగా తెలియదు. గూగుల్‌లో చెక్ చేస్తాను..." (I'm not sure about that. Let me check Google...)
4. **Read the DB first.** Every response is grounded in Lakshmi's actual data — her balance, her crops, her expenses, her season. No generic advice.
5. **Proactive intelligence.** Don't just respond — notice things. "మీరు 2 నెలలుగా PM-KISAN చెక్ చేయలేదు. చెక్ చేయమంటారా?"

---

## 1. User Story

As **Lakshmi** (38, Anantapur, groundnut/cotton farmer),
I want to **talk to my app like I talk to a knowledgeable friend — in Telugu, by voice or text, about anything related to my farm**,
so that **I get help with recording expenses, understanding markets, making decisions, and navigating government schemes, all through one conversation.**

---

## 2. Acceptance Criteria

### Chat Core
- [ ] AC1: Collapsible chat bar at bottom of every screen (above nav bar)
- [ ] AC2: Tap to expand into full chat view with conversation history
- [ ] AC3: Three input modes: 🎤 voice, ⌨️ text, 📸 camera/file
- [ ] AC4: Messages persist in localStorage (conversation history survives refresh)
- [ ] AC5: AI responds in Telugu (Sarvam 105B)
- [ ] AC6: Streaming response — text appears word-by-word (SSE)

### Intent Handling
- [ ] AC7: RECORD intents → inline confirmation card (amount, category, ✓/✏️)
- [ ] AC8: ASK intents → answers from DB data (balance, summary, prices)
- [ ] AC9: CONSULT intents → reasoned advice with options (not commands)
- [ ] AC10: UPLOAD intents → camera opens, image processed (OCR or vision)
- [ ] AC11: SOCIAL intents → warm greeting + proactive info (today's prices, alerts)
- [ ] AC12: UNKNOWN intents → "నాకు అర్థం కాలేదు. ఇలా అడగండి: ..." with examples

### Context Awareness
- [ ] AC13: System prompt includes live DB context (balance, crops, season, recent events)
- [ ] AC14: System prompt includes current screen context (Dabbu → financial, Panta → crop)
- [ ] AC15: AI knows farmer's name, village, district, crops, season
- [ ] AC16: Multi-turn conversations maintain context (SLERP chain from vedic_qiskit)

### Web Search Augmentation
- [ ] AC17: When AI knowledge is insufficient, triggers Google search
- [ ] AC18: Search results summarized in Telugu and cited
- [ ] AC19: Agricultural queries prioritized (pest treatment, government schemes, weather)

### Proactive Intelligence
- [ ] AC20: On greeting, share relevant proactive info (price changes, scheme alerts)
- [ ] AC21: Detect patterns: "You've spent ₹3,200 on labor this month, up 40% from last month"
- [ ] AC22: Seasonal nudges: "Harvest window opening in 2 weeks for groundnut"

### Persistent Memory (à la Claude Web)
- [ ] AC23: AI stores observations about farmer preferences/patterns via {"action":"remember",...}
- [ ] AC24: Memories injected into system prompt (farmer context section)
- [ ] AC25: Settings screen shows "నా జ్ఞాపకాలు" (My Memories) — viewable + dismissable
- [ ] AC26: farmer_memory table in STDB with free-form content, source, confidence
- [ ] AC27: Farmer can manually add memories ("జ్ఞాపకం జోడించు")
- [ ] AC28: Max ~30 active memories, oldest low-confidence auto-pruned
- [ ] AC29: Memories carry across conversations (persistent in DB, not just localStorage)

---

## 3. Full-Stack Contract

### 3a. Schema (STDB Module)

New tables needed:

```
chat_message
  - id: u64 (auto-increment)
  - farmer_id: Identity
  - role: string ("user" | "assistant" | "system")
  - content: string (Telugu text)
  - intent: string ("record" | "ask" | "consult" | "upload" | "social" | "unknown")
  - metadata_json: string (parsed expense, search results, etc.)
  - created_at: Timestamp
  INDEX: btree on farmer_id

farmer_memory
  - id: u64 (auto-increment)
  - farmer_id: Identity
  - content: string (free-form observation in Telugu/English)
  - source: string ("ai_observed" | "farmer_stated" | "pattern_detected")
  - confidence: f64 (0.0 to 1.0 — how certain is this memory)
  - active: bool (true = included in system prompt, false = dismissed by farmer)
  - created_at: Timestamp
  - last_used_at: Timestamp (updated each time memory is used in a response)
  INDEX: btree on farmer_id
```

**Why farmer_memory is deliberately loose/unstructured:**

Commander's principle: "if we try to dictate storage too rigidly, the user may not have the
expertise and the AI is constrained." The `content` field is FREE-FORM text. The AI decides
what to store. Examples of what might end up there:

```
"లక్ష్మి ఎల్లప్పుడూ శనివారం కూలీలకు చెల్లిస్తుంది" (Lakshmi always pays laborers on Saturday)
"రామకృష్ణ ఫర్టిలైజర్స్ dealer — often overcharges by ₹10-20 on urea"
"Son's school fees due every June — approximately ₹3,500"
"Prefers borewell irrigation advice over flood irrigation"
"Sells groundnut to Venkatesh trader at Anantapur mandi"
"Gets anxious about money in April — pre-harvest cash crunch period"
"PM-KISAN usually arrives in June and December"
"She said she wants to try drip irrigation next rabi season"
```

The AI stores observations via an action block: {"action":"remember","content":"...","source":"ai_observed"}
The AI recalls memories by reading them from the system prompt context section.

New reducers:
```
save_chat_message(role, content, intent, metadata_json)
  → requires caller identity

save_memory(content, source, confidence)
  → requires caller identity
  → auto-sets active=true, created_at, last_used_at

dismiss_memory(memory_id)
  → requires caller identity, must own the memory
  → sets active=false (soft delete — farmer can see dismissed memories too)
```

**Memory in System Prompt:**

Memories are injected into Section 2 (Live Farmer Context):
```
═══ MEMORIES (మీ గురించి నాకు తెలిసినవి) ═══
• లక్ష్మి ఎల్లప్పుడూ శనివారం కూలీలకు చెల్లిస్తుంది
• రామకృష్ణ ఫర్టిలైజర్స్ — sometimes overcharges on urea
• Son's school fees ~₹3,500 due June
• Wants to try drip irrigation next rabi
[{count} memories active. Farmer can view/dismiss in Settings.]
```

**Memory in Settings Screen:**

A "నా జ్ఞాపకాలు" (My Memories) section in Settings:
- List of all active memories with dismiss (X) button
- Dismissed memories shown in a collapsed "తొలగించినవి" section (recoverable)
- "జ్ఞాపకం జోడించు" (Add memory) button for farmer to manually tell the AI something

**Memory Guidelines for AI (in system prompt):**

```
MEMORY RULES:
- Store observations that will be useful in FUTURE conversations
- DO NOT store every transaction (that's what money_events is for)
- DO store: preferences, patterns, relationships, plans, concerns, deadlines
- Source "ai_observed" = you noticed it (e.g., she always pays on Saturdays)
- Source "farmer_stated" = she explicitly told you (e.g., "I want to try drip irrigation")
- Source "pattern_detected" = computed from data (e.g., "expenses spike in April")
- Confidence 0.9+ = very certain (she said it directly)
- Confidence 0.5-0.8 = likely (pattern from 3+ occurrences)
- Confidence <0.5 = tentative (observed once, might change)
- Max ~30 active memories (oldest low-confidence ones auto-pruned)
- If a memory seems wrong, UPDATE it rather than creating a duplicate
```

### 3b. Client (Svelte + Tauri)

**New components:**

| Component | Purpose |
|-----------|---------|
| `ChatBar.svelte` | Collapsed state: single line "💬 అడగండి..." above nav. Tap to expand. |
| `ChatPanel.svelte` | Expanded state: full conversation view with message list + input |
| `ChatMessage.svelte` | Single message bubble (user right, assistant left, system center) |
| `ChatInput.svelte` | Text input + mic button + camera button. Multi-line. |
| `ConfirmCard.svelte` | Inline in assistant bubble: parsed expense/event with ✓/✏️ actions |
| `OptionsCard.svelte` | Inline: numbered options for consult responses |
| `SearchResultCard.svelte` | Inline: web search results with source citation |

**Replace VoiceSheet with ChatPanel:**
- VoiceSheet.svelte → deprecated (voice moves INTO ChatInput)
- VoiceFab → becomes the mic button inside ChatInput
- Voice recording happens inline — waveform shows in ChatInput area

**State machine:**

```
ChatBar (collapsed)
  ↓ tap
ChatPanel (expanded)
  ├── idle (waiting for input)
  ├── recording (mic active, waveform in input area)
  ├── transcribing (STT processing)
  ├── thinking (AI processing, streaming dots)
  ├── responding (streaming text appearing)
  ├── confirming (confirmation card shown, waiting for user action)
  └── searching (web search in progress)
```

**Screen-aware context:**
```typescript
function getScreenContext(activeScreen: string): string {
  switch (activeScreen) {
    case 'home': return 'User is on the morning briefing. Focus on overview, alerts, proactive info.';
    case 'dabbu': return 'User is on the money screen. Assume financial intent: expenses, income, balance.';
    case 'market': return 'User is on the market screen. Assume price queries, sell/wait decisions.';
    case 'panta': return 'User is on the crop screen. Assume crop events, pest questions, farming advice.';
    default: return '';
  }
}
```

### 3c. Design (Living Geometry / Matti)

**Chat bar (collapsed):**
- Height: 55px (Fibonacci)
- Background: --patti-warm with subtle --nalupurugu border-top
- Text: --ink-tertiary, "💬 అడగండి..." (Ask...)
- Tap animation: spring expand (377ms)

**Chat panel (expanded):**
- Takes bottom 60% of screen (golden ratio: 62%)
- Draggable handle at top (like a bottom sheet)
- Background: --patti with subtle Kolam texture at 5% opacity

**Message bubbles:**
- User (right): --matti background, white text, wabi-sabi border-radius
- Assistant (left): --patti-warm background, --ink-primary text, --pacchi left border
- System (center): no bubble, --ink-tertiary text, small

**Confirmation card (inline):**
- Same design as current ParsedExpenseCard but inside the chat bubble
- --patti-warm background, --pacchi confirm button, --neeli edit button

**Streaming text:**
- Cursor blink animation (--pasupu color, 987ms period)
- Text appears with 21ms stagger per character cluster

### 3d. AI Integration — THE SYSTEM PROMPT

**Model:** Sarvam 105B (`sarvam-105b` via `api.sarvam.ai/v1/chat/completions`)
**Streaming:** SSE (server-sent events)
**Temperature:** 0.7 (warm, creative but grounded)

**System prompt structure (built dynamically on each message):**

```
═══ SECTION 1: PERSONA ═══

నీ పేరు రైతు మిత్ర (Rythu Mitra). నువ్వు ఆంధ్ర ప్రదేశ్/తెలంగాణ రైతులకు
సహాయం చేసే స్నేహితుడివి. నువ్వు cold AI కాదు — నువ్వు Lakshmi కుటుంబంలో
ఒక member లాంటివాడివి, వ్యవసాయం, ఆర్థిక, market intelligence లో expert.

You are Rythu Mitra (Farmer's Friend). You are an expert generalist friend
to Telugu-speaking farmers in AP/Telangana. You are warm, patient, encouraging.
You speak in simple Telugu that a farmer with basic literacy can understand.

PERSONALITY:
- Warm and caring — this is someone's livelihood, treat it with respect
- Patient — if they're confused, explain again simply, don't rush
- Encouraging — celebrate small wins ("బాగుంది! ₹8,500 పత్తి అమ్మకం 👏")
- Honest — if you don't know, say "నాకు ఖచ్చితంగా తెలియదు" and offer to search
- Proactive — notice patterns, suggest opportunities, warn about risks
- Friend, not servant — "ఒక suggestion ఇవ్వనా?" not "command me"

LANGUAGE:
- Always respond in Telugu (తెలుగు)
- Use simple words (not literary Telugu)
- Numbers in ₹ format with Indian grouping (₹12,400 not ₹12400)
- Crop names in Telugu (వేరుశెనగ not groundnut)
- Mix English technical terms naturally (PM-KISAN, UPI, MSP — farmers know these)

═══ SECTION 2: LIVE FARMER CONTEXT (from STDB) ═══

FARMER: {name}, {village}, {district}
CROPS: {crops} ({acres} ఎకరాలు, {irrigation_type})
SEASON: {season_stage} ({season})

FINANCIAL SNAPSHOT:
  ఈ సీజన్ ఆదాయం: ₹{total_income}
  ఈ సీజన్ ఖర్చు: ₹{total_expense}
  బ్యాలెన్స్: ₹{balance}

  Recent transactions (last 5):
  {recent_transactions}

MARKET SNAPSHOT:
  {crop1}: ₹{price1}/q ({mandi1}) — MSP ₹{msp1} ({above_below1})
  {crop2}: ₹{price2}/q ({mandi2}) — MSP ₹{msp2} ({above_below2})
  7-day trend: {trend_direction} {trend_amount}

ACTIVE SCREEN: {screen_name} — {screen_context}

═══ SECTION 3: CAPABILITIES (what you CAN do) ═══

You can help the farmer with:

1. RECORD expenses/income:
   When the farmer mentions money (amounts, payments, sales), extract:
   - amount (in rupees)
   - kind: LaborPayment | InputPurchase | CropSale | GovernmentTransfer | UPIPayment | Other
   - is_income: true for sales/subsidies, false for expenses
   - party_name: if mentioned
   - description: original Telugu text

   Respond with a confirmation: "₹{amount} {kind_telugu}. సరేనా?"
   Include a JSON action block: {"action":"record_money","amount_paise":N,"kind":"...","is_income":bool,"description":"...","party":"..."}

2. RECORD crop events:
   When the farmer mentions farming activities, extract:
   - kind: Planted | Sprayed | PestObserved | Irrigated | Harvested | Sold
   - crop, plot, description

   Respond with confirmation and JSON: {"action":"record_crop","kind":"...","crop":"...","description":"..."}

3. ANSWER questions from the database:
   Balance, monthly summary, expense breakdown, market prices, party history.
   Always compute from actual data. Never guess financial numbers.

4. CONSULT on decisions:
   Market timing, crop selection, input choices, credit decisions.
   ALWAYS present options, NEVER give single commands.
   Use format: "రెండు ఆప్షన్లు: (1)... (2)... మీ ఇష్టం!"

5. PROCESS images:
   When farmer sends a photo, identify if it's:
   - Dealer bill → OCR → extract amounts → confirm
   - Crop/pest photo → identify pest/disease → suggest treatment
   - UPI screenshot → extract transaction → confirm

6. SEARCH the web:
   When your knowledge is insufficient, say "గూగుల్‌లో చెక్ చేస్తాను..."
   Include: {"action":"web_search","query":"..."}
   Summarize results in Telugu with source.

═══ SECTION 4: CONSTRAINTS (what you must NEVER do) ═══

1. NEVER make up financial numbers — always compute from the database
2. NEVER give medical/legal advice — suggest they consult a professional
3. NEVER recommend specific pesticide brands — give generic names + "డీలర్‌ను అడగండి"
4. NEVER guarantee future prices — "possible" and "trend" not "will"
5. NEVER store or share personal information beyond what's in the app
6. If you genuinely don't know something: "నాకు ఖచ్చితంగా తెలియదు.
   {search if possible, else:} మీ వ్యవసాయ అధికారిని అడగండి."
7. NEVER respond in English unless the farmer writes in English first

═══ SECTION 5: RESPONSE FORMAT ═══

For RECORD intents, always end with an action JSON block (no markdown fences):
{"action":"record_money","amount_paise":80000,"kind":"LaborPayment","is_income":false,"description":"రెండు కూలీలకు","party":""}

For SEARCH intents:
{"action":"web_search","query":"whitefly treatment groundnut andhra pradesh"}

For all other intents, respond in natural Telugu conversation. Keep responses
concise (2-4 sentences). Use emoji sparingly but warmly (🌾 👏 ☀️).
```

### 3e. Web Search Integration

**Implementation:** Client-side Google Custom Search API OR SerpAPI
- Triggered when AI includes `{"action":"web_search","query":"..."}` in response
- Search executed → top 3 results fetched → snippets translated to Telugu (Mayura)
- Results shown in SearchResultCard with source URL
- AI then summarizes the results in the next message

**Alternatively:** Use Sarvam 105B's built-in web browsing if available, or fall back to a simple scraper approach via fetch + DOMParser on cached search results.

**Search is ADDITIVE, not required** — if search fails, AI says "సర్చ్ పని చేయలేదు" and gives best-effort answer from its training data.

---

## 4. Dependencies

- **Requires:** F001 (✅), F002 (✅), F004 (✅ — Telugu parser reused), Sarvam integration (✅)
- **Replaces:** VoiceSheet (F004's bottom sheet becomes part of chat)
- **Enhances:** Every screen (chat bar appears on all)

---

## 5. Architecture Notes

### Why replace VoiceSheet with inline chat

VoiceSheet is a single-purpose modal: record → transcribe → parse → confirm. It breaks flow — you can't see your data while recording. The chat is persistent: you can scroll up to see previous entries, the AI remembers context, and you can follow up ("wait, make that ₹900 not ₹800").

### Why Sarvam 105B (not sarvam-m)

sarvam-m (24B) is good for simple tasks. But intent classification, option presentation, Telugu reasoning about market trends, and multi-turn conversation need the 105B model. It's the backbone — we save on token costs via the Trident optimization pipeline (54.1% savings).

### System prompt size concern

The dynamic system prompt with DB context could be 500-800 tokens. With Sarvam 105B's context window, this is fine. We rebuild it on every message (always fresh data). The Trident pipeline's digital root pre-filter can skip API calls for simple queries answerable from the DB alone.

### Conversation persistence

Store in localStorage (like AsymmFlow) for now. Future: store in STDB `chat_message` table for cross-device sync. localStorage is faster and doesn't require connectivity.

### AsymmFlow patterns reused

- `context.ts` pattern: build live business state from STDB stores → inject into system prompt
- `client.ts` pattern: SSE streaming with provider-aware auth headers
- `ChatMessage.svelte` pattern: markdown rendering, action cards inline
- `chatStore.ts` pattern: conversation persistence in localStorage

---

## 6. Test Plan

- [ ] Chat bar visible on all screens, tappable
- [ ] Chat panel expands with smooth animation
- [ ] Text input sends message → AI responds in Telugu (streaming)
- [ ] Voice input: mic records → STT → AI responds
- [ ] "హాలో" → warm greeting + today's prices (not ₹0 expense card!)
- [ ] "కూలి 400" → confirmation card with ₹400 LaborPayment
- [ ] "నా బ్యాలెన్స్ ఎంత?" → correct balance from DB
- [ ] "వేరుశెనగ ధర?" → current prices from market_price table
- [ ] "ఇప్పుడు అమ్మాలా?" → options-based advice (not command)
- [ ] Confirm card ✓ → saves to STDB → appears in Dabbu timeline
- [ ] Multi-turn: "కూలి" → "ఎంత?" → "400" → "₹400 కూలి. సరేనా?"
- [ ] Camera tap → photo taken → sent to AI for OCR/vision
- [ ] Web search triggered when AI doesn't know → results in Telugu
- [ ] Offline: chat works with mock responses + cached data

---

## 7. Session Log

| Date | Session | What Happened | Next Step |
|------|---------|---------------|-----------|
| 2026-03-16 | Spec session | Deep brainstorm on all 5 intent categories, 12+ user journeys, system prompt design, collapsible chat architecture. Commander's philosophy: "present options not commands, friend not cold AI, if you don't know say so." | Build chat interface |
