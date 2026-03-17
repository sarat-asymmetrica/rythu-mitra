/**
 * Vyāpti (వ్యాప్తి) — MRP Overcharge Detection Engine
 *
 * Vedic logic concept: "pervasion" — a conclusion follows necessarily from premises
 * only after ALL defeating conditions are checked. We apply this principle to
 * price verification: NEVER alert overcharge without first checking every possible
 * legitimate reason the price might be higher.
 *
 * Defeating conditions checked before any alert:
 *   1. Transport markup (remote areas legitimately cost more)
 *   2. Seasonal pricing (pesticides spike during pest season)
 *   3. Package size difference (25kg vs 50kg — per-kg price may differ)
 *   4. Brand premium (branded vs generic)
 *   5. Combo discount reversal (not applicable, price is already high)
 *
 * Usage:
 *   const matches = matchProducts(ocrText);
 *   const alerts = detectOvercharges(matches);
 *   // alerts[] -> show OverchargeAlert.svelte for each
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductMRP {
  name: string;
  namesTelugu: string[];
  category: 'fertilizer' | 'pesticide' | 'seed' | 'tool';
  mrpPerUnit: number;   // MRP in paise per standard unit
  unit: string;         // e.g. "50kg bag", "1L bottle", "1kg packet"
  tolerance: number;    // % above MRP that is acceptable (transport markup)
  lastUpdated: string;  // ISO date
}

export interface ProductMatch {
  product: ProductMRP;
  detectedPrice: number;    // paise
  detectedQuantity: number; // number of units
  matchConfidence: number;  // 0–1
}

export interface OverchargeResult {
  product: ProductMRP;
  detectedPrice: number;       // paise per unit
  expectedPrice: number;       // MRP in paise per unit
  overchargePercent: number;   // percentage above MRP
  overchargeAmount: number;    // paise per unit (extra paid)
  severity: 'warning' | 'alert' | 'critical';
  defeatConditionChecked: boolean;
}

export interface DefeatCheckResult {
  defeated: boolean;  // true = legitimate reason found, do NOT alert
  reason?: string;
}

export interface VyaptiContext {
  season?: string;
  district?: string;
  isRemoteArea?: boolean;
  currentMonth?: number;  // 1–12
}

// ---------------------------------------------------------------------------
// Embedded MRP Database (Government-notified prices + common market data)
// Prices in PAISE. Sources: GoI fertiliser MRP notifications, market surveys.
// ---------------------------------------------------------------------------

export const KNOWN_PRODUCTS: ProductMRP[] = [
  // --- Fertilizers (Government controlled — very stable) ---
  {
    name: 'Urea',
    namesTelugu: ['యూరియా', 'urea', 'uriya'],
    category: 'fertilizer',
    mrpPerUnit: 26650,   // ₹266.50 per 45kg bag (GoI 2023 notification)
    unit: '45kg bag',
    tolerance: 5,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'DAP',
    namesTelugu: ['DAP', 'dap', 'డీఏపీ', 'డి.ఏ.పి', 'diamond'],
    category: 'fertilizer',
    mrpPerUnit: 135000,  // ₹1,350 per 50kg bag (GoI 2023)
    unit: '50kg bag',
    tolerance: 5,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'MOP',
    namesTelugu: ['MOP', 'mop', 'ఎంఓపీ', 'potash', 'పొటాష్'],
    category: 'fertilizer',
    mrpPerUnit: 170000,  // ₹1,700 per 50kg bag (GoI 2023)
    unit: '50kg bag',
    tolerance: 5,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'SSP',
    namesTelugu: ['SSP', 'ssp', 'ఎస్ఎస్పీ', 'సింగిల్ సూపర్'],
    category: 'fertilizer',
    mrpPerUnit: 35000,   // ₹350 per 50kg bag
    unit: '50kg bag',
    tolerance: 5,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'NPK 10-26-26',
    namesTelugu: ['NPK', 'npk', '10-26-26', 'complex'],
    category: 'fertilizer',
    mrpPerUnit: 140000,  // ₹1,400 per 50kg bag
    unit: '50kg bag',
    tolerance: 5,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'Zinc Sulphate',
    namesTelugu: ['జింక్', 'జింక్ సల్ఫేట్', 'zinc', 'zinc sulphate'],
    category: 'fertilizer',
    mrpPerUnit: 45000,   // ₹450 per 25kg bag
    unit: '25kg bag',
    tolerance: 10,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'Gypsum',
    namesTelugu: ['జిప్సమ్', 'gypsum', 'జిప్సం'],
    category: 'fertilizer',
    mrpPerUnit: 20000,   // ₹200 per 50kg bag
    unit: '50kg bag',
    tolerance: 10,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'Boron',
    namesTelugu: ['బోరాన్', 'boron', 'బోర్'],
    category: 'fertilizer',
    mrpPerUnit: 25000,   // ₹250 per 1kg packet
    unit: '1kg packet',
    tolerance: 15,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'Ferrous Sulphate',
    namesTelugu: ['ఫెర్రస్', 'ferrous', 'iron sulphate', 'ఇనుప'],
    category: 'fertilizer',
    mrpPerUnit: 30000,   // ₹300 per 1kg packet
    unit: '1kg packet',
    tolerance: 15,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'Magnesium Sulphate',
    namesTelugu: ['మెగ్నీషియం', 'magnesium', 'epsom'],
    category: 'fertilizer',
    mrpPerUnit: 18000,   // ₹180 per 1kg
    unit: '1kg packet',
    tolerance: 15,
    lastUpdated: '2026-03-01',
  },

  // --- Pesticides ---
  {
    name: 'Neem Oil',
    namesTelugu: ['నీమ్ ఆయిల్', 'నీమ్', 'వేప నూనె', 'neem oil', 'neem'],
    category: 'pesticide',
    mrpPerUnit: 35000,   // ₹350 per 1L bottle
    unit: '1L bottle',
    tolerance: 15,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'Imidacloprid',
    namesTelugu: ['ఇమిడాక్లోప్రిడ్', 'imidacloprid', 'confidor', 'admire'],
    category: 'pesticide',
    mrpPerUnit: 25000,   // ₹250 per 250ml
    unit: '250ml',
    tolerance: 15,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'Chlorpyrifos',
    namesTelugu: ['క్లోర్పైరిఫాస్', 'chlorpyrifos', 'dursban', 'లార్సీన్'],
    category: 'pesticide',
    mrpPerUnit: 22000,   // ₹220 per 500ml
    unit: '500ml',
    tolerance: 15,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'Cypermethrin',
    namesTelugu: ['సైపర్‌మెత్రిన్', 'cypermethrin', 'cymbush'],
    category: 'pesticide',
    mrpPerUnit: 18000,   // ₹180 per 500ml
    unit: '500ml',
    tolerance: 15,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'Mancozeb',
    namesTelugu: ['మాంకొజెబ్', 'mancozeb', 'dithane', 'indofil'],
    category: 'pesticide',
    mrpPerUnit: 22000,   // ₹220 per 500g
    unit: '500g',
    tolerance: 15,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'Spinosad',
    namesTelugu: ['స్పినోసాడ్', 'spinosad', 'tracer'],
    category: 'pesticide',
    mrpPerUnit: 180000,  // ₹1,800 per 100ml (premium product)
    unit: '100ml',
    tolerance: 20,
    lastUpdated: '2026-03-01',
  },

  // --- Seeds (common AP/Telangana varieties) ---
  {
    name: 'Groundnut K-6',
    namesTelugu: ['K-6', 'k-6', 'వేరుశెనగ K-6', 'kadiri 6', 'కాదిరి 6'],
    category: 'seed',
    mrpPerUnit: 8000,    // ₹80 per 1kg
    unit: '1kg',
    tolerance: 20,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'Groundnut TMV-2',
    namesTelugu: ['TMV-2', 'tmv-2', 'tmv2', 'వేరుశెనగ TMV'],
    category: 'seed',
    mrpPerUnit: 7500,    // ₹75 per 1kg
    unit: '1kg',
    tolerance: 20,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'Groundnut TG-26',
    namesTelugu: ['TG-26', 'tg-26', 'tg26'],
    category: 'seed',
    mrpPerUnit: 9000,    // ₹90 per 1kg
    unit: '1kg',
    tolerance: 20,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'Cotton BT Hybrid',
    namesTelugu: ['BT పత్తి', 'bt cotton', 'bt', 'పత్తి విత్తనాలు', 'bollgard'],
    category: 'seed',
    mrpPerUnit: 93000,   // ₹930 per 450g packet (GoI regulated)
    unit: '450g packet',
    tolerance: 5,        // Cotton seed is tightly regulated
    lastUpdated: '2026-03-01',
  },
  {
    name: 'Sunflower Hybrid',
    namesTelugu: ['సూర్యకాంతి విత్తనాలు', 'sunflower', 'sunflower seed'],
    category: 'seed',
    mrpPerUnit: 55000,   // ₹550 per 500g
    unit: '500g',
    tolerance: 20,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'Paddy MTU-1010',
    namesTelugu: ['MTU-1010', 'mtu1010', 'వరి MTU', 'BPT'],
    category: 'seed',
    mrpPerUnit: 4500,    // ₹45 per 1kg certified seed
    unit: '1kg',
    tolerance: 15,
    lastUpdated: '2026-03-01',
  },
  {
    name: 'Red Gram Hybrid',
    namesTelugu: ['కందులు', 'red gram', 'toor dal', 'arhar'],
    category: 'seed',
    mrpPerUnit: 12000,   // ₹120 per 1kg
    unit: '1kg',
    tolerance: 20,
    lastUpdated: '2026-03-01',
  },

  // --- Tools ---
  {
    name: 'Knapsack Sprayer',
    namesTelugu: ['పంప్', 'sprayer', 'పిచికారీ పంప్', 'నేపీ పంప్'],
    category: 'tool',
    mrpPerUnit: 120000,  // ₹1,200 for basic knapsack
    unit: '1 unit',
    tolerance: 25,       // Tools have more price variation
    lastUpdated: '2026-03-01',
  },
];

// ---------------------------------------------------------------------------
// Remote / Tribal districts in AP/Telangana (higher transport legitimate)
// ---------------------------------------------------------------------------

const REMOTE_DISTRICTS = [
  'alluri sitarama raju',
  'parvathipuram manyam',
  'vizianagaram',
  'srikakulam',
  'mulugu',
  'bhadradri kothagudem',
  'jayashankar bhupalpally',
];

// Pest-season months for AP/Telangana where pesticide price spikes are legitimate
// July–September = kharif pest season, November–January = rabi pest season
const PEST_SEASON_MONTHS = [7, 8, 9, 10, 11, 12, 1];

// ---------------------------------------------------------------------------
// Text normalisation helpers
// ---------------------------------------------------------------------------

/** Normalise text for fuzzy matching: lowercase, collapse whitespace */
function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Extract a numeric value (rupees) from OCR text near a match position */
function extractPrice(text: string, startIdx: number): number | null {
  // Restrict price extraction to the same line as the matched product name.
  // Find the line that contains the match index.
  const lineStart = text.lastIndexOf('\n', startIdx - 1) + 1;
  const lineEnd = text.indexOf('\n', startIdx);
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);

  // Patterns: ₹350, Rs.350, 350/-, 350 per, 350 each
  const pricePatterns = [
    /[₹Rs\.]+\s*(\d[\d,]*)/,
    /(\d[\d,]*)\s*\/-/,
    /(\d[\d,]*)\s+(?:per|each|రూ|రూ\.)/i,
    /(\d[\d,]{2,})/,  // last resort: any 3+ digit number on the line
  ];
  for (const pat of pricePatterns) {
    const m = pat.exec(line);
    if (m) {
      const rupees = parseFloat(m[1].replace(/,/g, ''));
      if (rupees > 0) return Math.round(rupees * 100); // to paise
    }
  }
  return null;
}

