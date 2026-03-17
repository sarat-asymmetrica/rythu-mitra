/**
 * Ananta Intelligence Layer — Vedic-math-powered reasoning for Rythu Mitra
 *
 * Ported from Go:
 *   reasoning/classifier.go  — digital root routing (O(1) classification)
 *   reasoning/gates.go       — 4 validation gates with harmonic mean
 *   persona/egoless_joy.go   — emotional state detection (Telugu-adapted)
 *
 * New additions:
 *   - Intent classification combining DR + Telugu keywords
 *   - Pattern detection enhancements (spending rhythm, category trends, income gaps)
 *   - Duplicate transaction detection
 *
 * Design principles:
 *   - All classification is O(1) or O(n) — no external calls
 *   - Telugu patterns are literal string matches, not transliteration hacks
 *   - Harmonic mean punishes single weak gates (same as Go source)
 *   - No framework dependencies — pure TS functions, fully tree-shakeable
 */

import type { MoneyEvent } from './types';
import type { ChatAction } from './actions';

// ============================================================
// SECTION 1: DIGITAL ROOT MATH
// ============================================================

/**
 * Compute digital root of a positive integer (1-9).
 * Digital root of 0 is defined as 0.
 * O(1) via modular arithmetic — Vedic Nikhilam Sutra.
 *
 * Examples: 15 -> 6, 9 -> 9, 108 -> 9
 */
export function digitalRoot(n: number): number {
  if (n === 0) return 0;
  const abs = Math.abs(Math.trunc(n));
  if (abs === 0) return 0;
  const r = abs % 9;
  return r === 0 ? 9 : r;
}

/**
 * Compute digital root of a string by summing char codes then reducing.
 * Mirrors Go's vedic.DigitalRootString.
 *
 * Example: "కూలి" -> sum of UTF-16 char codes -> digital root
 */
export function digitalRootString(s: string): number {
  if (s.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    sum += s.charCodeAt(i);
  }
  return digitalRoot(sum);
}

/**
 * Map digital root (1-9) to semantic cluster.
 * Mirrors Go's determineSemanticCluster:
 *   {1,4,7} -> 'action'    (transform, create, execute)
 *   {2,5,8} -> 'analysis'  (investigate, explore, understand)
 *   {3,6,9} -> 'synthesis' (optimize, refine, complete)
 */
export function classifyByDigitalRoot(dr: number): 'action' | 'analysis' | 'synthesis' {
  if (dr === 1 || dr === 4 || dr === 7) return 'action';
  if (dr === 2 || dr === 5 || dr === 8) return 'analysis';
  return 'synthesis'; // 3, 6, 9 — or 0 defaults here too
}

// ============================================================
// SECTION 2: INTENT CLASSIFICATION
// ============================================================

export interface ClassifiedIntent {
  type: 'record' | 'query' | 'advice' | 'search' | 'social';
  confidence: number;       // 0.0 to 1.0
  digitalRoot: number;      // 1-9
  cluster: 'action' | 'analysis' | 'synthesis';
  suggestedAction?: string; // e.g. 'record_money', 'web_search'
}

/**
 * Telugu keyword sets for intent routing.
 * Sourced from voice.ts CATEGORY_KEYWORDS + context.ts patterns.
 */
const RECORD_KEYWORDS = new Set([
  // Labor
  'కూలి', 'కూలీలు', 'కూలీలకు', 'లేబర్',
  // Seeds
  'విత్తనాలు', 'వీడ్లు', 'విత్తనం',
  // Fertilizer / pesticide
  'ఎరువులు', 'ఎరువు', 'యూరియా', 'DAP', 'మందు', 'పురుగు',
  // Irrigation
  'నీళ్ళు', 'నీటిపారుదల', 'బోరు',
  // Crop sale
  'అమ్మకం', 'అమ్మిన', 'అమ్మాను', 'అమ్మినాను', 'అమ్మేశాను',
  // Transport / misc expenses
  'రవాణా', 'ఖర్చు', 'కొన్నాను', 'కొనుగోలు',
  // Government
  'PM-KISAN', 'సర్కారు', 'సబ్సిడీ',
]);

const QUERY_KEYWORDS = new Set([
  'బ్యాలెన్స్', 'మొత్తం', 'ఎంత', 'లెక్క', 'ఖాతా',
  'సారాంశం', 'నెల', 'సీజన్', 'వివరాలు', 'చూపించు',
  'ఎంత ఖర్చు', 'ఎంత ఆదాయం',
]);

