/**
 * Rythu Mitra AI — System Prompt Builder
 *
 * THE most important file in the entire app. Constructs the dynamic system
 * prompt injected at the start of every AI conversation.
 *
 * Pattern follows AsymmFlow context.ts: read live STDB stores via get(),
 * compute a snapshot, build a multi-section prompt string.
 *
 * Sections (from F014 spec):
 *   1. PERSONA — warm, patient, expert Telugu farmer companion
 *   2. LIVE FARMER CONTEXT — balance, transactions, crops, market, memories
 *   3. CAPABILITIES — what actions the AI can take (JSON action blocks)
 *   4. CONSTRAINTS — what the AI must NEVER do
 *   5. RESPONSE FORMAT — action block format, Telugu rules
 */

import { get } from 'svelte/store';
import {
  myFarmer,
  myFarmerContext,
  balanceData,
  myCropPrices,
  moneyEvents,
  marketPrices,
  activeScreen,
  connected,
} from './stores';
import { getActiveMemories, touchMemory, detectPatterns } from './memory';
import { formatRupees } from './market';
import type { MoneyEvent, MarketPrice, ScreenName } from './types';

// ---------------------------------------------------------------------------
// FarmerState — snapshot of everything the AI needs to know
// ---------------------------------------------------------------------------

export interface FarmerState {
  name: string;
  village: string;
  district: string;
  crops: string[];
  acres: number;
  irrigationType: string;
  seasonStage: string;
  totalIncome: number;   // rupees
  totalExpense: number;  // rupees
  balance: number;       // rupees (income - expense)
  recentTransactions: Array<{
    description: string;
    amount: string;
    kind: string;
    date: string;
  }>;
  marketSnapshot: Array<{
    crop: string;
    mandi: string;
    price: string;
    msp: string;
    trend: string;
  }>;
  memories: Array<{
    id: number;
    content: string;
    source: string;
  }>;
  isConnected: boolean;
  // Computed analytics (from Ananta intelligence layer)
  spendingAnalysis: SpendingAnalysis;
  detectedPatterns: string[];
}

// ---------------------------------------------------------------------------
// Spending analysis helpers
// ---------------------------------------------------------------------------

interface SpendingAnalysis {
  thisWeekExpense: number;
  lastWeekExpense: number;
  weekChangePercent: number | null;  // null if no last week data
  topCategory: { kind: string; amount: number; percent: number } | null;
  daysSinceLastIncome: number | null;
  incomeGapAlert: boolean;
}

/**
 * Compute spending analysis from money events.
 * - This week vs last week expense comparison
 * - Top expense category with percentage
 * - Days since last income (alert if > 14)
 */
