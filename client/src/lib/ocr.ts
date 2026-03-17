/**
 * Rythu Mitra -- OCR via Mistral Vision API
 *
 * Replaces Tesseract.js. Mistral OCR is a vision model that handles:
 *   - Blurry/skewed farmer bill photos natively
 *   - Telugu + English mixed text
 *   - Compression artifacts from cheap Android cameras
 *
 * No 30-50MB language pack downloads. No UI thread blocking.
 * Result is clean markdown text, extracted in one API round-trip.
 *
 * Fallback: if no Mistral key, sends image to Sarvam chat with a
 * "read this bill" prompt and parses the response.
 */

import { loadConfig } from './sarvam';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface OcrConfig {
  mistralApiKey: string;
}

const MISTRAL_KEY_STORAGE = 'rythu_mitra_mistral_key';
const MISTRAL_OCR_URL = 'https://api.mistral.ai/v1/ocr';
const SARVAM_BASE = 'https://api.sarvam.ai';

export function loadOcrConfig(): OcrConfig {
  try {
    const raw = localStorage.getItem(MISTRAL_KEY_STORAGE);
    return { mistralApiKey: raw ?? '' };
  } catch {
    return { mistralApiKey: '' };
  }
}

export function saveOcrConfig(config: OcrConfig): void {
  localStorage.setItem(MISTRAL_KEY_STORAGE, config.mistralApiKey);
}