const ADVICE_KEYWORDS = new Set([
  'ఏమి చేయాలి', 'సలహా', 'ఎలా', 'మంచిది', 'సూచన',
  'ఏ సమయం', 'ఎప్పుడు నాటాలి', 'వేయాలా', 'పెట్టాలా',
  'అమ్మాలా', 'ఉంచాలా',
]);

const SEARCH_KEYWORDS = new Set([
  'మందు ఏమిటి', 'తెల్లదోమ', 'పురుగు', 'వ్యాధి', 'వాతావరణం',
  'వార్తలు', 'ధర', 'రేటు', 'ఏ మండి', 'గూగుల్',
]);

const SOCIAL_KEYWORDS = new Set([
  'హాలో', 'నమస్తే', 'నమస్కారం', 'థాంక్స్', 'ధన్యవాదాలు',
  'బాగున్నారా', 'సంతోషం', 'హాయ్',
]);

const QUESTION_PATTERNS = /[?]|ఎంత|ఎప్పుడు|ఎక్కడ|ఎలా|ఏమిటి|ఎందుకు|ఎవరు/;

/**
 * Classify a user message into an intent type, combining:
 *   1. Digital root of the message -> semantic cluster
 *   2. Telugu keyword matching -> strong signal
 *   3. Question patterns -> query/advice bias
 *   4. Social patterns -> social type
 *
 * Returns a ClassifiedIntent with confidence and suggestedAction.
 */
export function classifyIntent(text: string): ClassifiedIntent {
  const trimmed = text.trim();
  const dr = digitalRootString(trimmed);
  const cluster = classifyByDigitalRoot(dr);

  // Check social first (short-circuit)
  for (const kw of SOCIAL_KEYWORDS) {
    if (trimmed.includes(kw)) {
      return { type: 'social', confidence: 0.9, digitalRoot: dr, cluster };
    }
  }

  // Keyword scanning — collect hits per category
  let recordHits = 0;
  let queryHits = 0;
  let adviceHits = 0;
  let searchHits = 0;

  const words = trimmed.split(/\s+/);
  for (const word of words) {
    const cleaned = word.replace(/[,.\u200C\u200D।]/g, '');
    if (RECORD_KEYWORDS.has(cleaned)) recordHits++;
    if (QUERY_KEYWORDS.has(cleaned)) queryHits++;
    if (ADVICE_KEYWORDS.has(cleaned)) adviceHits++;
    if (SEARCH_KEYWORDS.has(cleaned)) searchHits++;
  }

  // Also try substring matching for multi-word keywords
  for (const kw of RECORD_KEYWORDS) {
    if (trimmed.includes(kw)) recordHits++;
  }
  for (const kw of QUERY_KEYWORDS) {
    if (trimmed.includes(kw)) queryHits++;
  }
  for (const kw of ADVICE_KEYWORDS) {
    if (trimmed.includes(kw)) adviceHits++;
  }
  for (const kw of SEARCH_KEYWORDS) {
    if (trimmed.includes(kw)) searchHits++;
  }

  const isQuestion = QUESTION_PATTERNS.test(trimmed);

  // --- Decision logic ---

  // Search intent: has search keywords OR disease/pest content
  if (searchHits > 0 && (isQuestion || searchHits >= 2)) {
    return {
      type: 'search',
      confidence: Math.min(0.7 + searchHits * 0.1, 0.95),
      digitalRoot: dr,
      cluster,
      suggestedAction: 'web_search',
    };
  }

  // Record intent: has record keywords AND no question pattern
  if (recordHits > 0 && !isQuestion) {
    const conf = Math.min(0.65 + recordHits * 0.1, 0.95);
    return {
      type: 'record',
      confidence: conf,
      digitalRoot: dr,
      cluster,
      suggestedAction: 'record_money',
    };
  }

  // Query intent: balance / amount questions
  if (queryHits > 0 || (isQuestion && cluster === 'analysis')) {
    return {
      type: 'query',
      confidence: Math.min(0.6 + queryHits * 0.1, 0.9),
      digitalRoot: dr,
      cluster,
    };
  }

  // Advice intent
  if (adviceHits > 0 || (isQuestion && cluster === 'synthesis')) {
    return {
      type: 'advice',
      confidence: Math.min(0.55 + adviceHits * 0.1, 0.85),
      digitalRoot: dr,
      cluster,
    };
  }

  // DR-based fallback: action cluster -> likely a record
  if (cluster === 'action' && !isQuestion) {
    return {
      type: 'record',
      confidence: 0.45,
      digitalRoot: dr,
      cluster,
      suggestedAction: 'record_money',
    };
  }

  // Default: query
  return {
    type: 'query',
    confidence: 0.40,
    digitalRoot: dr,
    cluster,
  };
}

