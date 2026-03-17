/**
 * Centralized error handling for AI features in Rythu Mitra.
 *
 * All user-facing error messages are in Telugu.
 * Maps HTTP status codes, network errors, and API error types
 * to localized messages with appropriate toast severity.
 */

import { showToast } from './toast';

// ---------------------------------------------------------------------------
// Telugu error message catalog
// ---------------------------------------------------------------------------

export const AI_ERRORS_TE: Record<string, string> = {
  no_api_key:       'API కీ సెట్ చేయబడలేదు. సెట్టింగ్స్‌లో నమోదు చేయండి.',
  network_error:    'ఇంటర్నెట్ కనెక్షన్ లేదు. మళ్ళీ ప్రయత్నించండి.',
  rate_limit:       'చాలా అభ్యర్థనలు. కొద్దిసేపు వేచి ఉండండి.',
  stt_failed:       'మాట గుర్తింపు విఫలమైంది. మళ్ళీ చెప్పండి.',
  tts_failed:       'ఆడియో ప్లేబ్యాక్ విఫలమైంది.',
  translate_failed: 'అనువాదం విఫలమైంది.',
  invalid_key:      'API కీ చెల్లదు. సెట్టింగ్స్‌లో తనిఖీ చేయండి.',
  server_error:     'సర్వర్ లోపం. మళ్ళీ ప్రయత్నించండి.',
  mic_denied:       'మైక్రోఫోన్ అనుమతి నిరాకరించబడింది.',
  audio_playback:   'ఆడియో ప్లే చేయడం సాధ్యం కాలేదు.',
  parse_failed:     'మొత్తం అర్థం కాలేదు. మళ్ళీ చెప్పండి.',
  timeout:          'అభ్యర్థన సమయం ముగిసింది. మళ్ళీ ప్రయత్నించండి.',
  unknown:          'ఏదో తప్పు జరిగింది. మళ్ళీ ప్రయత్నించండి.',
};

// ---------------------------------------------------------------------------
// Error-to-toast-type mapping
// ---------------------------------------------------------------------------

const ERROR_SEVERITY: Record<string, 'default' | 'warning' | 'alert'> = {
  no_api_key:       'warning',
  network_error:    'warning',
  rate_limit:       'warning',
  stt_failed:       'alert',
  tts_failed:       'default',   // TTS failure is non-critical
  translate_failed: 'default',   // Translation failure is non-critical
  invalid_key:      'alert',
  server_error:     'warning',
  mic_denied:       'alert',
  audio_playback:   'default',
  parse_failed:     'warning',
  timeout:          'warning',
  unknown:          'warning',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Handle an AI feature error:
 *  1. Classify the error into a known error code
 *  2. Show a Telugu toast with appropriate severity
 *  3. Return the Telugu error message string
 *
 * @param error    - The caught error (unknown type)
 * @param context  - Which feature failed: 'stt' | 'tts' | 'translate' | 'chat'
 * @returns Telugu error message string
 */
export function handleAIError(error: unknown, context: string): string {
  const code = classifyError(error, context);
  const message = AI_ERRORS_TE[code] ?? AI_ERRORS_TE.unknown;
  const severity = ERROR_SEVERITY[code] ?? 'warning';

  showToast(message, severity, 5000);
  return message;
}

/**
 * Classify an unknown error into a known error code.
 * Inspects error message strings, HTTP status codes, and error types.
 */
function classifyError(error: unknown, context: string): string {
  if (!error) return 'unknown';

  const msg = error instanceof Error ? error.message : String(error);

  // Direct error code match (thrown by our modules)
  if (msg in AI_ERRORS_TE) return msg;

  // HTTP status patterns
  if (msg.includes('401') || msg.includes('403') || msg.includes('invalid')) {
    return 'invalid_key';
  }
  if (msg.includes('429') || msg.includes('rate') || msg.includes('throttl')) {
    return 'rate_limit';
  }
  if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
    return 'server_error';
  }

  // Network patterns
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'network_error';
  }
  if (msg.includes('timeout') || msg.includes('AbortError')) {
    return 'timeout';
  }

  // Microphone permission
  if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
    return 'mic_denied';
  }

  // Context-specific fallbacks
  switch (context) {
    case 'stt':       return 'stt_failed';
    case 'tts':       return 'tts_failed';
    case 'translate': return 'translate_failed';
    default:          return 'unknown';
  }
}

/**
 * Get the Telugu error message for a known error code
 * without showing a toast. Useful for inline error display.
 */
export function getErrorMessage(code: string): string {
  return AI_ERRORS_TE[code] ?? AI_ERRORS_TE.unknown;
}
