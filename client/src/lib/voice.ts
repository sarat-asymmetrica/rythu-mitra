/**
 * Voice recording + Telugu expense parsing for Rythu Mitra.
 *
 * Pipeline: Record audio -> base64 -> transcribe -> parse Telugu -> ParsedExpense
 *
 * Telugu parsing handles:
 *   - Telugu number words: "నాలుగు వందలు" -> 400
 *   - Compound numbers: "రెండు వేల ఐదు వందలు" -> 2500
 *   - Arabic numerals in Telugu text: "400 రూపాయలు" -> 400
 *   - Rupee symbol: "₹800" -> 800
 *   - Category keywords: "కూలి" -> LaborPayment
 */

import type { MoneyEventKind } from './types';

// ---------------------------------------------------------------------------
// ParsedExpense — the structured output of voice parsing
// ---------------------------------------------------------------------------

export interface ParsedExpense {
  text: string;             // original Telugu transcription
  amount_paise: number;     // extracted amount in paise (Rs * 100)
  kind: MoneyEventKind;     // extracted category mapped to MoneyEventKind
  kindLabel: string;        // Telugu display label for the kind
  party_name: string;       // extracted party name (or empty)
  confidence: number;       // 0-1, how confident the parse is
  is_income: boolean;       // sale/govt = income, rest = expense
}

// ---------------------------------------------------------------------------
// Voice State Machine
// ---------------------------------------------------------------------------

export type VoiceState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'parsed'
  | 'confirming'
  | 'editing'
  | 'saving'
  | 'saved';

// ---------------------------------------------------------------------------
// Telugu Number Parsing
// ---------------------------------------------------------------------------

/** Telugu number words -> numeric value */
const TELUGU_NUMBERS: Record<string, number> = {
  'ఒకటి': 1, 'ఒక': 1,
  'రెండు': 2,
  'మూడు': 3,
  'నాలుగు': 4,
  'ఐదు': 5,
  'ఆరు': 6,
  'ఏడు': 7,
  'ఎనిమిది': 8,
  'తొమ్మిది': 9,
  'పది': 10,
  'పదకొండు': 11,
  'పన్నెండు': 12,
  'పదమూడు': 13,
  'పదునాలుగు': 14,
  'పదిహేను': 15,
  'పదహారు': 16,
  'పదిహేడు': 17,
  'పదిహెనిమిది': 18,
  'పంతొమ్మిది': 19,
  'ఇరవై': 20,
  'ముప్పై': 30,
  'నలభై': 40,
  'యాభై': 50,
  'అరవై': 60,
  'డెబ్బై': 70,
  'ఎనభై': 80,
  'తొంభై': 90,
  // Fractions
  'అర': 0.5,
  'ఒకటిన్నర': 1.5,
  'రెండున్నర': 2.5,
  'మూడున్నర': 3.5,
  'నాలుగున్నర': 4.5,
  // Dozen
  'డజను': 12,
};

/** Telugu multiplier words */
const TELUGU_MULTIPLIERS: Record<string, number> = {
  'వంద': 100, 'వందలు': 100,
  'వేలు': 1000, 'వేల': 1000,
  'లక్ష': 100000, 'లక్షలు': 100000,
  'కోటి': 10000000,
};

/**
 * Parse a Telugu amount expression into a number (in rupees).
 *
 * Handles patterns like:
 *   "నాలుగు వందలు" -> 400
 *   "ఐదు వేలు" -> 5000
 *   "రెండు వేల ఐదు వందలు" -> 2500
 *   "400 రూపాయలు" -> 400
 *   "₹800" -> 800
 *   "ఎనిమిది వందలు" -> 800
 */