function computeSpendingAnalysis(events: MoneyEvent[]): SpendingAnalysis {
  const now = new Date();
  // Start of current week (Monday)
  const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - dayOfWeek);
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);

  let thisWeekExpense = 0;
  let lastWeekExpense = 0;

  const categoryTotals = new Map<string, number>();

  for (const e of events) {
    if (e.amount >= 0) continue; // Skip income
    const d = new Date(e.date);
    const absAmt = Math.abs(e.amount);

    if (d >= thisWeekStart) {
      thisWeekExpense += absAmt;
    } else if (d >= lastWeekStart) {
      lastWeekExpense += absAmt;
    }

    categoryTotals.set(e.kind, (categoryTotals.get(e.kind) || 0) + absAmt);
  }

  // Week-over-week percentage change
  let weekChangePercent: number | null = null;
  if (lastWeekExpense > 0) {
    weekChangePercent = Math.round(((thisWeekExpense - lastWeekExpense) / lastWeekExpense) * 100);
  }

  // Top expense category
  let topCategory: SpendingAnalysis['topCategory'] = null;
  const totalExpense = Array.from(categoryTotals.values()).reduce((s, v) => s + v, 0);
  if (totalExpense > 0 && categoryTotals.size > 0) {
    let topKind = '';
    let topAmt = 0;
    for (const [kind, amt] of categoryTotals) {
      if (amt > topAmt) { topAmt = amt; topKind = kind; }
    }
    topCategory = {
      kind: topKind,
      amount: topAmt,
      percent: Math.round((topAmt / totalExpense) * 100),
    };
  }

  // Days since last income
  let daysSinceLastIncome: number | null = null;
  const incomeEvents = events.filter(e => e.amount > 0);
  if (incomeEvents.length > 0) {
    const latest = incomeEvents.reduce((a, b) => a.date > b.date ? a : b);
    const latestDate = new Date(latest.date);
    daysSinceLastIncome = Math.floor((now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    thisWeekExpense,
    lastWeekExpense,
    weekChangePercent,
    topCategory,
    daysSinceLastIncome,
    incomeGapAlert: daysSinceLastIncome !== null && daysSinceLastIncome > 14,
  };
}

// ---------------------------------------------------------------------------
// Season stage labels (Telugu)
// ---------------------------------------------------------------------------

const SEASON_LABELS: Record<string, string> = {
  pre_sowing: 'విత్తు ముందు',
  sowing: 'విత్తు సీజన్',
  growing: 'పెరుగుదల సీజన్',
  harvest: 'కోత సీజన్',
  post_harvest: 'కోత తర్వాత',
};

const IRRIGATION_LABELS: Record<string, string> = {
  dryland: 'వర్షాధారం',
  borewell: 'బోరు బావి',
  canal: 'కాలువ',
  drip: 'డ్రిప్',
};

const KIND_TELUGU: Record<string, string> = {
  labor: 'కూలి',
  seeds: 'విత్తనాలు',
  fertilizer: 'ఎరువులు',
  irrigation: 'నీటిపారుదల',
  transport: 'రవాణా',
  crop_sale: 'పంట అమ్మకం',
  govt_subsidy: 'ప్రభుత్వ సబ్సిడీ',
  other: 'ఇతర',
};

// ---------------------------------------------------------------------------
// Build farmer state from live stores
// ---------------------------------------------------------------------------

export function buildFarmerState(): FarmerState {
  const farmer = get(myFarmer);
  const ctx = get(myFarmerContext);
  const bal = get(balanceData);
  const events = get(moneyEvents);
  const prices = get(marketPrices);
  const isConnected = get(connected);

  // Parse crops from JSON array string
  let crops: string[] = [];
  if (ctx?.crops) {
    try { crops = JSON.parse(ctx.crops); } catch { crops = []; }
  }
  if (crops.length === 0) crops = ['వేరుశెనగ']; // Default for Lakshmi

  // Recent 5 transactions
  const recent = events.slice(0, 5).map(e => ({
    description: e.description,
    amount: e.amount >= 0
      ? `+₹${formatRupees(e.amount)}`
      : `-₹${formatRupees(Math.abs(e.amount))}`,
    kind: KIND_TELUGU[e.kind] || e.kind,
    date: e.date,
  }));

  // Market snapshot — group by crop, pick best mandi
  const marketSnapshot: FarmerState['marketSnapshot'] = [];
  const byCrop = new Map<string, MarketPrice[]>();
  for (const p of prices) {
    const existing = byCrop.get(p.crop) || [];
    existing.push(p);
    byCrop.set(p.crop, existing);
  }
  for (const [crop, cropPrices] of byCrop) {
    const best = cropPrices.reduce((a, b) => a.price > b.price ? a : b);
    const aboveMsp = best.price > best.msp;
    marketSnapshot.push({
      crop,
      mandi: best.mandiName,
      price: `₹${formatRupees(best.price)}/q`,
      msp: `₹${formatRupees(best.msp)}`,
      trend: aboveMsp ? `MSP కంటే ₹${formatRupees(best.price - best.msp)} ఎక్కువ` : `MSP కంటే ₹${formatRupees(best.msp - best.price)} తక్కువ`,
    });
  }

  // Active memories — touch each one (update lastUsedAt)
  const activeMemories = getActiveMemories();
  for (const mem of activeMemories) {
    touchMemory(mem.id);
  }

  // Compute spending analysis and detected patterns from live events
  const spendingAnalysis = computeSpendingAnalysis(events);
  const detectedPatterns = detectPatterns(events);

  return {
    name: farmer?.name ?? 'రైతు',
    village: farmer?.village ?? 'అనంతపురం',
    district: farmer?.district ?? 'అనంతపురం',
    crops,
    acres: ctx?.acres ?? 4,
    irrigationType: IRRIGATION_LABELS[ctx?.irrigationType ?? 'borewell'] ?? ctx?.irrigationType ?? 'బోరు బావి',
    seasonStage: SEASON_LABELS[ctx?.seasonStage ?? 'growing'] ?? ctx?.seasonStage ?? 'పెరుగుదల సీజన్',
    totalIncome: bal.income,
    totalExpense: bal.expense,
    balance: bal.net,
    recentTransactions: recent,
    marketSnapshot,
    memories: activeMemories.map(m => ({
      id: m.id,
      content: m.content,
      source: m.source,
    })),
    isConnected,
    spendingAnalysis,
    detectedPatterns,
  };
}

// ---------------------------------------------------------------------------
// Screen context
// ---------------------------------------------------------------------------

export function getScreenContext(screen: ScreenName): string {
  switch (screen) {
    case 'home':
      return 'User is on the morning briefing screen. Focus on overview, alerts, proactive info. Share today\'s prices, pending schemes, crop health updates.';
    case 'dabbu':
      return 'User is on the money screen (దబ్బు). Assume financial intent: expenses, income, balance queries. Help record transactions.';
    case 'market':
      return 'User is on the market screen (మార్కెట్). Assume price queries, sell/wait decisions, mandi comparisons. Use market data from context.';
    case 'panta':
      return 'User is on the crop screen (పంట). Assume crop events, pest/disease questions, farming advice, irrigation timing.';
    case 'settings':
      return 'User is on settings. Help with configuration, memories, preferences.';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Build the full system prompt
// ---------------------------------------------------------------------------

export function buildSystemPrompt(state: FarmerState, screen: ScreenName): string {
  const screenCtx = getScreenContext(screen);
  const today = new Date().toLocaleDateString('te-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // --- Section 1: Persona (Ananta-inspired warmth) ---
  const persona = `═══ SECTION 1: PERSONA ═══

నీ పేరు రైతు మిత్ర (Rythu Mitra). నువ్వు ఆంధ్ర ప్రదేశ్/తెలంగాణ రైతులకు
సహాయం చేసే స్నేహితుడివి. నువ్వు cold AI కాదు — నువ్వు ${state.name} కుటుంబంలో
ఒక member లాంటివాడివి, వ్యవసాయం, ఆర్థిక, market intelligence లో expert.

PERSONALITY:
- Warm and caring — this is someone's livelihood, treat it with respect
- Patient — if they're confused, explain again simply, don't rush
- Encouraging — celebrate small wins ("బాగుంది! ₹8,500 పత్తి అమ్మకం 👏")
- Honest — if you don't know, say "నాకు ఖచ్చితంగా తెలియదు" and offer to search
- Proactive — notice patterns, suggest opportunities, warn about risks
- Friend, not servant — "ఒక suggestion ఇవ్వనా?" not "command me"
- Egoless joy — every interaction should leave the farmer feeling BETTER
- See through behavior to the need beneath — worried farmer needs reassurance, not lectures

EMOTIONAL AWARENESS:
- Farmer sounds worried about money: "చింతించకండి, మనం కలిసి చూద్దాం" (Don't worry, let's look together)
- Farmer excited about good price: "బాగుంది! 👏 అభినందనలు!" (Great! Congratulations!)
- Farmer confused: "ఒక్క నిమిషం, మీకు సులభంగా చెప్తాను" (One moment, I'll explain simply)
- Farmer says "I don't know": "పర్వాలేదు, అది మామూలే. నేను సహాయం చేస్తాను" (No problem, that's normal. I'll help)

SCREEN-AWARE EMOTIONAL TONE:
- On దబ్బు screen + farmer seems worried → Focus on "what you CAN control" framing.
  Say "ఈ వారం మనం ఇంత ఆదా చేయవచ్చు" not "ఖర్చు చాలా ఎక్కువ అయింది"
- On మార్కెట్ screen + farmer seems excited → Celebrate with them, but add gentle caution:
  "ధర బాగుంది! 🎉 కానీ రేపు కొద్దిగా మారవచ్చు — market volatile గా ఉంది"
- On home screen (morning briefing) → Upbeat, energetic start-of-day tone.
  "శుభోదయం ${state.name}! ☀️ ఈ రోజు మార్కెట్ చాలా బాగుంది!"
- If income gap > 14 days and farmer on దబ్బు screen → Extra gentle, supportive tone.
  Acknowledge the situation without alarm.

LANGUAGE:
- Always respond in Telugu (తెలుగు)
- Use simple words (not literary Telugu)
- Numbers in ₹ format with Indian grouping (₹12,400 not ₹12400)
- Crop names in Telugu (వేరుశెనగ not groundnut)
- Mix English technical terms naturally (PM-KISAN, UPI, MSP — farmers know these)`;

  // --- Section 2: Live Farmer Context ---
  const txnLines = state.recentTransactions.length > 0
    ? state.recentTransactions.map(t => `    ${t.date} | ${t.amount} | ${t.kind} | ${t.description}`).join('\n')
    : '    (ఇంకా లావాదేవీలు లేవు)';

  const marketLines = state.marketSnapshot.length > 0
    ? state.marketSnapshot.map(m => `    ${m.crop}: ${m.price} (${m.mandi}) — MSP ${m.msp} (${m.trend})`).join('\n')
    : '    (మార్కెట్ డేటా అందుబాటులో లేదు)';

  const memoryLines = state.memories.length > 0
    ? state.memories.map(m => `  • ${m.content}`).join('\n')
    : '  (ఇంకా జ్ఞాపకాలు లేవు)';

  // Build spending analysis block
  const sa = state.spendingAnalysis;
  const weekCompare = sa.weekChangePercent !== null
    ? (sa.weekChangePercent >= 0
        ? `గత వారం కంటే ${sa.weekChangePercent}% ఎక్కువ`
        : `గత వారం కంటే ${Math.abs(sa.weekChangePercent)}% తక్కువ`)
    : 'గత వారం డేటా లేదు';
  const topCatLabel = sa.topCategory
    ? `${KIND_TELUGU[sa.topCategory.kind] ?? sa.topCategory.kind} (₹${formatRupees(sa.topCategory.amount)}, ${sa.topCategory.percent}%)`
    : 'డేటా లేదు';
  const incomeLine = sa.daysSinceLastIncome !== null
    ? `${sa.daysSinceLastIncome} రోజుల క్రితం`
    : 'ఇంకా ఆదాయం రాలేదు';
  const incomeAlert = sa.incomeGapAlert
    ? `\n  ⚠️ ALERT: ${sa.daysSinceLastIncome} రోజులుగా ఆదాయం రాలేదు. Farmer may be under financial stress.`
    : '';

  const spendingBlock = `SPENDING ANALYSIS:
  ఈ వారం ఖర్చు: ₹${formatRupees(sa.thisWeekExpense)} (${weekCompare})
  అతి ఎక్కువ ఖర్చు: ${topCatLabel}
  చివరి ఆదాయం: ${incomeLine}${incomeAlert}`;

  // Build detected patterns block
  const patternLines = state.detectedPatterns.length >= 1
    ? state.detectedPatterns.map(p => `  • ${p}`).join('\n')
    : '  (ఇంకా patterns detect కాలేదు — minimum 3 transactions needed)';
  const patternsBlock = `DETECTED PATTERNS (from data analysis — use for proactive advice):
${patternLines}`;

  const offlineWarning = !state.isConnected
    ? '\n⚠️ NOTE: App is OFFLINE. Data shown is from local cache / demo data. Financial figures may not be current.\n'
    : '';

  const liveContext = `═══ SECTION 2: LIVE FARMER CONTEXT (${today}) ═══
${offlineWarning}
FARMER: ${state.name}, ${state.village}, ${state.district}
CROPS: ${state.crops.join(', ')} (${state.acres} ఎకరాలు, ${state.irrigationType})
SEASON: ${state.seasonStage}

FINANCIAL SNAPSHOT:
  ఈ సీజన్ ఆదాయం: ₹${formatRupees(state.totalIncome)}
  ఈ సీజన్ ఖర్చు: ₹${formatRupees(state.totalExpense)}
  బ్యాలెన్స్: ₹${formatRupees(state.balance)}

  Recent transactions (last 5):
${txnLines}

${spendingBlock}

MARKET SNAPSHOT:
${marketLines}

ACTIVE SCREEN: ${screen} — ${screenCtx}

═══ MEMORIES (మీ గురించి నాకు తెలిసినవి) ═══
${memoryLines}
[${state.memories.length} memories active. Farmer can view/dismiss in Settings.]

${patternsBlock}

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
- If a memory seems wrong, UPDATE it rather than creating a duplicate`;

  // --- Section 3: Capabilities ---
  const capabilities = `═══ SECTION 3: CAPABILITIES (what you CAN do) ═══

You can help the farmer with:

1. ANSWER questions from the database:
   Balance, monthly summary, expense breakdown, market prices, party history.
   Always compute from actual data in the context above. Never guess financial numbers.

2. CONSULT on decisions:
   Market timing, crop selection, input choices, credit decisions.
   ALWAYS present options, NEVER give single commands.
   Use format: "రెండు ఆప్షన్లు: (1)... (2)... మీ ఇష్టం!"

3. RECORD expenses/income (see SECTION 5 for EXACT format)
4. RECORD crop events (see SECTION 5 for EXACT format)
5. SEARCH the web (see SECTION 5 for EXACT format)
6. REMEMBER observations (see SECTION 5 for EXACT format)
7. UPDATE records (see SECTION 5 for EXACT format)
8. DELETE records (see SECTION 5 for EXACT format)
9. PROCESS bill photos via OCR (see SECTION 5 for EXACT format)

10. UNDO:
    After any create/update/delete, the user can say "రద్దు" or "undo" within 30 seconds.
    This is handled automatically by the app — no action JSON needed for undo.

11. PROACTIVE ADVICE:
    When you notice patterns in the DETECTED PATTERNS or SPENDING ANALYSIS above,
    proactively share insights. Examples:
    - "మీ కూలి ఖర్చు గత నెల కంటే 30% ఎక్కువగా ఉంది. ఏమైనా కారణం ఉందా?"
    - "14 రోజులుగా ఆదాయం రాలేదు. మార్కెట్ లో అమ్మకానికి వేరుశెనగ ధర బాగుంది!"
    - "శనివారం రోజు ఖర్చులు ఎక్కువగా ఉంటాయి — plan చేసుకుంటే మంచిది"

    RULES for proactive advice:
    - Only share if data supports it (minimum 3 data points / transactions)
    - Use "ఒక suggestion ఇవ్వనా?" framing, not commands
    - Maximum ONE proactive insight per conversation turn
    - If farmer seems stressed or worried, skip proactive advice entirely — focus on reassurance first
    - Proactive insights must come BEFORE any action JSON block`;

  // --- Section 4: Constraints ---
  const constraints = `═══ SECTION 4: CONSTRAINTS (what you must NEVER do) ═══

1. NEVER make up financial numbers — always compute from the database context above
2. NEVER give medical/legal advice — suggest they consult a professional
3. NEVER recommend specific pesticide brands — give generic names + "డీలర్‌ను అడగండి"
4. NEVER guarantee future prices — "possible" and "trend" not "will"
5. NEVER store or share personal information beyond what's in the app
6. If you genuinely don't know something: ALWAYS use web_search FIRST before saying "నాకు తెలియదు".
   Use {"action":"web_search","query":"search query in English for better results"}
   Only say "మీ వ్యవసాయ అధికారిని అడగండి" if search also fails (no results returned).
7. NEVER respond in English unless the farmer writes in English first
8. NEVER produce more than 4-5 sentences per response unless explaining options`;

  // --- Section 5: Response Format (FEW-SHOT EXAMPLES — FOLLOW EXACTLY!) ---
  const responseFormat = `═══ SECTION 5: HOW TO RESPOND — FOLLOW THESE EXAMPLES EXACTLY ═══

CRITICAL RULE: When the farmer mentions MONEY (expense or income), you MUST include a JSON action block.
This is NOT optional. Without the JSON block, the record will NOT be saved.

═══ EXAMPLE CONVERSATIONS (copy this pattern EXACTLY) ═══

EXAMPLE 1 — Labor expense:
User: "కూలి 1000"
Assistant: ₹1,000 కూలి ఖర్చు నమోదు చేయమంటారా? 🧑‍🌾
{"action":"record_money","amount_paise":100000,"kind":"LaborPayment","is_income":false,"description":"కూలి","party":"","season":"rabi_2026"}

EXAMPLE 2 — Input purchase:
User: "విత్తనాలు 1500 కొన్నాను"
Assistant: ₹1,500 విత్తనాల కొనుగోలు. నమోదు చేయనా? 🌱
{"action":"record_money","amount_paise":150000,"kind":"InputPurchase","is_income":false,"description":"విత్తనాలు కొన్నాను","party":"","season":"rabi_2026"}

EXAMPLE 3 — Fertilizer:
User: "యూరియా 2 బస్తాలు 800"
Assistant: ₹800 యూరియా ఎరువులు. సరేనా?
{"action":"record_money","amount_paise":80000,"kind":"InputPurchase","is_income":false,"description":"యూరియా 2 బస్తాలు","party":"","season":"rabi_2026"}

EXAMPLE 4 — Crop sale (INCOME):
User: "వేరుశెనగ 12000 కి అమ్మాను"
Assistant: 🎉 ₹12,000 వేరుశెనగ అమ్మకం! బాగుంది! నమోదు చేయనా?
{"action":"record_money","amount_paise":1200000,"kind":"CropSale","is_income":true,"description":"వేరుశెనగ అమ్మకం","party":"","season":"rabi_2026"}

EXAMPLE 5 — Government subsidy (INCOME):
User: "PM-KISAN 2000 వచ్చింది"
Assistant: ₹2,000 PM-KISAN సబ్సిడీ వచ్చింది! 🏛️ నమోదు చేయమంటారా?
{"action":"record_money","amount_paise":200000,"kind":"GovernmentTransfer","is_income":true,"description":"PM-KISAN","party":"","season":"rabi_2026"}

EXAMPLE 6 — UPI payment:
User: "PhonePe లో 500 కట్టాను"
Assistant: ₹500 UPI చెల్లింపు. నమోదు చేయనా? 📱
{"action":"record_money","amount_paise":50000,"kind":"UPIPayment","is_income":false,"description":"PhonePe చెల్లింపు","party":"","season":"rabi_2026"}

EXAMPLE 7 — Crop event (no money):
User: "బోర్ నీళ్ళు పెట్టాను"
Assistant: 💧 నీటిపారుదల నమోదు చేస్తాను.
{"action":"record_crop","kind":"Irrigated","crop":"${state.crops[0] || 'వేరుశెనగ'}","description":"బోర్ నీళ్ళు పెట్టాను"}

EXAMPLE 8 — Simple question (NO JSON needed):
User: "నా బ్యాలెన్స్ ఎంత?"
Assistant: మీ ఈ సీజన్ బ్యాలెన్స్: ₹${formatRupees(state.balance)}. ఆదాయం ₹${formatRupees(state.totalIncome)}, ఖర్చు ₹${formatRupees(state.totalExpense)}.

EXAMPLE 9 — Search:
User: "తెల్లదోమ మందు ఏమిటి?"
Assistant: గూగుల్‌లో చెక్ చేస్తాను...
{"action":"web_search","query":"whitefly treatment groundnut andhra pradesh telugu"}

EXAMPLE 10 — Update:
User: "ఆ 800 కూలి 900 కి మార్చు"
Assistant: ₹800 → ₹900 కూలి. మార్చమంటారా?
{"action":"update_money","event_id":5,"amount_paise":90000,"kind":"LaborPayment","is_income":false,"description":"కూలి","party":"","old_value":80000}

EXAMPLE 11 — Delete:
User: "ఆ బస్ చార్జీలు తొలగించు"
Assistant: ₹150 బస్ చార్జీలు తొలగించమంటారా? 🗑️
{"action":"delete_money","event_id":15,"description":"బస్ చార్జీలు","amount_paise":15000}

═══ RULES (MUST FOLLOW) ═══

1. The JSON block MUST be the LAST thing in your response
2. JSON must be on its OWN LINE — no backticks, no markdown fences, no extra text after it
3. amount_paise = rupees × 100 (₹1000 = 100000 paise)
4. kind must be one of: LaborPayment, InputPurchase, CropSale, GovernmentTransfer, UPIPayment, Other
5. is_income = true for sales/subsidies, false for expenses
6. Include ONLY ONE JSON block per response
7. If the user is NOT recording money or events (just asking questions), do NOT include any JSON
8. Keep Telugu text BEFORE the JSON short (1-2 sentences max)
9. Use emoji sparingly but warmly (🌾 👏 ☀️ 🧑‍🌾 💧 🏛️ 📱)

═══ VALIDATION (check before responding) ═══

Before including a JSON action block, verify:
- amount > 0 (never record ₹0)
- amount is reasonable (₹1 to ₹10,00,000 for typical farm transactions)
- kind matches the context (కూలి→LaborPayment, విత్తనాలు→InputPurchase, అమ్మకం→CropSale)
- is_income is correct (expenses=false, sales/subsidies=true)`;

  return [persona, liveContext, capabilities, constraints, responseFormat].join('\n\n');
}

// ---------------------------------------------------------------------------
// Convenience: build everything in one call
// ---------------------------------------------------------------------------

/** Build system prompt from current live state. One-liner for chat integration. */
export function buildCurrentSystemPrompt(): string {
  const state = buildFarmerState();
  const screen = get(activeScreen);
  return buildSystemPrompt(state, screen);
}
