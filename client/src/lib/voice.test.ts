/**
 * Tests for voice.ts — Telugu expense parsing pure functions.
 *
 * Covers: parseTeluguAmount, parseTeluguExpense, generateIdempotencyKey,
 *         expanded CATEGORY_KEYWORDS, new fraction/half amounts, new categories.
 * Browser APIs (MediaRecorder, FileReader) are NOT tested here — those
 * require a real browser environment and are excluded from unit tests.
 */

import { describe, it, expect } from 'vitest';
import { parseTeluguAmount, parseTeluguExpense, generateIdempotencyKey } from './voice';

// ---------------------------------------------------------------------------
// parseTeluguAmount
// ---------------------------------------------------------------------------

describe('parseTeluguAmount', () => {
  // Arabic numeral patterns
  it('parses rupee symbol: "₹800" -> 800', () => {
    expect(parseTeluguAmount('₹800')).toBe(800);
  });

  it('parses rupee symbol with comma: "₹1,200" -> 1200', () => {
    expect(parseTeluguAmount('₹1,200')).toBe(1200);
  });

  it('parses Telugu rupees suffix: "400 రూపాయలు" -> 400', () => {
    expect(parseTeluguAmount('400 రూపాయలు')).toBe(400);
  });

  it('parses standalone number: "1000" -> 1000', () => {
    expect(parseTeluguAmount('1000')).toBe(1000);
  });

  // Telugu word numbers
  it('parses "నాలుగు వందలు" (four hundred) -> 400', () => {
    expect(parseTeluguAmount('నాలుగు వందలు')).toBe(400);
  });

  it('parses "ఐదు వేలు" (five thousand) -> 5000', () => {
    expect(parseTeluguAmount('ఐదు వేలు')).toBe(5000);
  });

  it('parses "రెండు వేల ఐదు వందలు" (two thousand five hundred) -> 2500', () => {
    expect(parseTeluguAmount('రెండు వేల ఐదు వందలు')).toBe(2500);
  });

  it('parses single digit word "పది" (ten) -> 10', () => {
    expect(parseTeluguAmount('పది')).toBe(10);
  });

  it('returns 0 for text with no number: "హాలో" -> 0', () => {
    expect(parseTeluguAmount('హాలో')).toBe(0);
  });

  it('parses "ఒక వంద" (one hundred) -> 100', () => {
    expect(parseTeluguAmount('ఒక వంద')).toBe(100);
  });

  // Additional edge cases
  it('parses number embedded in Telugu text: "కూలి 1500 రూపాయలు"', () => {
    expect(parseTeluguAmount('కూలి 1500 రూపాయలు')).toBe(1500);
  });

  it('parses "మూడు వందలు" (three hundred) -> 300', () => {
    expect(parseTeluguAmount('మూడు వందలు')).toBe(300);
  });

  // Fraction / half amounts
  it('parses "ఒకటిన్నర వేలు" (one-and-a-half thousand) -> 1500', () => {
    expect(parseTeluguAmount('ఒకటిన్నర వేలు')).toBe(1500);
  });

  it('parses "రెండున్నర వేలు" (two-and-a-half thousand) -> 2500', () => {
    expect(parseTeluguAmount('రెండున్నర వేలు')).toBe(2500);
  });

  it('parses "అర వంద" (half a hundred) -> 50', () => {
    expect(parseTeluguAmount('అర వంద')).toBe(50);
  });

  it('parses "డజను" (dozen) -> 12', () => {
    expect(parseTeluguAmount('డజను')).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// parseTeluguExpense
// ---------------------------------------------------------------------------

describe('parseTeluguExpense', () => {
  it('"కూలి 1000" -> labor expense, 100000 paise, is_income=false, confidence>=0.5', () => {
    const result = parseTeluguExpense('కూలి 1000');
    expect(result.kind).toBe('labor');
    expect(result.amount_paise).toBe(100000);
    expect(result.is_income).toBe(false);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('"విత్తనాలు 1500 కొన్నాను" -> seeds expense, 150000 paise', () => {
    const result = parseTeluguExpense('విత్తనాలు 1500 కొన్నాను');
    expect(result.kind).toBe('seeds');
    expect(result.amount_paise).toBe(150000);
    expect(result.is_income).toBe(false);
  });

  it('"వేరుశెనగ అమ్మకం 12000" -> crop_sale income (using "అమ్మకం" keyword)', () => {
    // "అమ్మకం" is a keyword for crop_sale. "అమ్మాను" is NOT in CATEGORY_KEYWORDS.
    const result = parseTeluguExpense('వేరుశెనగ అమ్మకం 12000');
    expect(result.amount_paise).toBe(1200000);
    expect(result.is_income).toBe(true);
    expect(result.kind).toBe('crop_sale');
  });

  it('"వేరుశెనగ 12000 కి అమ్మాను" -> crop_sale income', () => {
    // "అమ్మాను" (past tense "I sold") is in CATEGORY_KEYWORDS
    const result = parseTeluguExpense('వేరుశెనగ 12000 కి అమ్మాను');
    expect(result.amount_paise).toBe(1200000);
    expect(result.kind).toBe('crop_sale');
    expect(result.is_income).toBe(true);
  });

  it('"PM-KISAN 2000" -> govt_subsidy income', () => {
    const result = parseTeluguExpense('PM-KISAN 2000');
    expect(result.kind).toBe('govt_subsidy');
    expect(result.is_income).toBe(true);
    expect(result.amount_paise).toBe(200000);
  });

  it('"యూరియా 800" -> fertilizer (mapped from ఎరువులు category)', () => {
    const result = parseTeluguExpense('యూరియా 800');
    expect(result.kind).toBe('fertilizer');
    expect(result.amount_paise).toBe(80000);
    expect(result.is_income).toBe(false);
  });

  it('"రెండు కూలీలకు నాలుగు వందలు" -> per-person multiplication: 2×400=800', () => {
    const result = parseTeluguExpense('రెండు కూలీలకు నాలుగు వందలు');
    expect(result.kind).toBe('labor');
    expect(result.amount_paise).toBe(80000);  // 800 * 100
    expect(result.is_income).toBe(false);
  });

  it('"బోరు నీళ్ళు 300" -> irrigation expense', () => {
    const result = parseTeluguExpense('బోరు నీళ్ళు 300');
    expect(result.kind).toBe('irrigation');
    expect(result.amount_paise).toBe(30000);
    expect(result.is_income).toBe(false);
  });

  it('"హాలో" -> 0 paise, low confidence', () => {
    const result = parseTeluguExpense('హాలో');
    expect(result.amount_paise).toBe(0);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('returns original text in .text field', () => {
    const input = 'కూలి 500';
    const result = parseTeluguExpense(input);
    expect(result.text).toBe(input);
  });

  it('confidence is capped at 1.0', () => {
    const result = parseTeluguExpense('కూలి 1000 రూపాయలు పని');
    expect(result.confidence).toBeLessThanOrEqual(1.0);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('amount_paise is rupees * 100', () => {
    const result = parseTeluguExpense('₹450 కూలి');
    expect(result.amount_paise).toBe(45000);
  });

  it('unknown category text defaults to kind="other"', () => {
    const result = parseTeluguExpense('xyz 500');
    expect(result.kind).toBe('other');
    expect(result.is_income).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // New expanded keywords — Labor variants
  // ---------------------------------------------------------------------------
  it('"పనివాళ్ళు 500" -> labor expense', () => {
    const result = parseTeluguExpense('పనివాళ్ళు 500');
    expect(result.kind).toBe('labor');
    expect(result.amount_paise).toBe(50000);
    expect(result.is_income).toBe(false);
  });

  it('"మనుషులకు 800 ఇచ్చాను" -> labor expense', () => {
    const result = parseTeluguExpense('మనుషులకు 800 ఇచ్చాను');
    expect(result.kind).toBe('labor');
    expect(result.amount_paise).toBe(80000);
  });

  it('"దినసరి 350" -> labor expense (daily wage)', () => {
    const result = parseTeluguExpense('దినసరి 350');
    expect(result.kind).toBe('labor');
    expect(result.is_income).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // New expanded keywords — Seeds variants
  // ---------------------------------------------------------------------------
  it('"బీజాలు 1200 కొన్నాను" -> seeds expense', () => {
    const result = parseTeluguExpense('బీజాలు 1200 కొన్నాను');
    expect(result.kind).toBe('seeds');
    expect(result.amount_paise).toBe(120000);
  });

  it('"నారు 400" -> seeds expense', () => {
    const result = parseTeluguExpense('నారు 400');
    expect(result.kind).toBe('seeds');
    expect(result.is_income).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // New expanded keywords — Fertilizer/Pesticide variants
  // ---------------------------------------------------------------------------
  it('"MOP 600 కొన్నా" -> fertilizer expense', () => {
    const result = parseTeluguExpense('MOP 600 కొన్నా');
    expect(result.kind).toBe('fertilizer');
    expect(result.amount_paise).toBe(60000);
  });

  it('"NPK రెండు బస్తాలు 1200" -> fertilizer expense', () => {
    const result = parseTeluguExpense('NPK రెండు బస్తాలు 1200');
    expect(result.kind).toBe('fertilizer');
    expect(result.amount_paise).toBe(120000);
  });

  it('"స్ప్రే 250 పెట్టాను" -> fertilizer/medicine expense', () => {
    const result = parseTeluguExpense('స్ప్రే 250 పెట్టాను');
    expect(result.kind).toBe('fertilizer');
    expect(result.is_income).toBe(false);
  });

  it('"పిచికారీ మందు 450" -> fertilizer/medicine expense', () => {
    const result = parseTeluguExpense('పిచికారీ మందు 450');
    expect(result.kind).toBe('fertilizer');
  });

  // ---------------------------------------------------------------------------
  // New expanded keywords — Irrigation variants
  // ---------------------------------------------------------------------------
  it('"మోటార్ డీజిల్ 500" -> irrigation expense', () => {
    const result = parseTeluguExpense('మోటార్ డీజిల్ 500');
    expect(result.kind).toBe('irrigation');
    expect(result.amount_paise).toBe(50000);
  });

  it('"పంపు 300" -> irrigation expense', () => {
    const result = parseTeluguExpense('పంపు 300');
    expect(result.kind).toBe('irrigation');
    expect(result.is_income).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // New expanded keywords — Crop sale variants
  // ---------------------------------------------------------------------------
  it('"మండీలో 8000 అమ్మాను" -> crop_sale income', () => {
    const result = parseTeluguExpense('మండీలో 8000 అమ్మాను');
    expect(result.kind).toBe('crop_sale');
    expect(result.is_income).toBe(true);
    expect(result.amount_paise).toBe(800000);
  });

  it('"క్వింటాలు 2800 రేటు" -> crop_sale income (quintal keyword)', () => {
    const result = parseTeluguExpense('క్వింటాలు 2800 రేటు');
    expect(result.kind).toBe('crop_sale');
    expect(result.is_income).toBe(true);
  });

  it('"విక్రయం 15000" -> crop_sale income (formal sale word)', () => {
    const result = parseTeluguExpense('విక్రయం 15000');
    expect(result.kind).toBe('crop_sale');
    expect(result.is_income).toBe(true);
    expect(result.amount_paise).toBe(1500000);
  });

  // ---------------------------------------------------------------------------
  // New expanded keywords — Transport variants
  // ---------------------------------------------------------------------------
  it('"లారీ ఖర్చు 1500" -> transport expense', () => {
    const result = parseTeluguExpense('లారీ ఖర్చు 1500');
    expect(result.kind).toBe('transport');
    expect(result.amount_paise).toBe(150000);
  });

  it('"ట్రాక్టర్ 800" -> transport expense', () => {
    const result = parseTeluguExpense('ట్రాక్టర్ 800');
    expect(result.kind).toBe('transport');
    expect(result.is_income).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // New expanded keywords — Government/Subsidy variants
  // ---------------------------------------------------------------------------
  it('"భరోసా 2000 వచ్చింది" -> govt_subsidy income (Rythu Bharosa scheme)', () => {
    const result = parseTeluguExpense('భరోసా 2000 వచ్చింది');
    expect(result.kind).toBe('govt_subsidy');
    expect(result.is_income).toBe(true);
    expect(result.amount_paise).toBe(200000);
  });

  it('"బీమా 500 జమ అయింది" -> govt_subsidy income (crop insurance)', () => {
    const result = parseTeluguExpense('బీమా 500 జమ అయింది');
    expect(result.kind).toBe('govt_subsidy');
    expect(result.is_income).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // New category — Repair/Maintenance
  // ---------------------------------------------------------------------------
  it('"రిపేర్ 600" -> other/repair expense', () => {
    const result = parseTeluguExpense('రిపేర్ 600');
    expect(result.kind).toBe('other');
    expect(result.kindLabel).toBe('మరమ్మత్తు');
    expect(result.is_income).toBe(false);
    expect(result.amount_paise).toBe(60000);
  });

  it('"ట్రాక్టర్ సర్వీస్ 1200" -> repair/maintenance expense', () => {
    const result = parseTeluguExpense('ట్రాక్టర్ సర్వీస్ 1200');
    // ట్రాక్టర్ maps to transport; సర్వీస్ to repair — first match wins
    // Either is acceptable, but amount must be correct
    expect(result.amount_paise).toBe(120000);
    expect(result.is_income).toBe(false);
  });

  it('"మరమ్మత్తు 800" -> repair expense with correct kindLabel', () => {
    const result = parseTeluguExpense('మరమ్మత్తు 800');
    expect(result.kind).toBe('other');
    expect(result.kindLabel).toBe('మరమ్మత్తు');
    expect(result.amount_paise).toBe(80000);
  });

  // ---------------------------------------------------------------------------
  // Fraction amount inside expense
  // ---------------------------------------------------------------------------
  it('"కూలి ఒకటిన్నర వేలు" -> labor, 1500 rupees', () => {
    const result = parseTeluguExpense('కూలి ఒకటిన్నర వేలు');
    expect(result.kind).toBe('labor');
    expect(result.amount_paise).toBe(150000);
  });
});

// ---------------------------------------------------------------------------
// generateIdempotencyKey
// ---------------------------------------------------------------------------

describe('generateIdempotencyKey', () => {
  it('returns a string starting with "rm_"', () => {
    const key = generateIdempotencyKey('farmer_1', 100000, '2026-03-17');
    expect(key).toMatch(/^rm_/);
  });

  it('returns a non-empty string', () => {
    const key = generateIdempotencyKey('farmer_1', 100000, '2026-03-17');
    expect(key.length).toBeGreaterThan(3);
  });

  it('two calls return different keys (non-deterministic due to Date.now + Math.random)', () => {
    const k1 = generateIdempotencyKey('farmer_1', 100000, '2026-03-17');
    const k2 = generateIdempotencyKey('farmer_1', 100000, '2026-03-17');
    // Keys are different because they embed Date.now() and Math.random()
    // There is a *theoretical* chance of collision but practically never
    expect(k1).not.toBe(k2);
  });

  it('contains a timestamp component (base-36 encoded) after second underscore', () => {
    const key = generateIdempotencyKey('farmer_1', 100000, '2026-03-17');
    // Format: rm_{hash36}_{timestamp36}
    const parts = key.split('_');
    expect(parts.length).toBeGreaterThanOrEqual(3);
    // Last part should be a valid base-36 string
    const lastPart = parts[parts.length - 1];
    expect(lastPart).toMatch(/^[0-9a-z]+$/);
  });

  it('works with different inputs', () => {
    const k1 = generateIdempotencyKey('farmer_abc', 50000, '2026-01-01');
    const k2 = generateIdempotencyKey('farmer_xyz', 200000, '2026-12-31');
    expect(typeof k1).toBe('string');
    expect(typeof k2).toBe('string');
    expect(k1).toMatch(/^rm_/);
    expect(k2).toMatch(/^rm_/);
  });
});
