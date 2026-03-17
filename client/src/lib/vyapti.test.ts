/**
 * Vyāpti (వ్యాప్తి) Engine — Unit Tests
 *
 * 10 tests covering:
 *   1.  matchProducts — Telugu OCR text for Urea
 *   2.  matchProducts — English DAP with quantity
 *   3.  matchProducts — unknown product returns empty
 *   4.  detectOvercharges — Urea overcharged triggers alert
 *   5.  detectOvercharges — Urea within 5% tolerance → no alert
 *   6.  detectOvercharges — severity levels: warning / alert / critical
 *   7.  checkDefeatConditions — remote district doubles tolerance
 *   8.  checkDefeatConditions — seasonal pesticide pricing defeated
 *   9.  matchProducts — Telugu keyword "వేప నూనె" matches Neem Oil
 *   10. detectOvercharges — multiple products, only 1 overcharged
 */

import { describe, it, expect } from 'vitest';
import {
  matchProducts,
  detectOvercharges,
  checkDefeatConditions,
  analyseOcrForOvercharges,
  formatPaise,
  KNOWN_PRODUCTS,
  type VyaptiContext,
} from './vyapti';

// ---------------------------------------------------------------------------
// Helper: find the Urea product entry for reference values
// ---------------------------------------------------------------------------
const UREA = KNOWN_PRODUCTS.find(p => p.name === 'Urea')!;
const DAP   = KNOWN_PRODUCTS.find(p => p.name === 'DAP')!;
const NEEM  = KNOWN_PRODUCTS.find(p => p.name === 'Neem Oil')!;
const IMIDA = KNOWN_PRODUCTS.find(p => p.name === 'Imidacloprid')!;

