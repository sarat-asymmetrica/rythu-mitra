/**
 * Rythu Mitra -- Client-Side OCR via Tesseract.js
 *
 * Processes dealer bill photos (fertilizer, pesticide receipts) using
 * Tesseract.js with Telugu + English language support.
 *
 * Preprocessing pipeline (adapted from NormalizerKernel.cs + BentoPDF ocr.ts):
 *   1. Resolution upscaling (small images -> 1500px min width)
 *   2. Grayscale conversion (perceptual weights: 0.299R + 0.587G + 0.114B)
 *   3. Adaptive contrast (histogram-based, not fixed multiplier)
 *   4. Otsu binarization (optimal threshold, better than fixed 128)
 *
 * The Telugu language pack (~30-50MB) is downloaded on first use and
 * cached by Tesseract.js in the browser.
 */

import Tesseract from 'tesseract.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OcrResult {
  rawText: string;
  confidence: number;     // 0-100 from Tesseract
  amounts: number[];      // Extracted rupee amounts
  dateStrings: string[];  // Extracted dates (DD/MM/YYYY etc.)
  productNames: string[]; // Extracted product/item names
  summary: string;        // Human-readable Telugu summary
}

export type OcrProgress = {
  status: string;
  progress: number; // 0-1
};

// ---------------------------------------------------------------------------
// Common fertilizer/pesticide product names (Telugu + English)
// ---------------------------------------------------------------------------

const PRODUCT_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  // Fertilizers
  { pattern: /యూరియా|urea/i, name: 'యూరియా' },
  { pattern: /DAP/i, name: 'DAP' },
  { pattern: /MOP|పొటాష్/i, name: 'MOP' },
  { pattern: /NPK/i, name: 'NPK' },
  { pattern: /SSP/i, name: 'SSP' },
  { pattern: /జింక్\s*సల్ఫేట్|zinc\s*sulph/i, name: 'జింక్ సల్ఫేట్' },
  { pattern: /బోరాన్|boron/i, name: 'బోరాన్' },
  { pattern: /గ్రాన్యుల్|granule/i, name: 'గ్రాన్యులర్ ఎరువు' },
  { pattern: /నానో\s*యూరియా|nano\s*urea/i, name: 'నానో యూరియా' },
  // Pesticides
  { pattern: /ఇమిడాక్లోప్రిడ్|imidacloprid/i, name: 'ఇమిడాక్లోప్రిడ్' },
  { pattern: /క్లోరోపైరిఫాస్|chlorpyrifos/i, name: 'క్లోరోపైరిఫాస్' },
  { pattern: /మాంకోజెబ్|mancozeb/i, name: 'మాంకోజెబ్' },
  { pattern: /కార్బెండాజిమ్|carbendazim/i, name: 'కార్బెండాజిమ్' },
  { pattern: /నీమ్\s*ఆయిల్|neem\s*oil|వేప\s*నూనె/i, name: 'వేప నూనె' },
  { pattern: /ఎసిఫేట్|acephate/i, name: 'ఎసిఫేట్' },
  { pattern: /మోనోక్రోటోఫాస్|monocrotophos/i, name: 'మోనోక్రోటోఫాస్' },
  // Seeds
  { pattern: /విత్తనాలు|seeds?/i, name: 'విత్తనాలు' },
  { pattern: /వేరుశెనగ|groundnut|peanut/i, name: 'వేరుశెనగ' },
  { pattern: /పత్తి|cotton/i, name: 'పత్తి' },
  { pattern: /మిరప|mirchi|chilli/i, name: 'మిరప' },
  { pattern: /వరి|paddy|rice/i, name: 'వరి' },
  // Generic units
  { pattern: /బస్తా|bag/i, name: 'బస్తా' },
  { pattern: /లీటర్|litre|liter|lt/i, name: 'లీటర్' },
  { pattern: /కిలో|kg|kilo/i, name: 'కిలో' },
];