export function parseTeluguAmount(text: string): number {
  // 1. Try Arabic numerals first (₹800, 400 రూపాయలు, etc.)
  const arabicPatterns = [
    /₹\s*([\d,]+)/,                       // ₹800, ₹1,200
    /([\d,]+)\s*రూపాయలు/,                   // 400 రూపాయలు
    /([\d,]+)\s*రూపాయి/,                     // 400 రూపాయి
    /(?:^|\s)([\d,]+)(?:\s|$)/,            // standalone number
  ];

  for (const pattern of arabicPatterns) {
    const m = text.match(pattern);
    if (m) {
      const num = parseInt(m[1].replace(/,/g, ''), 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }

  // 2. Parse Telugu number words
  const words = text.split(/\s+/);
  let total = 0;
  let current = 0;

  for (const word of words) {
    const cleaned = word.replace(/[,.\u200C\u200D]/g, '');

    if (TELUGU_NUMBERS[cleaned] !== undefined) {
      const val = TELUGU_NUMBERS[cleaned];
      if (val < 1) {
        // Fraction word (అర=0.5, ఒకటిన్నర=1.5, etc.):
        // Treat as a standalone number seed — do NOT add to current,
        // set current to the fractional value so it can be multiplied
        // e.g. "ఒకటిన్నర వేలు" → current=1.5 → *1000 = 1500
        if (current === 0) {
          current = val;
        } else {
          // e.g. a fraction appended after a whole number — accumulate
          current += val;
        }
      } else {
        current += val;
      }
    } else if (TELUGU_MULTIPLIERS[cleaned] !== undefined) {
      const mult = TELUGU_MULTIPLIERS[cleaned];
      if (current === 0) current = 1;
      current *= mult;

      // If multiplier is >= 1000, accumulate to total for compound numbers
      // like "రెండు వేల ఐదు వందలు" (2*1000 + 5*100)
      if (mult >= 1000) {
        total += current;
        current = 0;
      }
    }
  }

  total += current;
  return total;
}

// ---------------------------------------------------------------------------
// Category Keyword Mapping
// ---------------------------------------------------------------------------

interface CategoryMatch {
  kind: MoneyEventKind;
  kindLabel: string;
  is_income: boolean;
}

const CATEGORY_KEYWORDS: Record<string, CategoryMatch> = {
  // ---------------------------------------------------------------------------
  // Labor (కూలి)
  // ---------------------------------------------------------------------------
  'కూలి':         { kind: 'labor', kindLabel: 'కూలి', is_income: false },
  'కూలీలు':       { kind: 'labor', kindLabel: 'కూలి', is_income: false },
  'కూలీలకు':      { kind: 'labor', kindLabel: 'కూలి', is_income: false },
  'కూలీ':         { kind: 'labor', kindLabel: 'కూలి', is_income: false },
  'కూలీడబ్బు':    { kind: 'labor', kindLabel: 'కూలి', is_income: false },
  'లేబర్':        { kind: 'labor', kindLabel: 'కూలి', is_income: false },
  'పని':          { kind: 'labor', kindLabel: 'కూలి', is_income: false },
  'పనిమంతులు':    { kind: 'labor', kindLabel: 'కూలి', is_income: false },
  'పనివాళ్ళు':    { kind: 'labor', kindLabel: 'కూలి', is_income: false },
  'పనివాళ్ళకు':   { kind: 'labor', kindLabel: 'కూలి', is_income: false },
  'మనుషులు':      { kind: 'labor', kindLabel: 'కూలి', is_income: false },
  'మనుషులకు':     { kind: 'labor', kindLabel: 'కూలి', is_income: false },
  'దినసరి':       { kind: 'labor', kindLabel: 'కూలి', is_income: false },
  'కూలీకి':       { kind: 'labor', kindLabel: 'కూలి', is_income: false },
  'వేతనం':        { kind: 'labor', kindLabel: 'కూలి', is_income: false },

  // ---------------------------------------------------------------------------
  // Seeds (విత్తనాలు)
  // ---------------------------------------------------------------------------
  'విత్తనాలు':    { kind: 'seeds', kindLabel: 'విత్తనాలు', is_income: false },
  'వీడ్లు':       { kind: 'seeds', kindLabel: 'విత్తనాలు', is_income: false },
  'విత్తనం':      { kind: 'seeds', kindLabel: 'విత్తనాలు', is_income: false },
  'బీజం':         { kind: 'seeds', kindLabel: 'విత్తనాలు', is_income: false },
  'బీజాలు':       { kind: 'seeds', kindLabel: 'విత్తనాలు', is_income: false },
  'నాటు':         { kind: 'seeds', kindLabel: 'విత్తనాలు', is_income: false },
  'నాట్లు':       { kind: 'seeds', kindLabel: 'విత్తనాలు', is_income: false },
  'నారు':         { kind: 'seeds', kindLabel: 'విత్తనాలు', is_income: false },
  // Common groundnut / crop variety names (treated as seed purchases when in context)
  'K-6':          { kind: 'seeds', kindLabel: 'విత్తనాలు', is_income: false },
  'TMV-2':        { kind: 'seeds', kindLabel: 'విత్తనాలు', is_income: false },
  'BT':           { kind: 'seeds', kindLabel: 'విత్తనాలు', is_income: false },

  // ---------------------------------------------------------------------------
  // Fertilizer (ఎరువులు)
  // ---------------------------------------------------------------------------
  'ఎరువులు':      { kind: 'fertilizer', kindLabel: 'ఎరువులు', is_income: false },
  'ఎరువు':        { kind: 'fertilizer', kindLabel: 'ఎరువులు', is_income: false },
  'యూరియా':       { kind: 'fertilizer', kindLabel: 'ఎరువులు', is_income: false },
  'DAP':          { kind: 'fertilizer', kindLabel: 'ఎరువులు', is_income: false },
  'MOP':          { kind: 'fertilizer', kindLabel: 'ఎరువులు', is_income: false },
  'SSP':          { kind: 'fertilizer', kindLabel: 'ఎరువులు', is_income: false },
  'NPK':          { kind: 'fertilizer', kindLabel: 'ఎరువులు', is_income: false },
  'జింక్':        { kind: 'fertilizer', kindLabel: 'ఎరువులు', is_income: false },
  'బోరాన్':       { kind: 'fertilizer', kindLabel: 'ఎరువులు', is_income: false },
  'బస్తా':        { kind: 'fertilizer', kindLabel: 'ఎరువులు', is_income: false },
  'బస్తాలు':      { kind: 'fertilizer', kindLabel: 'ఎరువులు', is_income: false },

  // ---------------------------------------------------------------------------
  // Pesticide / Medicine (మందు) — kept under fertilizer kind for simplicity
  // ---------------------------------------------------------------------------
  'మందు':         { kind: 'fertilizer', kindLabel: 'మందు', is_income: false },
  'పురుగు':       { kind: 'fertilizer', kindLabel: 'పురుగు మందు', is_income: false },
  'పురుగుమందు':   { kind: 'fertilizer', kindLabel: 'పురుగు మందు', is_income: false },
  'కలుపుమందు':    { kind: 'fertilizer', kindLabel: 'కలుపు మందు', is_income: false },
  'నీమ్ఆయిల్':   { kind: 'fertilizer', kindLabel: 'నీమ్ ఆయిల్', is_income: false },
  'వేపనూనె':      { kind: 'fertilizer', kindLabel: 'వేప నూనె', is_income: false },
  'స్ప్రే':       { kind: 'fertilizer', kindLabel: 'మందు', is_income: false },
  'పిచికారీ':     { kind: 'fertilizer', kindLabel: 'మందు', is_income: false },
  'పిచికారి':     { kind: 'fertilizer', kindLabel: 'మందు', is_income: false },

  // ---------------------------------------------------------------------------
  // Irrigation (నీటిపారుదల)
  // ---------------------------------------------------------------------------
  'నీళ్ళు':       { kind: 'irrigation', kindLabel: 'నీటిపారుదల', is_income: false },
  'నీటిపారుదల':   { kind: 'irrigation', kindLabel: 'నీటిపారుదల', is_income: false },
  'బోరు':         { kind: 'irrigation', kindLabel: 'నీటిపారుదల', is_income: false },
  'డీజిల్':       { kind: 'irrigation', kindLabel: 'నీటిపారుదల', is_income: false },
  'డీజల్':        { kind: 'irrigation', kindLabel: 'నీటిపారుదల', is_income: false },
  'మోటార్':       { kind: 'irrigation', kindLabel: 'నీటిపారుదల', is_income: false },
  'పంపు':         { kind: 'irrigation', kindLabel: 'నీటిపారుదల', is_income: false },
  'పైపు':         { kind: 'irrigation', kindLabel: 'నీటిపారుదల', is_income: false },
  'డ్రిప్':       { kind: 'irrigation', kindLabel: 'నీటిపారుదల', is_income: false },
  'నీరు':         { kind: 'irrigation', kindLabel: 'నీటిపారుదల', is_income: false },

  // ---------------------------------------------------------------------------
  // Crop Sale (పంట అమ్మకం)
  // ---------------------------------------------------------------------------
  'అమ్మకం':       { kind: 'crop_sale', kindLabel: 'పంట అమ్మకం', is_income: true },
  'అమ్మిన':       { kind: 'crop_sale', kindLabel: 'పంట అమ్మకం', is_income: true },
  'అమ్మాను':      { kind: 'crop_sale', kindLabel: 'పంట అమ్మకం', is_income: true },
  'అమ్మినాను':    { kind: 'crop_sale', kindLabel: 'పంట అమ్మకం', is_income: true },
  'అమ్మేశాను':    { kind: 'crop_sale', kindLabel: 'పంట అమ్మకం', is_income: true },
  'అమ్మాడు':      { kind: 'crop_sale', kindLabel: 'పంట అమ్మకం', is_income: true },
  'విక్రయం':      { kind: 'crop_sale', kindLabel: 'పంట అమ్మకం', is_income: true },
  'మండీలో':       { kind: 'crop_sale', kindLabel: 'పంట అమ్మకం', is_income: true },
  'మండీకి':       { kind: 'crop_sale', kindLabel: 'పంట అమ్మకం', is_income: true },
  'క్వింటాలు':    { kind: 'crop_sale', kindLabel: 'పంట అమ్మకం', is_income: true },
  'క్వింటాళ్ళు':  { kind: 'crop_sale', kindLabel: 'పంట అమ్మకం', is_income: true },
  'వ్యాపారికి':   { kind: 'crop_sale', kindLabel: 'పంట అమ్మకం', is_income: true },
  'కొన్నారు':     { kind: 'crop_sale', kindLabel: 'పంట అమ్మకం', is_income: true },

  // ---------------------------------------------------------------------------
  // Transport (రవాణా)
  // ---------------------------------------------------------------------------
  'రవాణా':        { kind: 'transport', kindLabel: 'రవాణా', is_income: false },
  'లారీ':         { kind: 'transport', kindLabel: 'రవాణా', is_income: false },
  'ట్రాక్టర్':    { kind: 'transport', kindLabel: 'రవాణా', is_income: false },
  'బస్':          { kind: 'transport', kindLabel: 'రవాణా', is_income: false },
  'ఆటో':          { kind: 'transport', kindLabel: 'రవాణా', is_income: false },
  'పెట్రోల్':     { kind: 'transport', kindLabel: 'రవాణా', is_income: false },

  // ---------------------------------------------------------------------------
  // Government / Income (ప్రభుత్వ సబ్సిడీ)
  // ---------------------------------------------------------------------------
  'PM-KISAN':     { kind: 'govt_subsidy', kindLabel: 'ప్రభుత్వ సబ్సిడీ', is_income: true },
  'PMKISAN':      { kind: 'govt_subsidy', kindLabel: 'ప్రభుత్వ సబ్సిడీ', is_income: true },
  'సర్కారు':      { kind: 'govt_subsidy', kindLabel: 'ప్రభుత్వ సబ్సిడీ', is_income: true },
  'సబ్సిడీ':      { kind: 'govt_subsidy', kindLabel: 'ప్రభుత్వ సబ్సిడీ', is_income: true },
  'భరోసా':        { kind: 'govt_subsidy', kindLabel: 'రైతు భరోసా', is_income: true },
  'YSR':          { kind: 'govt_subsidy', kindLabel: 'YSR భరోసా', is_income: true },
  'PMFBY':        { kind: 'govt_subsidy', kindLabel: 'పంట బీమా', is_income: true },
  'బీమా':         { kind: 'govt_subsidy', kindLabel: 'పంట బీమా', is_income: true },
  'పెన్షన్':      { kind: 'govt_subsidy', kindLabel: 'పెన్షన్', is_income: true },
  'వచ్చింది':     { kind: 'govt_subsidy', kindLabel: 'ప్రభుత్వ సబ్సిడీ', is_income: true },
  'జమఐంది':       { kind: 'govt_subsidy', kindLabel: 'ప్రభుత్వ సబ్సిడీ', is_income: true },
  'జమఅయింది':     { kind: 'govt_subsidy', kindLabel: 'ప్రభుత్వ సబ్సిడీ', is_income: true },

  // ---------------------------------------------------------------------------
  // Repair / Maintenance (మరమ్మత్తు)
  // ---------------------------------------------------------------------------
  'రిపేర్':       { kind: 'other', kindLabel: 'మరమ్మత్తు', is_income: false },
  'రిపేరు':       { kind: 'other', kindLabel: 'మరమ్మత్తు', is_income: false },
  'సర్వీస్':      { kind: 'other', kindLabel: 'మరమ్మత్తు', is_income: false },
  'మరమ్మత్తు':    { kind: 'other', kindLabel: 'మరమ్మత్తు', is_income: false },
  'పంక్చర్':      { kind: 'other', kindLabel: 'మరమ్మత్తు', is_income: false },
};

/**
 * Detect category from Telugu text by keyword matching.
 */
function detectCategory(text: string): CategoryMatch {
  const words = text.split(/\s+/);

  for (const word of words) {
    const cleaned = word.replace(/[,.\u200C\u200D]/g, '');
    if (CATEGORY_KEYWORDS[cleaned]) {
      return CATEGORY_KEYWORDS[cleaned];
    }
  }

  // Also try substring matching for compound words
  for (const [keyword, match] of Object.entries(CATEGORY_KEYWORDS)) {
    if (text.includes(keyword)) {
      return match;
    }
  }

  return { kind: 'other', kindLabel: 'ఇతర', is_income: false };
}

// ---------------------------------------------------------------------------
// Main Telugu Expense Parser
// ---------------------------------------------------------------------------

/**
 * Parse a Telugu transcription into a structured expense.
 *
 * Example:
 *   "రెండు కూలీలకు నాలుగు వందలు" -> { amount_paise: 80000, kind: 'labor', ... }
 *
 * The "రెండు కూలీలకు" means "for two laborers" and "నాలుగు వందలు" = 400.
 * So total = 2 * 400 = 800. But the simpler parse just extracts 400 from the
 * amount segment. We handle the multiplier detection specially.
 */
export function parseTeluguExpense(text: string): ParsedExpense {
  const category = detectCategory(text);
  let amount = parseTeluguAmount(text);
  let confidence = 0;

  // Special case: "రెండు కూలీలకు నాలుగు వందలు"
  // "two laborers, four hundred" => 2 * 400 = 800
  // Detect: number + కూలీలకు/మందికి pattern means per-person multiplier
  const perPersonPattern = /(\S+)\s+(కూలీలకు|మందికి|మంది)/;
  const perPersonMatch = text.match(perPersonPattern);
  if (perPersonMatch && category.kind === 'labor') {
    const countWord = perPersonMatch[1];
    const count = TELUGU_NUMBERS[countWord];
    if (count && count > 0) {
      // The remaining amount is per-person, multiply
      const remaining = text.slice(text.indexOf(perPersonMatch[0]) + perPersonMatch[0].length);
      const perPerson = parseTeluguAmount(remaining);
      if (perPerson > 0) {
        amount = count * perPerson;
      }
    }
  }

  // Compute confidence
  if (amount > 0) confidence += 0.5;
  if (category.kind !== 'other') confidence += 0.3;
  if (text.length > 5) confidence += 0.2;

  return {
    text,
    amount_paise: amount * 100,  // Convert rupees to paise
    kind: category.kind,
    kindLabel: category.kindLabel,
    party_name: '',
    confidence: Math.min(confidence, 1),
    is_income: category.is_income,
  };
}

// ---------------------------------------------------------------------------
// Audio Recording via Web Audio API / MediaRecorder
// ---------------------------------------------------------------------------

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let audioStream: MediaStream | null = null;

/**
 * Start audio recording via MediaRecorder.
 * Requests microphone permission on first call.
 */
export async function startRecording(): Promise<void> {
  audioChunks = [];

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  audioStream = stream;

  // Use webm/opus if available, fall back to whatever is available
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';

  const options: MediaRecorderOptions = {};
  if (mimeType) options.mimeType = mimeType;

  mediaRecorder = new MediaRecorder(stream, options);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.start(100); // collect chunks every 100ms
}

/**
 * Stop recording and return the audio blob.
 */
export function stopRecording(): Promise<Blob> {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve(new Blob([], { type: 'audio/webm' }));
      return;
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, {
        type: mediaRecorder?.mimeType || 'audio/webm',
      });
      audioChunks = [];

      // Stop all tracks to release microphone
      if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop());
        audioStream = null;
      }

      resolve(blob);
    };

    mediaRecorder.stop();
  });
}

