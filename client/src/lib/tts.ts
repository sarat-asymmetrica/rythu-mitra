/**
 * Text-to-Speech service for Rythu Mitra.
 *
 * Uses Sarvam Bulbul v3 to speak Telugu confirmations aloud.
 * Reads API key from the same localStorage config as sarvam.ts.
 *
 * POST https://api.sarvam.ai/text-to-speech
 * Header: api-subscription-key
 *
 * Response: { "audios": ["base64_encoded_mp3"] }
 */

import { loadConfig } from './sarvam';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TTSOptions {
  text: string;
  language?: string;   // default: "te-IN"
  speaker?: string;    // default: "meera" (Telugu female)
  pace?: number;       // default: 1.0
}

// ---------------------------------------------------------------------------
// Internal: call Sarvam TTS API
// ---------------------------------------------------------------------------

async function callTTS(options: TTSOptions): Promise<Blob> {
  const config = loadConfig();

  if (!config.apiKey) {
    throw new Error('no_api_key');
  }

  if (!navigator.onLine) {
    throw new Error('network_error');
  }

  const response = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {
      'API-Subscription-Key': config.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: options.text,
      target_language_code: options.language ?? 'te-IN',
      speaker: options.speaker ?? 'meera',
      model: 'bulbul:v3',
      pace: options.pace ?? 1.0,
      speech_sample_rate: 22050,
      output_audio_codec: 'mp3',
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
    throw new Error('tts_failed');
  }

  const data = (await response.json()) as { audios?: string[] };
  const base64Audio = data.audios?.[0];

  if (!base64Audio) {
    throw new Error('tts_failed');
  }

  // Decode base64 to Blob
  const byteString = atob(base64Audio);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'audio/mpeg' });
}

// ---------------------------------------------------------------------------
// Public: Play Telugu speech (fire-and-forget safe)
// ---------------------------------------------------------------------------

// Track the current audio to prevent overlapping playback
let currentAudio: HTMLAudioElement | null = null;

/**
 * Speak Telugu text aloud via Sarvam Bulbul v3.
 * Non-blocking: returns immediately after scheduling playback.
 * If TTS fails for any reason, resolves silently (never throws).
 */
export async function speakTelugu(text: string): Promise<void> {
  try {
    const blob = await callTTS({ text });

    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      if (currentAudio.src) {
        URL.revokeObjectURL(currentAudio.src);
      }
    }

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;

    // Clean up object URL when done
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
    };

    await audio.play();
  } catch {
    // TTS failure is non-critical; degrade silently
  }
}

/**
 * Speak Telugu text, but throw on failure (for explicit error handling).
 * Use this when you want to show a specific error message to the user.
 */
export async function speakTeluguOrThrow(text: string): Promise<void> {
  const blob = await callTTS({ text });

  if (currentAudio) {
    currentAudio.pause();
    if (currentAudio.src) {
      URL.revokeObjectURL(currentAudio.src);
    }
  }

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;

  audio.onended = () => {
    URL.revokeObjectURL(url);
    if (currentAudio === audio) currentAudio = null;
  };
  audio.onerror = () => {
    URL.revokeObjectURL(url);
    if (currentAudio === audio) currentAudio = null;
  };

  await audio.play();
}

// ---------------------------------------------------------------------------
// Telugu category labels for TTS confirmation strings
// ---------------------------------------------------------------------------

const CATEGORY_TELUGU: Record<string, string> = {
  LaborPayment: 'కూలి',
  InputPurchase: 'కొనుగోలు',
  CropSale: 'అమ్మకం',
  GovernmentTransfer: 'సర్కారు బదిలీ',
  UPIPayment: 'UPI చెల్లింపు',
  Other: 'ఇతర',
  // UI kind names
  labor: 'కూలి',
  seeds: 'విత్తనాలు',
  fertilizer: 'ఎరువులు',
  irrigation: 'నీటిపారుదల',
  transport: 'రవాణా',
  crop_sale: 'అమ్మకం',
  govt_subsidy: 'సర్కారు బదిలీ',
  other: 'ఇతర',
};

/**
 * Build a Telugu TTS confirmation string for a saved expense.
 * Example: "రూపాయలు 800 కూలి నమోదు అయింది"
 */
export function buildConfirmationText(
  amountRupees: number,
  kind: string,
): string {
  const category = CATEGORY_TELUGU[kind] ?? 'ఇతర';
  return `రూపాయలు ${amountRupees.toLocaleString('en-IN')} ${category} నమోదు అయింది`;
}

/**
 * Build a TTS string for reading a mandi price aloud.
 * Example: "అనంతపురం వేరుశెనగ ధర క్వింటాలుకు రూపాయలు 5,840"
 */
export function buildPriceReadout(
  mandiName: string,
  cropName: string,
  pricePerQuintal: number,
): string {
  return `${mandiName} ${cropName} ధర క్వింటాలుకు రూపాయలు ${pricePerQuintal.toLocaleString('en-IN')}`;
}