// ============================================================
// SECTION 3: VALIDATION GATES
// ============================================================

export interface GateResult {
  gate: string;
  score: number;
  passed: boolean;
  message: string;
}

export interface GateResults {
  gates: GateResult[];
  overallScore: number;
  allPassed: boolean;
}

/**
 * Harmonic mean of an array of values.
 * Punishes single weak gate — mirrors Go's vedic.HarmonicMean.
 *
 * For empty or zero-containing arrays, returns 0.
 */
export function harmonicMean(values: number[]): number {
  if (values.length === 0) return 0;
  let sumReciprocals = 0;
  for (const v of values) {
    if (v <= 0) return 0; // harmonic mean is 0 if any value is 0
    sumReciprocals += 1 / v;
  }
  return values.length / sumReciprocals;
}

/**
 * Gate 1 (Sanity): Amount is within reasonable farming range.
 * Valid range: ₹1 (100 paise) to ₹10,00,000 (100000000 paise).
 */
function gateSanity(action: ChatAction): GateResult {
  const amountPaise = Number(action.amount_paise ?? 0);
  const rupees = amountPaise / 100;

  if (amountPaise <= 0) {
    return { gate: 'sanity', score: 0, passed: false, message: 'మొత్తం 0 కంటే ఎక్కువ ఉండాలి' };
  }
  if (amountPaise > 100_000_000) {
    return { gate: 'sanity', score: 0.3, passed: false, message: `₹${rupees.toLocaleString('en-IN')} — ₹10,00,000 పరిమితి మించింది` };
  }
  // Slightly suspicious: < ₹1
  if (amountPaise < 100) {
    return { gate: 'sanity', score: 0.5, passed: false, message: 'మొత్తం చాలా తక్కువ — ₹1 కంటే ఎక్కువ ఉండాలి' };
  }
  return { gate: 'sanity', score: 1.0, passed: true, message: `₹${rupees.toLocaleString('en-IN')} — సమంజసమైన మొత్తం` };
}

/**
 * Kind-to-description consistency keywords.
 * Gate 2 checks that the description text aligns with the claimed kind.
 */
const KIND_KEYWORDS: Record<string, string[]> = {
  LaborPayment:      ['కూలి', 'కూలీలు', 'లేబర్', 'worker', 'labor', 'labour'],
  InputPurchase:     ['విత్తనాలు', 'ఎరువులు', 'మందు', 'DAP', 'యూరియా', 'seeds', 'fertilizer', 'కొనుగోలు', 'bought'],
  CropSale:          ['అమ్మకం', 'అమ్మిన', 'అమ్మాను', 'sale', 'sold', 'అమ్మేశాను'],
  GovernmentTransfer:['PM-KISAN', 'సర్కారు', 'సబ్సిడీ', 'govt', 'subsidy', 'transfer'],
  UPIPayment:        ['PhonePe', 'UPI', 'GPay', 'Paytm', 'BHIM', 'చెల్లింపు'],
  Other:             [], // Other always passes consistency
};

/**
 * Gate 2 (Consistency): Kind matches description keywords.
 * If no keywords are defined for the kind (e.g. 'Other'), passes automatically.
 */
function gateConsistency(action: ChatAction): GateResult {
  const kind = String(action.kind ?? 'Other');
  const description = String(action.description ?? '').toLowerCase();

  const keywords = KIND_KEYWORDS[kind];
  if (!keywords || keywords.length === 0) {
    return { gate: 'consistency', score: 0.8, passed: true, message: `${kind} — సందర్భం ఖచ్చితమైనది కాదు కానీ అనుమతి ఉంది` };
  }

  const hasMatch = keywords.some(kw => description.includes(kw.toLowerCase()));
  if (hasMatch) {
    return { gate: 'consistency', score: 1.0, passed: true, message: `${kind} వివరణతో సరిపోతుంది` };
  }

  // Soft fail — description might be in Telugu without keywords; don't block completely
  return { gate: 'consistency', score: 0.6, passed: true, message: `${kind} — వివరణ పరిశీలించండి` };
}