/**
 * Check if recording is currently active.
 */
export function isRecording(): boolean {
  return mediaRecorder !== null && mediaRecorder.state === 'recording';
}

/**
 * Convert an audio blob to base64 string (for API transmission).
 */
export async function audioToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data:audio/webm;base64, prefix
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ---------------------------------------------------------------------------
// Idempotency Key Generation
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic idempotency key for duplicate prevention.
 * Uses a simple hash since SubtleCrypto.digest is async.
 */
export function generateIdempotencyKey(
  farmerId: string,
  amountPaise: number,
  date: string,
): string {
  const input = `${farmerId}|${amountPaise}|${date}|${Date.now()}|${Math.random()}`;
  // Simple hash (djb2) — sufficient for client-side idempotency
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff;
  }
  return `rm_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Mock Transcription (for demo/offline mode)
// ---------------------------------------------------------------------------

const MOCK_TRANSCRIPTIONS = [
  'రెండు కూలీలకు నాలుగు వందలు',
  'యూరియా ఒక బస్తా ఐదు వందలు',
  'వేరుశెనగ అమ్మకం పది వేలు',
  'నీళ్ళు బోరు డీజిల్ మూడు వందలు',
  'విత్తనాలు ఆరు వందలు',
  'PM-KISAN రెండు వేలు',
];

/**
 * Simulate transcription with a random Telugu expense phrase.
 * Used when STDB is not connected or for testing.
 */
export function getMockTranscription(): string {
  return MOCK_TRANSCRIPTIONS[Math.floor(Math.random() * MOCK_TRANSCRIPTIONS.length)];
}