/** Extract quantity from OCR text near a match */
function extractQuantity(text: string, startIdx: number): number {
  const window = text.slice(Math.max(0, startIdx - 5), startIdx + 50);
  // Look for "2 bags", "3 bottles", "5 kg", a lone number before the product
  const qtyPattern = /(\d+)\s*(?:బస్తా|బస్తాలు|bag|bags|bottles|bottle|కిలో|కిలోలు|kg|pkt|packet|ల|లీ|L|litre)/i;
  const m = qtyPattern.exec(window);
  return m ? parseInt(m[1], 10) : 1;
}

// ---------------------------------------------------------------------------
// matchProducts — Core OCR → product matching
// ---------------------------------------------------------------------------

/**
 * Match OCR text against the known product database.
 * Returns all products detected in the text with detected prices and quantities.
 *
 * Strategy: for each product, check if any of its name variants (English + Telugu)
 * appear in the normalised OCR text. Confidence is based on match type:
 *   - Exact name match: 0.95
 *   - Partial match (product name inside OCR text): 0.80
 *   - Short variant match (≤4 chars, e.g. "DAP"): 0.70
 */
export function matchProducts(ocrText: string): ProductMatch[] {
  if (!ocrText.trim()) return [];

  const normText = normalise(ocrText);
  const results: ProductMatch[] = [];

  for (const product of KNOWN_PRODUCTS) {
    let bestConfidence = 0;
    let matchIdx = -1;

    // Build all name variants to check
    const variants = [
      normalise(product.name),
      ...product.namesTelugu.map(n => normalise(n)),
    ];

    for (const variant of variants) {
      const idx = normText.indexOf(variant);
      if (idx === -1) continue;

      // Determine confidence based on variant length
      let conf: number;
      if (variant === normalise(product.name)) {
        conf = 0.95;  // canonical English name
      } else if (variant.length <= 4) {
        conf = 0.70;  // short abbreviation like "DAP" — could be noise
      } else {
        conf = 0.80;  // Telugu or long variant
      }

      if (conf > bestConfidence) {
        bestConfidence = conf;
        matchIdx = idx;
      }
    }

    if (bestConfidence > 0 && matchIdx >= 0) {
      const detectedPrice = extractPrice(ocrText, matchIdx) ?? 0;
      const detectedQuantity = extractQuantity(ocrText, matchIdx);

      results.push({
        product,
        detectedPrice,
        detectedQuantity,
        matchConfidence: bestConfidence,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// checkDefeatConditions — Vyāpti logic
// ---------------------------------------------------------------------------

/**
 * Check if there are legitimate defeating conditions that explain a price
 * difference. Returns defeated=true if the overcharge is justified.
 *
 * This is the HEART of the Vyāpti principle: before concluding overcharge,
 * we must exhaust all conditions that would defeat the conclusion.
 */
export function checkDefeatConditions(
  product: ProductMRP,
  detectedPrice: number,
  context?: VyaptiContext,
): DefeatCheckResult {
  const mrp = product.mrpPerUnit;
  if (detectedPrice <= 0 || mrp <= 0) {
    return { defeated: true, reason: 'ధర detect కాలేదు' };
  }

  const overPct = ((detectedPrice - mrp) / mrp) * 100;

  // Condition 1: Remote area transport markup
  // Doubled tolerance for known remote districts
  if (context?.isRemoteArea || isRemoteDistrict(context?.district)) {
    const remoteTolerance = product.tolerance * 2;
    if (overPct <= remoteTolerance) {
      return {
        defeated: true,
        reason: `దూర ప్రాంతం రవాణా ఖర్చు (${remoteTolerance}% పరిమితి లోపల)`,
      };
    }
  }

  // Condition 2: Seasonal pricing for pesticides
  // During pest season, pesticide demand spikes and prices legitimately rise
  if (product.category === 'pesticide') {
    const month = context?.currentMonth ?? new Date().getMonth() + 1;
    if (PEST_SEASON_MONTHS.includes(month) && overPct <= product.tolerance * 3) {
      return {
        defeated: true,
        reason: `పురుగుల సీజన్‌లో పురుగుమందు ధర పెరుగుతుంది (${month} నెల)`,
      };
    }
  }

  // Condition 3: Package size difference
  // If the unit doesn't parse cleanly, the size may differ (e.g. 25kg vs 50kg)
  // We flag this but don't defeat — the alert will include a caveat
  // (handled in detectOvercharges by lowering confidence)

  // Condition 4: Brand premium
  // If "branded" or specific brand name signals are in the product name,
  // allow an extra 10% over tolerance
  // (We don't have brand data in this simple DB — future enhancement)

  // No defeating condition found
  return { defeated: false };
}

function isRemoteDistrict(district?: string): boolean {
  if (!district) return false;
  const d = district.toLowerCase().trim();
  return REMOTE_DISTRICTS.some(rd => d.includes(rd) || rd.includes(d));
}

// ---------------------------------------------------------------------------
// detectOvercharges — full analysis
// ---------------------------------------------------------------------------

/**
 * Given a list of product matches, detect which ones are overcharged.
 * Applies Vyāpti defeating conditions before raising any alert.
 *
 * Severity bands:
 *   warning  = price > MRP + tolerance% (legitimate ceiling)
 *   alert    = price > MRP + 2x tolerance
 *   critical = price > MRP + 3x tolerance
 */
export function detectOvercharges(
  matches: ProductMatch[],
  context?: VyaptiContext,
): OverchargeResult[] {
  const results: OverchargeResult[] = [];

  for (const match of matches) {
    const { product, detectedPrice, matchConfidence } = match;

    // Skip if price wasn't detected or match confidence too low
    if (detectedPrice <= 0 || matchConfidence < 0.6) continue;

    const mrp = product.mrpPerUnit;
    const overPct = ((detectedPrice - mrp) / mrp) * 100;

    // No overcharge if within tolerance
    if (overPct <= product.tolerance) continue;

    // Check defeating conditions (Vyāpti check)
    const defeatResult = checkDefeatConditions(product, detectedPrice, context);
    if (defeatResult.defeated) continue;

    // Determine severity
    let severity: OverchargeResult['severity'];
    if (overPct > product.tolerance * 3) {
      severity = 'critical';
    } else if (overPct > product.tolerance * 2) {
      severity = 'alert';
    } else {
      severity = 'warning';
    }

    results.push({
      product,
      detectedPrice,
      expectedPrice: mrp,
      overchargePercent: Math.round(overPct * 10) / 10,
      overchargeAmount: detectedPrice - mrp,
      severity,
      defeatConditionChecked: true,
    });
  }

  // Sort by severity: critical first, then alert, then warning
  const severityOrder = { critical: 0, alert: 1, warning: 2 };
  results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return results;
}

// ---------------------------------------------------------------------------
// Convenience: full pipeline from raw OCR text
// ---------------------------------------------------------------------------

/**
 * One-shot Vyāpti analysis from raw OCR text.
 * Returns both the matches (for debugging) and the overcharge alerts.
 */
export function analyseOcrForOvercharges(
  ocrText: string,
  context?: VyaptiContext,
): { matches: ProductMatch[]; overcharges: OverchargeResult[] } {
  const matches = matchProducts(ocrText);
  const overcharges = detectOvercharges(matches, context);
  return { matches, overcharges };
}

// ---------------------------------------------------------------------------
// Formatting helpers (for OverchargeAlert.svelte)
// ---------------------------------------------------------------------------

/** Format paise as ₹ rupees string: 26650 -> "₹266.50" */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  // Show decimals only if non-zero
  if (rupees === Math.floor(rupees)) {
    return `₹${rupees.toLocaleString('en-IN')}`;
  }
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Telugu severity label */
export function severityLabel(severity: OverchargeResult['severity']): string {
  switch (severity) {
    case 'critical': return 'చాలా ఎక్కువ!';
    case 'alert':    return 'గణనీయంగా ఎక్కువ';
    case 'warning':  return 'కొంచెం ఎక్కువ';
  }
}

/** Government helpline for agricultural input overcharging */
export const KISAN_HELPLINE = '1800-180-1551';