/**
 * Gate 3 (Duplicate): Same amount + kind within a 5-minute window.
 * Returns a low score if a potential duplicate is found.
 */
function gateDuplicate(action: ChatAction, recentEvents: MoneyEvent[]): GateResult {
  const amountPaise = Number(action.amount_paise ?? 0);
  const kind = String(action.kind ?? '');
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes

  const kindToUi: Record<string, string> = {
    LaborPayment: 'labor',
    InputPurchase: 'seeds',
    CropSale: 'crop_sale',
    GovernmentTransfer: 'govt_subsidy',
    UPIPayment: 'other',
    Other: 'other',
  };
  const uiKind = kindToUi[kind] ?? kind;

  for (const ev of recentEvents) {
    const evTime = new Date(ev.date + 'T' + (ev.time ?? '00:00')).getTime();
    if (isNaN(evTime)) continue;
    const ageDiff = now - evTime;
    if (ageDiff > windowMs) continue;

    const evAmountPaise = Math.abs(ev.amount) * 100;
    const kindMatches = ev.kind === uiKind;
    const amountMatches = Math.abs(evAmountPaise - amountPaise) < 1; // exact paise match

    if (amountMatches && kindMatches) {
      return {
        gate: 'duplicate',
        score: 0.3,
        passed: false,
        message: `⚠️ 5 నిమిషాల్లో అదే మొత్తం నమోదైంది — తిరిగి నమోదు అవుతుందా?`,
      };
    }
  }

  return { gate: 'duplicate', score: 1.0, passed: true, message: 'నకలు కాదు' };
}

/**
 * Gate 4 (Quality): Harmonic mean of gates 1-3 scores >= 0.7.
 * This is the "Harmony" gate from Go's gates.go — overall balance check.
 */
function gateQuality(scores: number[]): GateResult {
  const hm = harmonicMean(scores);
  const passed = hm >= 0.7;
  return {
    gate: 'quality',
    score: hm,
    passed,
    message: passed
      ? `నాణ్యత సరిపోతుంది (${(hm * 100).toFixed(1)}%)`
      : `నాణ్యత తక్కువగా ఉంది (${(hm * 100).toFixed(1)}% < 70%)`,
  };
}

/**
 * Run all 4 Ananta validation gates on a proposed money transaction.
 * Returns per-gate results + overall harmonic mean score.
 *
 * Mirrors the Ananta 4-gate pattern from actions.ts validateMoneyAction,
 * but with full scoring and Vedic harmonic mean.
 */
export function validateTransaction(
  action: ChatAction,
  recentEvents: MoneyEvent[],
): GateResults {
  const g1 = gateSanity(action);
  const g2 = gateConsistency(action);
  const g3 = gateDuplicate(action, recentEvents);
  const g4 = gateQuality([g1.score, g2.score, g3.score]);

  const allPassed = g1.passed && g2.passed && g3.passed && g4.passed;
  const overallScore = harmonicMean([g1.score, g2.score, g3.score, g4.score]);

  return {
    gates: [g1, g2, g3, g4],
    overallScore,
    allPassed,
  };
}

// ============================================================
// SECTION 4: EMOTIONAL AWARENESS (TELUGU-ADAPTED)
// ============================================================

export interface FarmerEmotionalState {
  surface: string;       // What the farmer is showing (worried, excited, confused, frustrated, neutral)
  reality: string;       // What they're likely feeling underneath
  response: string;      // How Ananta should respond
  teluguComfort: string; // Telugu comfort phrase to prepend
}

/**
 * Worried farmer keywords — loan, debt, loss, fear
 */
const WORRIED_KEYWORDS = [
  'అప్పు', 'అప్పులు', 'అప్పు ఉంది', 'అప్పు తీర్చాలి',
  'నష్టం', 'నష్టపోయాను', 'నష్టమైంది',
  'భయం', 'భయంగా ఉంది', 'భయపడుతున్నాను',
  'అప్పు', 'లోన్', 'loan', 'debt',
  'చాలా ఖర్చు', 'డబ్బు లేదు', 'డబ్బు సరిపోలేదు',
  'కష్టం', 'చాలా కష్టంగా ఉంది',
];

