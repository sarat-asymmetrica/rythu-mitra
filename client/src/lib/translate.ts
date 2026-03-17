/**
 * Translation service for Rythu Mitra.
 *
 * Uses Sarvam Mayura v1 to translate English advisories to Telugu.
 *
 * POST https://api.sarvam.ai/translate
 * Header: api-subscription-key
 *
 * Response: { "translated_text": "..." }
 */

import { loadConfig } from './sarvam';

// ---------------------------------------------------------------------------
// Simple in-memory cache to avoid re-translating the same text
// ---------------------------------------------------------------------------

const translationCache = new Map<string, string>();
const CACHE_MAX = 50;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Translate English text to Telugu via Sarvam Mayura v1.
 *
 * - Checks cache first (no API call for repeated text)
 * - Requires Sarvam API key in config
 * - Returns original text on failure (graceful degradation)
 */
export async function translateToTelugu(englishText: string): Promise<string> {
  if (!englishText.trim()) return englishText;

  // Check cache
  const cached = translationCache.get(englishText);
  if (cached) return cached;

  const config = loadConfig();

  if (!config.apiKey) {
    throw new Error('no_api_key');
  }

  if (!navigator.onLine) {
    throw new Error('network_error');
  }

  const response = await fetch('https://api.sarvam.ai/translate', {
    method: 'POST',
    headers: {
      'API-Subscription-Key': config.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: englishText,
      source_language_code: 'en-IN',
      target_language_code: 'te-IN',
      mode: 'classic-colloquial',
      model: 'mayura:v1',
      enable_preprocessing: true,
    }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('invalid_key');
    }
    if (response.status === 429) {
      throw new Error('rate_limit');
    }
    if (response.status >= 500) {
      throw new Error('server_error');
    }
    throw new Error('translate_failed');
  }

  const data = (await response.json()) as { translated_text?: string };
  const translated = data.translated_text ?? englishText;

  // Cache the result (evict oldest if full)
  if (translationCache.size >= CACHE_MAX) {
    const firstKey = translationCache.keys().next().value;
    if (firstKey !== undefined) {
      translationCache.delete(firstKey);
    }
  }
  translationCache.set(englishText, translated);

  return translated;
}

/**
 * Translate English text to Telugu, returning original on failure.
 * Use this when you want silent fallback (no error thrown).
 */
export async function translateToTeluguSafe(englishText: string): Promise<string> {
  try {
    return await translateToTelugu(englishText);
  } catch {
    return englishText;
  }
}