// ---------------------------------------------------------------------------
// Test 1: matchProducts — Telugu OCR for Urea
// ---------------------------------------------------------------------------
describe('matchProducts', () => {
  it('T1: matches Telugu "యూరియా" with price', () => {
    const ocr = 'యూరియా 45kg బస్తా ₹350';
    const matches = matchProducts(ocr);

    expect(matches.length).toBeGreaterThanOrEqual(1);

    const ureaMatch = matches.find(m => m.product.name === 'Urea');
    expect(ureaMatch).toBeDefined();
    expect(ureaMatch!.detectedPrice).toBe(35000);  // ₹350 = 35000 paise
    expect(ureaMatch!.matchConfidence).toBeGreaterThanOrEqual(0.7);
  });

  // -------------------------------------------------------------------------
  // Test 2: matchProducts — English DAP with quantity
  // -------------------------------------------------------------------------
  it('T2: matches "DAP 2 బస్తాలు 2800" and detects price', () => {
    const ocr = 'DAP 2 బస్తాలు 2800';
    const matches = matchProducts(ocr);

    const dapMatch = matches.find(m => m.product.name === 'DAP');
    expect(dapMatch).toBeDefined();
    // ₹2800 for 2 bags → detected as total bill price
    expect(dapMatch!.detectedPrice).toBe(280000);  // 2800 paise * 100
    expect(dapMatch!.detectedQuantity).toBe(2);
    expect(dapMatch!.matchConfidence).toBeGreaterThanOrEqual(0.6);
  });

  // -------------------------------------------------------------------------
  // Test 3: matchProducts — unknown product → empty
  // -------------------------------------------------------------------------
  it('T3: returns empty array for unknown product', () => {
    const ocr = 'Paracetamol 500mg tablet 20 Rs 45';
    const matches = matchProducts(ocr);

    // No agricultural product should match
    expect(matches.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Test 9: Telugu keyword "వేప నూనె" matches Neem Oil
  // -------------------------------------------------------------------------
  it('T9: Telugu "వేప నూనె" matches Neem Oil', () => {
    const ocr = 'వేప నూనె 1 లీటర్ ₹420';
    const matches = matchProducts(ocr);

    const neemMatch = matches.find(m => m.product.name === 'Neem Oil');
    expect(neemMatch).toBeDefined();
    expect(neemMatch!.matchConfidence).toBeGreaterThanOrEqual(0.7);
    expect(neemMatch!.detectedPrice).toBe(42000);  // ₹420
  });
});

// ---------------------------------------------------------------------------
// detectOvercharges tests
// ---------------------------------------------------------------------------
describe('detectOvercharges', () => {
  // -------------------------------------------------------------------------
  // Test 4: Urea at ₹350 vs MRP ₹266.50 → alert raised
  // -------------------------------------------------------------------------
  it('T4: Urea at ₹350 triggers overcharge (MRP is ₹266.50)', () => {
    const matches = [{
      product: UREA,
      detectedPrice: 35000,  // ₹350 in paise
      detectedQuantity: 1,
      matchConfidence: 0.95,
    }];

    const alerts = detectOvercharges(matches);
    expect(alerts.length).toBe(1);

    const alert = alerts[0];
    expect(alert.product.name).toBe('Urea');
    expect(alert.detectedPrice).toBe(35000);
    expect(alert.expectedPrice).toBe(26650);  // MRP ₹266.50
    // Overcharge % = (350 - 266.50) / 266.50 * 100 ≈ 31.3%
    expect(alert.overchargePercent).toBeGreaterThan(30);
    expect(alert.overchargeAmount).toBe(35000 - 26650);  // 8350 paise = ₹83.50
    expect(alert.defeatConditionChecked).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test 5: Urea at ₹275 (within 5% of ₹266.50) → no alert
  // -------------------------------------------------------------------------
  it('T5: Urea at ₹275 (within 5% tolerance) → no alert', () => {
    const matches = [{
      product: UREA,
      detectedPrice: 27500,  // ₹275 in paise
      detectedQuantity: 1,
      matchConfidence: 0.95,
    }];

    // ₹275 is 3.2% above MRP ₹266.50 — within the 5% tolerance
    const alerts = detectOvercharges(matches);
    expect(alerts.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Test 6: severity levels — warning / alert / critical
  // -------------------------------------------------------------------------
  it('T6: severity levels are correct', () => {
    // DAP MRP: ₹1,350 (135000 paise), tolerance 5%
    // warning  = > 5% above MRP  = > ₹1,417.50
    // alert    = > 10% above MRP = > ₹1,485
    // critical = > 15% above MRP = > ₹1,552.50

    function makeMatch(pricePaise: number) {
      return [{
        product: DAP,
        detectedPrice: pricePaise,
        detectedQuantity: 1,
        matchConfidence: 0.9,
      }];
    }

    // 6% above MRP → warning
    const warningPrice = Math.round(DAP.mrpPerUnit * 1.06);
    const warningAlerts = detectOvercharges(makeMatch(warningPrice));
    expect(warningAlerts.length).toBe(1);
    expect(warningAlerts[0].severity).toBe('warning');

    // 12% above MRP → alert
    const alertPrice = Math.round(DAP.mrpPerUnit * 1.12);
    const alertAlerts = detectOvercharges(makeMatch(alertPrice));
    expect(alertAlerts.length).toBe(1);
    expect(alertAlerts[0].severity).toBe('alert');

    // 20% above MRP → critical
    const criticalPrice = Math.round(DAP.mrpPerUnit * 1.20);
    const critAlerts = detectOvercharges(makeMatch(criticalPrice));
    expect(critAlerts.length).toBe(1);
    expect(critAlerts[0].severity).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// checkDefeatConditions tests
// ---------------------------------------------------------------------------
describe('checkDefeatConditions', () => {
  // -------------------------------------------------------------------------
  // Test 7: Remote district doubles tolerance for fertilisers
  // -------------------------------------------------------------------------
  it('T7: remote district doubles tolerance → overcharge defeated', () => {
    // Urea MRP ₹266.50, tolerance 5% → normal limit = ₹279.83
    // Remote district: 2x tolerance = 10% → limit = ₹293.15
    // Price ₹290 (8.8% above MRP) should be defeated for remote district
    const remoteCtx: VyaptiContext = { district: 'Parvathipuram Manyam', isRemoteArea: true };
    const price290 = 29000; // ₹290 = 8.8% above MRP ₹266.50
    const result = checkDefeatConditions(UREA, price290, remoteCtx);
    expect(result.defeated).toBe(true);
    expect(result.reason).toContain('రవాణా');
  });

  // -------------------------------------------------------------------------
  // Test 8: Seasonal pesticide pricing → defeated
  // -------------------------------------------------------------------------
  it('T8: pesticide in pest season (August) → defeated within 3x tolerance', () => {
    // Neem Oil MRP ₹350, tolerance 15% → normal limit = ₹402.50
    // Pest season 3x tolerance = 45% → limit = ₹507.50
    // Price ₹440 (25.7% above MRP) should be defeated during pest season
    const augustCtx: VyaptiContext = { currentMonth: 8 }; // August = peak kharif pest season
    const price440 = 44000; // ₹440
    const result = checkDefeatConditions(NEEM, price440, augustCtx);
    expect(result.defeated).toBe(true);
    expect(result.reason).toContain('సీజన్');
  });

  it('T8b: same price in off-season (February) → NOT defeated', () => {
    const febCtx: VyaptiContext = { currentMonth: 2 }; // February = off-season
    const price440 = 44000;
    const result = checkDefeatConditions(NEEM, price440, febCtx);
    // 25.7% above MRP, but tolerance is only 15%, and not pest season
    // Should NOT be defeated
    expect(result.defeated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 10: Multiple products on one bill, only 1 overcharged
// ---------------------------------------------------------------------------
describe('analyseOcrForOvercharges', () => {
  it('T10: bill with 3 items, only 1 overcharged', () => {
    // SSP at MRP (₹350 for 50kg) — within tolerance
    // DAP at MRP (₹1,350) — exactly at MRP
    // Urea at ₹350 (₹83.50 above MRP ₹266.50) — overcharged!
    const ocrText = [
      'SSP 50kg బస్తా ₹350',
      'DAP 50kg బస్తా ₹1350',
      'యూరియా 45kg బస్తా ₹350',
    ].join('\n');

    const { matches, overcharges } = analyseOcrForOvercharges(ocrText);

    // Should detect all three products
    expect(matches.length).toBeGreaterThanOrEqual(3);

    // Only Urea should trigger overcharge
    expect(overcharges.length).toBe(1);
    expect(overcharges[0].product.name).toBe('Urea');
    expect(overcharges[0].overchargeAmount).toBe(35000 - 26650);
  });
});

// ---------------------------------------------------------------------------
// Utility tests
// ---------------------------------------------------------------------------
describe('formatPaise', () => {
  it('formats whole rupee amounts without decimals', () => {
    expect(formatPaise(135000)).toBe('₹1,350');
    expect(formatPaise(26600)).toBe('₹266');
  });

  it('formats rupees with paise (decimal amounts)', () => {
    expect(formatPaise(26650)).toBe('₹266.50');
    expect(formatPaise(35075)).toBe('₹350.75');
  });
});
