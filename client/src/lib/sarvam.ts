/**
 * Sarvam AI Service for Rythu Mitra.
 *
 * Unified client for ALL AI services via Sarvam:
 *   - STT (Speech-to-Text) via saaras:v3
 *   - Chat (Intent extraction) via sarvam-105b
 *   - TTS (Text-to-Speech) via bulbul:v3
 *   - Translate via mayura:v1
 *
 * ONE API key, ONE provider, ONE auth header: API-Subscription-Key
 * Config persisted in localStorage. API keys never logged.
 */

import type { ParsedExpense } from './voice';
import type { MoneyEventKind } from './types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface SarvamConfig {
  /** Single Sarvam API key for ALL services (STT, Chat, TTS, Translate) */
  apiKey: string;
  /** Chat model: "sarvam-105b" (default) or "sarvam-m" */
  chatModel: string;
}

const CONFIG_KEY = 'rythu_mitra_ai_config';

const SARVAM_BASE = 'https://api.sarvam.ai';

export function createDefaultConfig(): SarvamConfig {
  return {
    apiKey: '',
    chatModel: 'sarvam-105b',
  };
}

export function loadConfig(): SarvamConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return createDefaultConfig();
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Migration from old two-key format
    if ('sarvamApiKey' in parsed || 'chatApiKey' in parsed) {
      const migrated: SarvamConfig = {
        apiKey: (parsed.sarvamApiKey as string) || (parsed.chatApiKey as string) || '',
        chatModel: 'sarvam-105b',
      };
      saveConfig(migrated);
      return migrated;
    }

    return {
      apiKey: (parsed.apiKey as string) || '',
      chatModel: (parsed.chatModel as string) || 'sarvam-105b',
    };
  } catch {
    return createDefaultConfig();
  }
}

export function saveConfig(config: SarvamConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function hasApiKey(): boolean {
  const cfg = loadConfig();
  return cfg.apiKey.length > 0;
}

// ---------------------------------------------------------------------------
// Retry with exponential backoff (only on 5xx)
// ---------------------------------------------------------------------------

const RETRY_DELAYS = [100, 500, 1000];

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries: number = 3,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, init);

      // Only retry on server errors (5xx)
      if (response.status >= 500 && attempt < maxRetries - 1) {
        lastError = new Error(`HTTP ${response.status}`);
        await sleep(RETRY_DELAYS[attempt] ?? 1000);
        continue;
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries - 1) {
        await sleep(RETRY_DELAYS[attempt] ?? 1000);
      }
    }
  }

  throw lastError ?? new Error('fetchWithRetry exhausted all attempts');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// STT (Speech-to-Text) via Sarvam saaras:v3
// ---------------------------------------------------------------------------

interface SttResponse {
  transcript: string;
  language_code: string;
}

/**
 * Transcribe an audio blob using Sarvam saaras:v3.
 *
 * POST https://api.sarvam.ai/speech-to-text
 * Content-Type: multipart/form-data
 * Fields: file, model, language_code
 *
 * @returns transcript text and detected language
 * @throws Error on network failure or missing API key
 */