// ---------------------------------------------------------------------------
// Image Preprocessing Pipeline (Improved)
// ---------------------------------------------------------------------------

/**
 * Preprocess an image file for better OCR accuracy.
 *
 * Pipeline:
 *   1. Load image
 *   2. Upscale small images (min 1500px width for OCR accuracy)
 *   3. Convert to grayscale
 *   4. Adaptive contrast enhancement
 *   5. Otsu binarization
 */
async function preprocessImage(file: File | Blob): Promise<HTMLCanvasElement> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');

  // Step 1: Calculate dimensions -- upscale small images, cap large ones
  const MIN_OCR_WIDTH = 1500;
  const MAX_DIM = 3000;

  let targetWidth = img.width;
  let targetHeight = img.height;

  // Upscale small images for better OCR
  if (targetWidth < MIN_OCR_WIDTH) {
    const scale = MIN_OCR_WIDTH / targetWidth;
    targetWidth = Math.round(targetWidth * scale);
    targetHeight = Math.round(targetHeight * scale);
  }

  // Cap max dimension
  const maxCurrent = Math.max(targetWidth, targetHeight);
  if (maxCurrent > MAX_DIM) {
    const scale = MAX_DIM / maxCurrent;
    targetWidth = Math.round(targetWidth * scale);
    targetHeight = Math.round(targetHeight * scale);
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  // Draw original at target resolution
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // Step 2: Convert to grayscale (perceptual weights from BentoPDF)
  toGrayscale(ctx, targetWidth, targetHeight);

  // Step 3: Adaptive contrast (histogram-aware, not fixed multiplier)
  adaptiveContrast(ctx, targetWidth, targetHeight);

  // Step 4: Otsu binarization (optimal threshold)
  otsuBinarize(ctx, targetWidth, targetHeight);

  return canvas;
}

/** Load a File/Blob as an HTMLImageElement. */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Convert image to grayscale using perceptual luminance weights.
 * Formula: Y = 0.299*R + 0.587*G + 0.114*B (ITU-R BT.601)
 * Same weights used in BentoPDF binarizeCanvas.
 */
function toGrayscale(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Adaptive contrast enhancement based on image histogram.
 *
 * Instead of a fixed 1.4x multiplier (which can blow out already-bright
 * images or under-correct dark ones), we measure the actual standard
 * deviation of pixel values and adjust accordingly:
 *   - Low contrast (stddev < 40): apply 1.6x
 *   - Normal contrast (40-80): apply 1.3x
 *   - High contrast (>80): skip (already fine)
 */
function adaptiveContrast(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Calculate mean and standard deviation of luminance
  let sum = 0;
  let sumSq = 0;
  const pixelCount = w * h;

  for (let i = 0; i < data.length; i += 4) {
    const val = data[i]; // Already grayscale, R=G=B
    sum += val;
    sumSq += val * val;
  }

  const mean = sum / pixelCount;
  const variance = (sumSq / pixelCount) - (mean * mean);
  const stddev = Math.sqrt(Math.max(0, variance));

  // Choose contrast factor based on measured stddev
  let factor: number;
  if (stddev < 40) {
    factor = 1.6;  // Low contrast thermal prints, faded bills
  } else if (stddev < 80) {
    factor = 1.3;  // Normal -- slight boost
  } else {
    return;        // High contrast -- skip, already good
  }

  const intercept = 128 * (1 - factor);
  for (let i = 0; i < data.length; i += 4) {
    const val = Math.max(0, Math.min(255, factor * data[i] + intercept));
    data[i] = data[i + 1] = data[i + 2] = val;
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Otsu's binarization -- find the optimal threshold that minimizes
 * intra-class variance. Much better than a fixed threshold (128)
 * for variable lighting conditions in field photos.
 *
 * Algorithm: compute histogram, find threshold that minimizes
 * weighted sum of within-class variances.
 */
function otsuBinarize(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const pixelCount = w * h;

  // Build histogram (256 bins)
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]]++;
  }

  // Find Otsu threshold
  let bestThreshold = 128;
  let bestVariance = 0;

  let w0 = 0;
  let sum0 = 0;
  let totalSum = 0;

  for (let t = 0; t < 256; t++) {
    totalSum += t * histogram[t];
  }

  for (let t = 0; t < 256; t++) {
    w0 += histogram[t];
    if (w0 === 0) continue;
    const w1 = pixelCount - w0;
    if (w1 === 0) break;

    sum0 += t * histogram[t];
    const mean0 = sum0 / w0;
    const mean1 = (totalSum - sum0) / w1;
    const betweenVariance = w0 * w1 * (mean0 - mean1) * (mean0 - mean1);

    if (betweenVariance > bestVariance) {
      bestVariance = betweenVariance;
      bestThreshold = t;
    }
  }

  // Apply threshold
  for (let i = 0; i < data.length; i += 4) {
    const val = data[i] > bestThreshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = val;
  }
  ctx.putImageData(imageData, 0, 0);
}