export function hasOcrKey(): boolean {
  return loadOcrConfig().mistralApiKey.length > 0;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OcrResult {
  /** Raw extracted text (markdown from Mistral, plain text from fallback) */
  text: string;
  /** 0-1 estimated from response quality */
  confidence: number;
  /** Which provider handled the request */
  provider: 'mistral' | 'fallback';
}

// ---------------------------------------------------------------------------
// Image utilities
// ---------------------------------------------------------------------------

/**
 * Convert a File or Blob to a base64 data URL.
 *
 * Returns a string like "data:image/jpeg;base64,/9j/4AAQ..."
 * This is the format Mistral OCR expects for image_base64 documents.
 */
export async function imageToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader did not produce a string result'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Mistral OCR API types
// ---------------------------------------------------------------------------

interface MistralOcrResponse {
  pages?: Array<{
    markdown?: string;
    images?: unknown[];
    dimensions?: { width: number; height: number };
  }>;
}

// ---------------------------------------------------------------------------
// Main OCR function
// ---------------------------------------------------------------------------

/**
 * Send an image to Mistral OCR and get back structured text.
 *
 * POST https://api.mistral.ai/v1/ocr
 * Model: mistral-ocr-latest
 * Document type: image_base64
 *
 * Falls back to Sarvam chat if no Mistral key is configured.
 *
 * @param imageBase64 - data URL string ("data:image/jpeg;base64,...")
 * @returns OcrResult with extracted text and confidence estimate
 */
export async function performOcr(imageBase64: string): Promise<OcrResult> {
  const ocrCfg = loadOcrConfig();

  if (ocrCfg.mistralApiKey) {
    return performMistralOcr(imageBase64, ocrCfg.mistralApiKey);
  }

  // No Mistral key — fall back to Sarvam chat vision
  return performSarvamFallback(imageBase64);
}

async function performMistralOcr(imageBase64: string, apiKey: string): Promise<OcrResult> {
  const response = await fetch(MISTRAL_OCR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: {
        type: 'image_base64',
        image_base64: imageBase64,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Mistral OCR failed (${response.status}): ${err}`);
  }

  const data = (await response.json()) as MistralOcrResponse;
  const pages = data.pages ?? [];

  // Concatenate markdown from all pages (bills are usually 1 page)
  const text = pages
    .map(p => p.markdown ?? '')
    .filter(t => t.trim().length > 0)
    .join('\n\n')
    .trim();

  // Confidence heuristic: more text = higher confidence, capped at 0.95
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const confidence = Math.min(0.95, 0.4 + (wordCount / 100) * 0.55);

  return { text, confidence, provider: 'mistral' };
}

async function performSarvamFallback(imageBase64: string): Promise<OcrResult> {
  const sarvamCfg = loadConfig();

  if (!sarvamCfg.apiKey) {
    return {
      text: '',
      confidence: 0,
      provider: 'fallback',
    };
  }

  // Send image as a message to Sarvam chat with explicit bill-reading instruction
  const response = await fetch(`${SARVAM_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'API-Subscription-Key': sarvamCfg.apiKey,
    },
    body: JSON.stringify({
      model: sarvamCfg.chatModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Read this bill/receipt and extract all text. Include all amounts, product names, dates, and totals. Respond with just the extracted text.',
            },
            {
              type: 'image_url',
              image_url: { url: imageBase64 },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    return { text: '', confidence: 0, provider: 'fallback' };
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = (data.choices?.[0]?.message?.content ?? '').trim();
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const confidence = Math.min(0.75, 0.3 + (wordCount / 80) * 0.45);

  return { text, confidence, provider: 'fallback' };
}

// ---------------------------------------------------------------------------
// Bill data extraction
// ---------------------------------------------------------------------------

/**
 * Extract structured bill data from OCR text.
 *
 * Looks for Telugu and English patterns:
 *   - Rupee amounts: ₹, Rs, రూ
 *   - Total keywords: Total, మొత్తం, Grand Total, Net Amount
 *   - Shop names: first line or "Shop:" prefix
 *   - Dates: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
 *   - Line items: "ProductName  quantity  price" rows
 *
 * All amounts are returned in paise (rupees * 100).
 */
export function extractBillData(ocrText: string): {
  totalAmount?: number;
  items?: Array<{ name: string; amount: number }>;
  shopName?: string;
  date?: string;
} {
  const result: {
    totalAmount?: number;
    items?: Array<{ name: string; amount: number }>;
    shopName?: string;
    date?: string;
  } = {};

  if (!ocrText || !ocrText.trim()) {
    return result;
  }

  // ---- Total amount (highest priority: explicit total line) ----
  const totalPatterns = [
    // "Total: 1,200.00" or "Total ₹1200"
    /(?:Total|Grand\s*Total|Net\s*Amount|Bill\s*Amount|Amount\s*Due|మొత్తం|Total\s*Amount)\s*[:\-=]?\s*₹?\s*Rs?\.?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    // "₹1200" standalone with rupee symbol
    /₹\s*([\d,]+(?:\.\d{1,2})?)/g,
    // "Rs 1200" or "Rs.1200"
    /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    // "రూ.1200"
    /రూ\.?\s*([\d,]+(?:\.\d{1,2})?)/g,
    // "1200/- only" Indian billing convention
    /([\d,]{3,}(?:\.\d{1,2})?)\s*\/\-/g,
  ];

  const allAmounts: number[] = [];

  for (const pattern of totalPatterns) {
    let match: RegExpExecArray | null;
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    while ((match = pattern.exec(ocrText)) !== null) {
      const raw = match[1].replace(/,/g, '');
      const num = parseFloat(raw);
      if (!isNaN(num) && num > 0 && num < 10_000_000) {
        allAmounts.push(num);
      }
    }
  }

  if (allAmounts.length > 0) {
    // The largest amount is most likely the total (bill totals > line items)
    const maxAmount = Math.max(...allAmounts);
    result.totalAmount = Math.round(maxAmount * 100); // convert to paise
  }

  // ---- Date ----
  const datePatterns = [
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/,   // DD/MM/YYYY
    /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/,      // YYYY-MM-DD
  ];

  for (const dp of datePatterns) {
    const dm = dp.exec(ocrText);
    if (dm) {
      result.date = dm[0];
      break;
    }
  }

  // ---- Shop name ----
  // First non-empty line that is not a date or pure number is likely the shop name
  const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  for (const line of lines.slice(0, 4)) {
    const isDateLike = /^\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}$/.test(line);
    const isNumberOnly = /^[\d,₹Rs\s.]+$/.test(line);
    const isShortCode = line.length < 3;
    if (!isDateLike && !isNumberOnly && !isShortCode) {
      result.shopName = line;
      break;
    }
  }

  // ---- Line items ----
  // Pattern: "<name>  <amount>" or "<name> x<qty> = <amount>"
  const itemPattern = /^(.{3,30}?)\s+(?:x\d+\s*[=×]\s*)?₹?\s*([\d,]{2,}(?:\.\d{1,2})?)$/gm;
  const items: Array<{ name: string; amount: number }> = [];

  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemPattern.exec(ocrText)) !== null) {
    const name = itemMatch[1].trim();
    const amt = parseFloat(itemMatch[2].replace(/,/g, ''));
    if (!isNaN(amt) && amt > 0 && name.length >= 3) {
      items.push({ name, amount: Math.round(amt * 100) }); // paise
    }
  }

  if (items.length > 0) {
    result.items = items;
  }

  return result;
}