export async function transcribeAudio(
  audioBlob: Blob,
): Promise<{ transcript: string; language: string }> {
  const config = loadConfig();

  if (!config.apiKey) {
    throw new Error('Sarvam API key not configured');
  }

  const formData = new FormData();
  // Sarvam expects a file field with proper extension.
  // Strip codec parameters (e.g. "audio/webm;codecs=opus" -> "audio/webm")
  // because Sarvam rejects MIME types with codec suffixes.
  const MIME_CLEANUP: Record<string, string> = {
    'audio/webm;codecs=opus': 'audio/webm',
    'audio/ogg;codecs=opus': 'audio/ogg',
    'audio/webm;codecs=pcm': 'audio/webm',
  };
  const rawType = audioBlob.type || 'audio/webm';
  const cleanType = MIME_CLEANUP[rawType] || rawType.split(';')[0] || 'audio/webm';
  const ext = cleanType.includes('ogg') ? 'ogg' : cleanType.includes('wav') ? 'wav' : 'webm';
  const cleanBlob = new Blob([audioBlob], { type: cleanType });
  formData.append('file', cleanBlob, `recording.${ext}`);
  formData.append('model', 'saaras:v3');
  formData.append('language_code', 'te-IN');

  const response = await fetchWithRetry(
    `${SARVAM_BASE}/speech-to-text`,
    {
      method: 'POST',
      headers: {
        'API-Subscription-Key': config.apiKey,
        // Note: do NOT set Content-Type — browser sets it with boundary for FormData
      },
      body: formData,
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new Error('Sarvam API key is invalid. Check Settings.');
    }
    throw new Error(`STT failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as SttResponse;
  return {
    transcript: data.transcript || '',
    language: data.language_code || 'te-IN',
  };
}

/**
 * Test the Sarvam API key with a minimal STT request.
 * Creates a tiny silent WAV and sends it to verify auth.
 *
 * @returns true if key is valid, false otherwise
 */
export async function testSarvamKey(apiKey: string): Promise<boolean> {
  // Create a minimal valid WAV file (44-byte header + 160 bytes of silence = 0.01s at 16kHz mono)
  const sampleRate = 16000;
  const numSamples = 160;
  const dataSize = numSamples * 2; // 16-bit samples
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);          // chunk size
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);  // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  // Samples are already zero (silence)

  const blob = new Blob([buffer], { type: 'audio/wav' });
  const formData = new FormData();
  formData.append('file', blob, 'test.wav');
  formData.append('model', 'saaras:v3');
  formData.append('language_code', 'te-IN');

  try {
    const response = await fetch(`${SARVAM_BASE}/speech-to-text`, {
      method: 'POST',
      headers: { 'API-Subscription-Key': apiKey },
      body: formData,
    });
    // 200 or 400 (bad audio) = key works; 401/403 = key bad
    return response.status !== 401 && response.status !== 403;
  } catch {
    return false;
  }
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// ---------------------------------------------------------------------------
// Chat: AI-assisted intent extraction
// ---------------------------------------------------------------------------

const TELUGU_PARSER_SYSTEM_PROMPT = `You are a Telugu agricultural expense parser. Given a Telugu voice transcription from a farmer, extract: amount in rupees, expense category (Labor/Seeds/Fertilizer/Pesticide/Irrigation/Sale/Government/Other), party name if mentioned, and whether it's income or expense. Respond ONLY with JSON: {"amount": number, "kind": string, "party": string, "is_income": boolean}`;

const KIND_MAP: Record<string, MoneyEventKind> = {
  'labor': 'labor',
  'seeds': 'seeds',
  'fertilizer': 'fertilizer',
  'pesticide': 'fertilizer',
  'irrigation': 'irrigation',
  'sale': 'crop_sale',
  'government': 'govt_subsidy',
  'transport': 'transport',
  'other': 'other',
};

const KIND_LABEL_MAP: Record<MoneyEventKind, string> = {
  labor: 'కూలి',
  seeds: 'విత్తనాలు',
  fertilizer: 'ఎరువులు',
  irrigation: 'నీటిపారుదల',
  transport: 'రవాణా',
  crop_sale: 'పంట అమ్మకం',
  govt_subsidy: 'ప్రభుత్వ సబ్సిడీ',
  other: 'ఇతర',
};

/**
 * Use AI chat to extract intent from Telugu text when the local parser
 * has low confidence.
 *
 * Uses Sarvam 105B via api.sarvam.ai.
 * Falls back gracefully — returns the original parsed result if AI fails.
 */
export async function extractIntent(
  teluguText: string,
  fallback: ParsedExpense,
): Promise<ParsedExpense> {
  const config = loadConfig();

  if (!config.apiKey) {
    return fallback;
  }

  try {
    const response = await fetchWithRetry(
      `${SARVAM_BASE}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Subscription-Key': config.apiKey,
        },
        body: JSON.stringify({
          model: config.chatModel,
          messages: [
            { role: 'system', content: TELUGU_PARSER_SYSTEM_PROMPT },
            { role: 'user', content: teluguText },
          ],
          temperature: 0.1,
          max_tokens: 200,
        }),
      },
    );

    if (!response.ok) {
      return fallback;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content ?? '';

    // Extract JSON from the response (may be wrapped in markdown code block)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]) as {
      amount?: number;
      kind?: string;
      party?: string;
      is_income?: boolean;
    };

    if (!parsed.amount || parsed.amount <= 0) return fallback;

    const kindKey = (parsed.kind || 'other').toLowerCase();
    const kind = KIND_MAP[kindKey] ?? 'other';

    return {
      text: teluguText,
      amount_paise: Math.round(parsed.amount * 100),
      kind,
      kindLabel: KIND_LABEL_MAP[kind],
      party_name: parsed.party || '',
      confidence: 0.85, // AI-assisted parse
      is_income: parsed.is_income ?? false,
    };
  } catch {
    // AI extraction failed — return the local parser result
    return fallback;
  }
}