// ---------------------------------------------------------------------------
// Text Parsing (Improved)
// ---------------------------------------------------------------------------

/** Extract rupee amounts from OCR text. */
function extractAmounts(text: string): number[] {
  const amounts: number[] = [];
  const patterns = [
    /₹\s*([\d,]+(?:\.\d{1,2})?)/g,                                      // ₹500, ₹1,200.00
    /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/gi,                                  // Rs 500, Rs.1200
    /రూ\.?\s*([\d,]+(?:\.\d{1,2})?)/g,                                   // రూ.500
    /(?:Total|మొత్తం|Grand\s*Total|Net\s*Amount|Bill\s*Amount)\s*[:\-=]?\s*₹?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /(\d{2,}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:rupees|రూపాయలు)/gi,         // 500 rupees
    /(\d{3,}(?:,\d{3})*)\s*(?:\/\-|only)/gi,                             // 500/- or 500 only
    /(?:amt|amount|total)\s*[:\-=]?\s*(\d{2,}(?:,\d{3})*(?:\.\d{1,2})?)/gi, // amt: 500
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const num = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(num) && num > 0 && num < 10_000_000) {
        amounts.push(num);
      }
    }
  }

  // Deduplicate
  return [...new Set(amounts)].sort((a, b) => b - a);
}

/** Extract date strings from OCR text. */
function extractDates(text: string): string[] {
  const dates: string[] = [];
  const patterns = [
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g,  // DD/MM/YYYY or DD-MM-YYYY
    /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/g,     // YYYY-MM-DD
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      dates.push(match[0]);
    }
  }

  return [...new Set(dates)];
}

/** Extract product names from OCR text. */
function extractProducts(text: string): string[] {
  const found: string[] = [];
  for (const { pattern, name } of PRODUCT_PATTERNS) {
    if (pattern.test(text)) {
      found.push(name);
    }
  }
  return [...new Set(found)];
}

/** Build a Telugu summary of OCR results. */
function buildSummary(amounts: number[], products: string[], dates: string[]): string {
  const parts: string[] = [];

  if (amounts.length > 0) {
    const largest = amounts[0];
    parts.push(`\u0C2E\u0C4A\u0C24\u0C4D\u0C24\u0C02: \u20B9${largest.toLocaleString('en-IN')}`);
    if (amounts.length > 1) {
      parts.push(`(${amounts.length} amounts \u0C15\u0C28\u0C41\u0C17\u0C4A\u0C28\u0C2C\u0C21\u0C4D\u0C21\u0C3E\u0C2F\u0C3F)`);
    }
  }

  if (products.length > 0) {
    parts.push(`\u0C35\u0C38\u0C4D\u0C24\u0C41\u0C35\u0C41\u0C32\u0C41: ${products.join(', ')}`);
  }

  if (dates.length > 0) {
    parts.push(`\u0C24\u0C47\u0C26\u0C40: ${dates[0]}`);
  }

  return parts.length > 0
    ? parts.join(' | ')
    : '\u0C1F\u0C46\u0C15\u0C4D\u0C38\u0C4D\u0C1F\u0C4D \u0C1A\u0C26\u0C35\u0C17\u0C32\u0C3F\u0C17\u0C3E\u0C2E\u0C41 \u0C15\u0C3E\u0C28\u0C40 amounts/products \u0C17\u0C41\u0C30\u0C4D\u0C24\u0C3F\u0C02\u0C1A\u0C32\u0C47\u0C15\u0C2A\u0C4B\u0C2F\u0C3E\u0C2E\u0C41';
}