/**
 * Excited farmer keywords — good price, harvest, profit
 */
const EXCITED_KEYWORDS = [
  'లాభం', 'లాభమైంది', 'లాభం వచ్చింది',
  'బాగుంది', 'చాలా బాగుంది', 'మంచి ధర',
  'సంతోషం', 'సంతోషంగా ఉన్నాను',
  'ఆదాయం వచ్చింది', 'పంట బాగుంది', 'పంట చాలా బాగుంది',
  'మంచి పంట', 'అమ్మకం బాగా జరిగింది',
];

/**
 * Confused farmer keywords — questions, don't understand
 */
const CONFUSED_KEYWORDS = [
  'అర్థం కాలేదు', 'అర్థం కావడం లేదు', 'అర్థం కాదు',
  'ఎలా చేయాలి', 'ఎలా వేయాలి', 'ఎలా తెలుసుకోవాలి',
  'ఏమిటో', 'ఏమి చేయాలో', 'నాకు తెలియదు',
  'చెప్పండి', 'వివరించండి', 'సులభంగా చెప్పండి',
];

/**
 * Frustrated farmer keywords — repeated failures, nothing works
 */
const FRUSTRATED_KEYWORDS = [
  'పని చేయడం లేదు', 'పని చేయట్లేదు', 'పని కాదు',
  'ఎప్పటికీ కాదు', 'ఏమీ కాదు', 'ఏమీ లాభం లేదు',
  'విసుగు', 'విసుగ్గా ఉంది', 'అలసిపోయాను',
  'ఏం చేసినా ఫలితం లేదు', 'ఒక్కసారి కూడా', 'నిరాశ',
];

function matchesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

/**
 * Detect emotional state of a Telugu farmer from their message.
 * Returns Telugu comfort phrase + response strategy.
 *
 * Adapted from egoless_joy.go's DetectUserState for farming context.
 */
export function detectFarmerEmotion(text: string): FarmerEmotionalState {
  if (matchesAny(text, WORRIED_KEYWORDS)) {
    return {
      surface: 'worried',
      reality: 'fear_or_stress',
      response: 'reassurance',
      teluguComfort: 'చింతించకండి, మనం కలిసి చూద్దాం',
    };
  }

  if (matchesAny(text, EXCITED_KEYWORDS)) {
    return {
      surface: 'excited',
      reality: 'joy',
      response: 'celebration',
      teluguComfort: 'బాగుంది! 👏 అభినందనలు!',
    };
  }

  if (matchesAny(text, CONFUSED_KEYWORDS)) {
    return {
      surface: 'confused',
      reality: 'seeking_clarity',
      response: 'simple_explanation',
      teluguComfort: 'ఒక్క నిమిషం, మీకు సులభంగా చెప్తాను',
    };
  }

  if (matchesAny(text, FRUSTRATED_KEYWORDS)) {
    return {
      surface: 'frustrated',
      reality: 'exhaustion',
      response: 'patience_and_hope',
      teluguComfort: 'పర్వాలేదు, మళ్ళీ ప్రయత్నిద్దాం',
    };
  }

  return {
    surface: 'neutral',
    reality: 'seeking_help',
    response: 'helpful_service',
    teluguComfort: '',
  };
}

// ============================================================
// SECTION 5: PATTERN DETECTION (enhances memory.ts)
// ============================================================

/**
 * Detect which day of the week has the highest average expenses.
 * Returns a Telugu pattern string if a strong signal is found.
 */
function detectWeeklySpendingRhythm(events: MoneyEvent[]): string[] {
  const patterns: string[] = [];
  const expenses = events.filter(e => e.amount < 0);
  if (expenses.length < 4) return patterns;

  const dayTotals = new Array(7).fill(0) as number[];
  const dayCounts = new Array(7).fill(0) as number[];

  for (const e of expenses) {
    const d = new Date(e.date);
    if (isNaN(d.getTime())) continue;
    const day = d.getDay();
    dayTotals[day] += Math.abs(e.amount);
    dayCounts[day]++;
  }

  const dayNames = ['ఆదివారం', 'సోమవారం', 'మంగళవారం', 'బుధవారం', 'గురువారం', 'శుక్రవారం', 'శనివారం'];
  const dayAvgs = dayTotals.map((total, i) => ({ day: i, avg: dayCounts[i] > 0 ? total / dayCounts[i] : 0, count: dayCounts[i] }));

  const totalAvg = dayAvgs.reduce((s, d) => s + d.avg, 0) / dayAvgs.filter(d => d.count > 0).length || 1;

  for (const d of dayAvgs) {
    if (d.count >= 2 && d.avg > totalAvg * 1.5) {
      patterns.push(`${dayNames[d.day]} రోజు ఖర్చులు ఎక్కువగా ఉంటాయి`);
    }
  }

  return patterns;
}

