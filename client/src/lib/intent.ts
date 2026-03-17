/**
 * Client-side intent detection for Rythu Mitra.
 *
 * FALLBACK mechanism: when the AI model doesn't generate a JSON action block,
 * this module uses the existing Telugu parser from voice.ts to detect
 * financial record intents client-side and generate the action block.
 *
 * This is the "belt and suspenders" approach:
 *   1. PRIMARY: AI generates action JSON -> extracted and dispatched
 *   2. FALLBACK: Client-side Telugu parser detects intent -> generates action
 */

import { parseTeluguExpense, type ParsedExpense } from './voice';
import type { ChatAction } from './chat';

// ---------------------------------------------------------------------------
// Money Kind mapping: voice.ts kinds -> STDB action kinds
// ---------------------------------------------------------------------------

const UI_KIND_TO_ACTION_KIND: Record<string, string> = {
  labor: 'LaborPayment',
  seeds: 'InputPurchase',
  fertilizer: 'InputPurchase',
  irrigation: 'Other',
  transport: 'Other',
  crop_sale: 'CropSale',
  govt_subsidy: 'GovernmentTransfer',
  other: 'Other',
};

// ---------------------------------------------------------------------------
// Intent Detection
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Rhetorical / confirmatory question patterns (THESE ARE record intents)
// e.g. "కూలి 1000 ఇచ్చానా?" is the farmer verbally confirming what they spent
// ---------------------------------------------------------------------------

const RHETORICAL_RECORD_PATTERNS = [
  /ఇచ్చానా\?/,     // "did I give / I gave, right?"
  /కొన్నానా\?/,    // "did I buy / bought, right?"
  /అమ్మానా\?/,     // "did I sell / sold, right?"
  /పెట్టానా\?/,    // "did I put / applied, right?"
  /వేశానా\?/,      // "did I put in, right?"
];

// ---------------------------------------------------------------------------
// Negative patterns — price queries, history queries, balance queries
// These contain amounts or financial words but are NOT record intents
// ---------------------------------------------------------------------------

const NON_RECORD_PATTERNS = [
  /ఎంత\s*ఖర్చు\s*అయింది/,    // "how much did it cost?" (history)
  /గత\s*నెల/,                // "last month" (historical query)
  /మొత్తం\s*ఎంత/,            // "total how much?" (balance/summary query)
  /balance\s*ఎంత/i,          // "balance how much?"
  /బ్యాలెన్స్\s*ఎంత/,        // "balance how much?" (Telugu)
  /ధర\s*ఎంత/,                // "price how much?"
  /రేటు\s*ఏంటి/,             // "what is the rate?"
  /రేటు\s*ఎంత/,              // "how much is the rate?"
  /లెక్క\s*చెప్పు/,           // "tell me the account/total"
  /report/i,                  // asking for a report
  /రిపోర్ట్/,                 // report in Telugu
];

/**
 * Detect if a user message contains a RECORD intent (money or expense).
 *
 * Uses the existing Telugu parser from voice.ts.
 * Returns the parsed expense if confidence is sufficient, null otherwise.
 *
 * Confidence thresholds:
 *   >= 0.5 = amount detected + some context -> likely a record intent
 *   <  0.5 = too ambiguous, don't assume record intent
 *
 * Special cases:
 *   - Rhetorical questions like "కూలి 1000 ఇచ్చానా?" ARE record intents
 *   - Price/balance queries like "ధర ఎంత?" are NOT record intents
 *   - Historical queries like "గత నెల ఎంత ఖర్చు?" are NOT record intents
 */
export function detectRecordIntent(userText: string): ParsedExpense | null {
  // Skip very short messages
  if (userText.length < 2) return null;

  // Check rhetorical patterns first — these override general question skipping
  const isRhetorical = RHETORICAL_RECORD_PATTERNS.some(p => p.test(userText));

  if (!isRhetorical) {
    // Skip explicit non-record patterns (price/balance/history queries)
    for (const pattern of NON_RECORD_PATTERNS) {
      if (pattern.test(userText)) return null;
    }

    // Skip messages that are clearly open questions (not record intents)
    const openQuestionPatterns = [
      /ఎప్పుడు/,   // "when"
      /ఎక్కడ/,    // "where"
      /ఎలా/,      // "how"
      /ఏమిటి/,    // "what is"
      /ఏంటి/,     // "what is" (colloquial)
      /హాలో/,     // greeting
      /నమస్తే/,   // greeting
      /థాంక్స్/,  // thanks
      /సహాయం/,    // "help"
    ];
    for (const pattern of openQuestionPatterns) {
      if (pattern.test(userText)) return null;
    }

    // A plain "?" at the end is ambiguous — only skip if NOT a known record keyword
    // (so "DAP 800 కొన్నా?" still passes through to the parser)
    if (/\?$/.test(userText)) {
      const hasRecordKeyword = [
        'కూలి', 'కూలీ', 'విత్తన', 'ఎరువు', 'మందు', 'DAP', 'MOP', 'SSP', 'NPK',
        'యూరియా', 'బోరు', 'నీళ్ళు', 'అమ్మ', 'కొన్న', 'రవాణా', 'లారీ',
        'ట్రాక్టర్', 'రిపేర్', 'సర్వీస్', 'పని', 'లేబర్',
      ].some(kw => userText.includes(kw));
      if (!hasRecordKeyword) return null;
    }
  }

  const parsed = parseTeluguExpense(userText);

  // Only trigger fallback if we have a meaningful amount AND sufficient confidence
  if (parsed.amount_paise > 0 && parsed.confidence >= 0.5) {
    return parsed;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Fallback Action Generation
// ---------------------------------------------------------------------------

/**
 * Generate a ChatAction from a client-side ParsedExpense.
 *
 * This is used when the AI model fails to generate a JSON action block
 * but the client-side parser detected a financial record intent.
 */
export function generateFallbackAction(parsed: ParsedExpense): ChatAction {
  const actionKind = UI_KIND_TO_ACTION_KIND[parsed.kind] || 'Other';

  return {
    action: 'record_money',
    amount_paise: parsed.amount_paise,
    kind: actionKind,
    is_income: parsed.is_income,
    description: parsed.text,
    party: parsed.party_name || '',
    season: 'rabi_2026',
    _fallback: true, // Flag so we can track fallback usage in analytics
  };
}