// ---------------------------------------------------------------------------
// Main OCR Function
// ---------------------------------------------------------------------------

/**
 * Process an image file through Tesseract.js OCR.
 *
 * Languages: Telugu (tel) + English (eng).
 * First call downloads ~30-50MB of language packs (cached after that).
 *
 * @param imageFile - The image File or Blob to process
 * @param onProgress - Optional progress callback for UI updates
 * @returns Structured OCR result with amounts, dates, products
 */
export async function processImage(
  imageFile: File | Blob,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
  const progress = onProgress ?? (() => {});

  // Step 1: Preprocess image (upscale + grayscale + adaptive contrast + Otsu)
  progress({ status: '\u0C1A\u0C3F\u0C24\u0C4D\u0C30\u0C02 \u0C38\u0C3F\u0C26\u0C4D\u0C27\u0C02 \u0C1A\u0C47\u0C38\u0C4D\u0C24\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C2E\u0C41...', progress: 0.05 });
  const canvas = await preprocessImage(imageFile);

  // Step 2: Create Tesseract worker with Telugu + English
  progress({ status: '\u0C2D\u0C3E\u0C37 \u0C21\u0C47\u0C1F\u0C3E \u0C32\u0C4B\u0C21\u0C4D \u0C05\u0C35\u0C41\u0C24\u0C4B\u0C02\u0C26\u0C3F...', progress: 0.1 });

  const worker = await Tesseract.createWorker('tel+eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      // Map Tesseract progress (0-1 per phase) to our overall progress (0.1-0.9)
      const mapped = 0.1 + m.progress * 0.7;
      progress({ status: m.status === 'recognizing text' ? '\u0C1A\u0C26\u0C41\u0C35\u0C41\u0C24\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C2E\u0C41...' : m.status, progress: mapped });
    },
  });

  try {
    // Step 3: Set Tesseract parameters for better accuracy
    // PSM 3 = Fully automatic page segmentation (default, good for bills)
    // OEM 1 = LSTM neural net mode (more accurate than legacy)
    // NOTE: Do NOT use tessedit_char_whitelist -- it would block Telugu characters
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    });

    // Step 4: Recognize text
    progress({ status: '\u0C1A\u0C26\u0C41\u0C35\u0C41\u0C24\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C2E\u0C41...', progress: 0.3 });
    const { data } = await worker.recognize(canvas);

    // Step 5: Parse extracted text
    progress({ status: '\u0C35\u0C3F\u0C36\u0C4D\u0C32\u0C47\u0C37\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C2E\u0C41...', progress: 0.85 });
    const rawText = data.text.trim();
    const confidence = data.confidence;
    const amounts = extractAmounts(rawText);
    const dateStrings = extractDates(rawText);
    const productNames = extractProducts(rawText);
    const summary = buildSummary(amounts, productNames, dateStrings);

    progress({ status: '\u0C2A\u0C42\u0C30\u0C4D\u0C24\u0C2F\u0C3F\u0C02\u0C26\u0C3F!', progress: 1.0 });

    // Release canvas memory
    canvas.width = 0;
    canvas.height = 0;

    return {
      rawText,
      confidence,
      amounts,
      dateStrings,
      productNames,
      summary,
    };
  } finally {
    await worker.terminate();
  }
}