/**
 * Detect category spending trends month-over-month.
 * Returns Telugu alert strings like "కూలి ఖర్చు గత నెల కంటే 30% ఎక్కువ".
 */
function detectCategoryTrends(events: MoneyEvent[]): string[] {
  const patterns: string[] = [];
  const now = new Date();
  const thisMonthNum = now.getMonth();
  const thisYearNum = now.getFullYear();
  const lastMonthDate = new Date(thisYearNum, thisMonthNum - 1, 1);

  const thisMonth = events.filter(e => {
    const d = new Date(e.date);
    return !isNaN(d.getTime()) && d.getMonth() === thisMonthNum && d.getFullYear() === thisYearNum && e.amount < 0;
  });

  const lastMonth = events.filter(e => {
    const d = new Date(e.date);
    return !isNaN(d.getTime()) && d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear() && e.amount < 0;
  });

  const thisMap = new Map<string, number>();
  const lastMap = new Map<string, number>();

  for (const e of thisMonth) {
    thisMap.set(e.kind, (thisMap.get(e.kind) ?? 0) + Math.abs(e.amount));
  }
  for (const e of lastMonth) {
    lastMap.set(e.kind, (lastMap.get(e.kind) ?? 0) + Math.abs(e.amount));
  }

  const kindLabels: Record<string, string> = {
    labor: 'కూలి', seeds: 'విత్తనాలు', fertilizer: 'ఎరువులు',
    irrigation: 'నీటిపారుదల', transport: 'రవాణా', other: 'ఇతర',
    crop_sale: 'పంట', govt_subsidy: 'సబ్సిడీ',
  };

  for (const [kind, thisAmt] of thisMap) {
    const lastAmt = lastMap.get(kind) ?? 0;
    if (lastAmt > 0 && thisAmt > lastAmt * 1.3) {
      const pct = Math.round(((thisAmt - lastAmt) / lastAmt) * 100);
      const label = kindLabels[kind] ?? kind;
      patterns.push(`${label} ఖర్చు గత నెల కంటే ${pct}% ఎక్కువ`);
    }
  }

  return patterns;
}

/**
 * Detect income gap: days since last income event.
 * Returns Telugu alert if > 14 days.
 */
function detectIncomeGap(events: MoneyEvent[]): string[] {
  const patterns: string[] = [];
  const incomeEvents = events.filter(e => e.amount > 0);
  if (incomeEvents.length === 0) return patterns;

  const sorted = [...incomeEvents].sort((a, b) => b.date.localeCompare(a.date));
  const lastIncome = new Date(sorted[0].date);
  if (isNaN(lastIncome.getTime())) return patterns;

  const today = new Date();
  const diffMs = today.getTime() - lastIncome.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 14) {
    patterns.push(`${diffDays} రోజుల నుండి ఆదాయం లేదు — ఆదాయ వనరు తనిఖీ చేయండి`);
  }

  return patterns;
}

/**
 * Combined spending pattern detection for Rythu Mitra.
 * Enhances memory.ts detectPatterns() with three new signals.
 *
 * Returns array of Telugu pattern strings.
 */
export function detectSpendingPatterns(events: MoneyEvent[]): string[] {
  if (events.length < 3) return [];

  return [
    ...detectWeeklySpendingRhythm(events),
    ...detectCategoryTrends(events),
    ...detectIncomeGap(events),
  ];
}

/**
 * Detect if a proposed action is a duplicate of a recent transaction
 * within a 5-minute window (same amount + same kind).
 *
 * Returns true if a probable duplicate is found.
 */
export function detectDuplicateTransaction(
  action: ChatAction,
  recentEvents: MoneyEvent[],
): boolean {
  const g3 = gateDuplicate(action, recentEvents);
  return !g3.passed;
}
