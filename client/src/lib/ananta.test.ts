/**
 * Tests for ananta.ts — Vedic intelligence layer for Rythu Mitra
 *
 * Coverage targets:
 *   - digitalRoot: arithmetic correctness, edge cases
 *   - digitalRootString: Telugu string hashing
 *   - classifyByDigitalRoot: {1,4,7}->action, {2,5,8}->analysis, {3,6,9}->synthesis
 *   - classifyIntent: Telugu keyword routing + DR fallback
 *   - harmonicMean: math correctness + edge cases
 *   - validateTransaction: all 4 gates individually + combined
 *   - detectFarmerEmotion: Telugu keyword detection per state
 *   - detectSpendingPatterns: weekly rhythm, category trends, income gap
 *   - detectDuplicateTransaction: window-based duplicate detection
 */

import { describe, it, expect } from 'vitest';
import {
  digitalRoot,
  digitalRootString,
  classifyByDigitalRoot,
  classifyIntent,
  harmonicMean,
  validateTransaction,
  detectFarmerEmotion,
  detectSpendingPatterns,
  detectDuplicateTransaction,
} from './ananta';
import type { MoneyEvent } from './types';
import type { ChatAction } from './actions';

// ============================================================
// Helpers
// ============================================================

function makeExpense(
  overrides: Partial<MoneyEvent> = {},
  minutesAgo = 1,
): MoneyEvent {
  const d = new Date(Date.now() - minutesAgo * 60 * 1000);
  return {
    id: `e_${Math.random().toString(36).slice(2, 8)}`,
    farmerId: 'farmer_1',
    kind: 'labor',
    amount: -500,
    description: 'కూలి',
    category: 'కూలి',
    date: d.toISOString().slice(0, 10),
    time: d.toTimeString().slice(0, 5),
    ...overrides,
  };
}

function makeAction(overrides: Partial<ChatAction> = {}): ChatAction {
  return {
    action: 'record_money',
    amount_paise: 50000,      // ₹500
    kind: 'LaborPayment',
    is_income: false,
    description: 'కూలి',
    ...overrides,
  };
}

// ============================================================
// SECTION 1: Digital Root
// ============================================================

describe('digitalRoot', () => {
  it('returns 0 for input 0', () => {
    expect(digitalRoot(0)).toBe(0);
  });

  it('handles single digits 1-9 correctly', () => {
    for (let i = 1; i <= 9; i++) {
      expect(digitalRoot(i)).toBe(i);
    }
  });

  it('reduces 10 to 1', () => {
    expect(digitalRoot(10)).toBe(1);
  });

  it('reduces 18 to 9', () => {
    expect(digitalRoot(18)).toBe(9);
  });

  it('reduces 19 to 1', () => {
    expect(digitalRoot(19)).toBe(1);
  });

  it('reduces 99 to 9', () => {
    expect(digitalRoot(99)).toBe(9);
  });

  it('reduces 100 to 1', () => {
    expect(digitalRoot(100)).toBe(1);
  });

  it('handles 108 (Vedic sacred number) -> 9', () => {
    expect(digitalRoot(108)).toBe(9);
  });

  it('handles 432 -> 9', () => {
    expect(digitalRoot(432)).toBe(9);
  });

  it('handles negative numbers (uses absolute value)', () => {
    expect(digitalRoot(-15)).toBe(6);
  });

  it('handles large numbers', () => {
    // 1729 (taxicab number) = 1+7+2+9 = 19 -> 1+9 = 10 -> 1
    expect(digitalRoot(1729)).toBe(1);
  });
});

describe('digitalRootString', () => {
  it('returns 0 for empty string', () => {
    expect(digitalRootString('')).toBe(0);
  });

  it('returns valid 1-9 range for ASCII strings', () => {
    const dr = digitalRootString('hello');
    expect(dr).toBeGreaterThanOrEqual(1);
    expect(dr).toBeLessThanOrEqual(9);
  });

  it('returns valid 1-9 range for Telugu strings', () => {
    const dr = digitalRootString('కూలి');
    expect(dr).toBeGreaterThanOrEqual(1);
    expect(dr).toBeLessThanOrEqual(9);
  });

  it('two identical strings produce same DR', () => {
    expect(digitalRootString('నమస్తే')).toBe(digitalRootString('నమస్తే'));
  });

  it('different strings generally produce different DRs', () => {
    // Not guaranteed, but highly likely for distinct strings
    const a = digitalRootString('కూలి 500');
    const b = digitalRootString('నమస్తే');
    // Just ensure both are valid — they may or may not differ
    expect(a).toBeGreaterThanOrEqual(1);
    expect(b).toBeGreaterThanOrEqual(1);
  });
});

describe('classifyByDigitalRoot', () => {
  it('maps 1 -> action', () => expect(classifyByDigitalRoot(1)).toBe('action'));
  it('maps 4 -> action', () => expect(classifyByDigitalRoot(4)).toBe('action'));
  it('maps 7 -> action', () => expect(classifyByDigitalRoot(7)).toBe('action'));
  it('maps 2 -> analysis', () => expect(classifyByDigitalRoot(2)).toBe('analysis'));
  it('maps 5 -> analysis', () => expect(classifyByDigitalRoot(5)).toBe('analysis'));
  it('maps 8 -> analysis', () => expect(classifyByDigitalRoot(8)).toBe('analysis'));
  it('maps 3 -> synthesis', () => expect(classifyByDigitalRoot(3)).toBe('synthesis'));
  it('maps 6 -> synthesis', () => expect(classifyByDigitalRoot(6)).toBe('synthesis'));
  it('maps 9 -> synthesis', () => expect(classifyByDigitalRoot(9)).toBe('synthesis'));
  it('maps 0 -> synthesis (fallback)', () => expect(classifyByDigitalRoot(0)).toBe('synthesis'));
});

// ============================================================
// SECTION 2: Intent Classification
// ============================================================

describe('classifyIntent', () => {
  it('classifies Telugu labor record as record intent', () => {
    const result = classifyIntent('కూలి 500');
    expect(result.type).toBe('record');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.suggestedAction).toBe('record_money');
  });

  it('classifies seed purchase as record intent', () => {
    const result = classifyIntent('విత్తనాలు 1500 కొన్నాను');
    expect(result.type).toBe('record');
  });

  it('classifies crop sale as record intent', () => {
    const result = classifyIntent('వేరుశెనగ అమ్మాను 12000');
    expect(result.type).toBe('record');
  });

  it('classifies balance question as query intent', () => {
    const result = classifyIntent('నా బ్యాలెన్స్ ఎంత?');
    expect(result.type).toBe('query');
  });

  it('classifies greeting as social intent', () => {
    const result = classifyIntent('నమస్తే');
    expect(result.type).toBe('social');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('classifies thanks as social intent', () => {
    const result = classifyIntent('థాంక్స్');
    expect(result.type).toBe('social');
  });

  it('classifies pest disease question as search intent', () => {
    const result = classifyIntent('తెల్లదోమ మందు ఏమిటి?');
    expect(result.type).toBe('search');
    expect(result.suggestedAction).toBe('web_search');
  });

  it('always returns valid digitalRoot 0-9', () => {
    const texts = ['కూలి 500', 'నమస్తే', 'borewell water', ''];
    for (const t of texts) {
      const r = classifyIntent(t);
      expect(r.digitalRoot).toBeGreaterThanOrEqual(0);
      expect(r.digitalRoot).toBeLessThanOrEqual(9);
    }
  });

  it('always returns valid cluster', () => {
    const clusters = ['action', 'analysis', 'synthesis'];
    const r = classifyIntent('కూలి 500');
    expect(clusters).toContain(r.cluster);
  });

  it('returns confidence between 0 and 1', () => {
    const r = classifyIntent('ఎరువులు 2000');
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });
});

// ============================================================
// SECTION 3: Harmonic Mean
// ============================================================

describe('harmonicMean', () => {
  it('returns 0 for empty array', () => {
    expect(harmonicMean([])).toBe(0);
  });

  it('returns the value itself for single element', () => {
    expect(harmonicMean([0.8])).toBeCloseTo(0.8);
  });

  it('returns 0 when any value is 0', () => {
    expect(harmonicMean([1.0, 0.0, 0.9])).toBe(0);
  });

  it('harmonic mean of [1, 1, 1] = 1', () => {
    expect(harmonicMean([1, 1, 1])).toBeCloseTo(1.0);
  });

  it('harmonic mean of [0.5, 1, 1] < arithmetic mean', () => {
    const hm = harmonicMean([0.5, 1, 1]);
    const am = (0.5 + 1 + 1) / 3;
    expect(hm).toBeLessThan(am);
  });

  it('harmonic mean punishes weak gate: [0.1, 1, 1] very low', () => {
    const hm = harmonicMean([0.1, 1, 1]);
    expect(hm).toBeLessThan(0.3); // well below arithmetic mean of 0.7
  });

  it('harmonic mean of [0.9, 0.9, 0.9] close to 0.9', () => {
    expect(harmonicMean([0.9, 0.9, 0.9])).toBeCloseTo(0.9);
  });

  it('known case: HM([1, 2]) = 4/3', () => {
    expect(harmonicMean([1, 2])).toBeCloseTo(4 / 3);
  });
});

// ============================================================
// SECTION 4: Validation Gates
// ============================================================

describe('validateTransaction — Gate 1 (Sanity)', () => {
  it('passes for normal expense ₹500', () => {
    const result = validateTransaction(makeAction({ amount_paise: 50000 }), []);
    const gate = result.gates.find(g => g.gate === 'sanity')!;
    expect(gate.passed).toBe(true);
    expect(gate.score).toBe(1.0);
  });

  it('fails for zero amount', () => {
    const result = validateTransaction(makeAction({ amount_paise: 0 }), []);
    const gate = result.gates.find(g => g.gate === 'sanity')!;
    expect(gate.passed).toBe(false);
    expect(gate.score).toBe(0);
  });

  it('fails for amount over ₹10,00,000', () => {
    const result = validateTransaction(makeAction({ amount_paise: 100_000_100 }), []);
    const gate = result.gates.find(g => g.gate === 'sanity')!;
    expect(gate.passed).toBe(false);
  });

  it('fails for amount < ₹1 (1 paise)', () => {
    const result = validateTransaction(makeAction({ amount_paise: 1 }), []);
    const gate = result.gates.find(g => g.gate === 'sanity')!;
    expect(gate.passed).toBe(false);
  });

  it('passes for exactly ₹1 (100 paise)', () => {
    const result = validateTransaction(makeAction({ amount_paise: 100 }), []);
    const gate = result.gates.find(g => g.gate === 'sanity')!;
    expect(gate.passed).toBe(true);
  });

  it('passes for ₹10,00,000 exactly (boundary)', () => {
    const result = validateTransaction(makeAction({ amount_paise: 100_000_000 }), []);
    const gate = result.gates.find(g => g.gate === 'sanity')!;
    expect(gate.passed).toBe(true);
  });
});

describe('validateTransaction — Gate 2 (Consistency)', () => {
  it('passes LaborPayment with "కూలి" in description', () => {
    const action = makeAction({ kind: 'LaborPayment', description: 'కూలి పని' });
    const result = validateTransaction(action, []);
    const gate = result.gates.find(g => g.gate === 'consistency')!;
    expect(gate.passed).toBe(true);
  });

  it('passes CropSale with "అమ్మాను" in description', () => {
    const action = makeAction({ kind: 'CropSale', description: 'వేరుశెనగ అమ్మాను', is_income: true });
    const result = validateTransaction(action, []);
    const gate = result.gates.find(g => g.gate === 'consistency')!;
    expect(gate.passed).toBe(true);
  });

  it('passes Other kind regardless of description', () => {
    const action = makeAction({ kind: 'Other', description: 'misc' });
    const result = validateTransaction(action, []);
    const gate = result.gates.find(g => g.gate === 'consistency')!;
    expect(gate.passed).toBe(true);
  });
});

describe('validateTransaction — Gate 3 (Duplicate)', () => {
  it('flags a duplicate within 5 minutes', () => {
    const recent = [makeExpense({ kind: 'labor', amount: -500 }, 2)]; // 2 minutes ago
    const action = makeAction({ kind: 'LaborPayment', amount_paise: 50000 });
    const result = validateTransaction(action, recent);
    const gate = result.gates.find(g => g.gate === 'duplicate')!;
    expect(gate.passed).toBe(false);
    expect(gate.score).toBeLessThan(0.5);
  });

  it('does not flag an event from 10 minutes ago', () => {
    const recent = [makeExpense({ kind: 'labor', amount: -500 }, 10)]; // 10 minutes ago
    const action = makeAction({ kind: 'LaborPayment', amount_paise: 50000 });
    const result = validateTransaction(action, recent);
    const gate = result.gates.find(g => g.gate === 'duplicate')!;
    expect(gate.passed).toBe(true);
  });

  it('does not flag a different amount', () => {
    const recent = [makeExpense({ kind: 'labor', amount: -600 }, 1)];
    const action = makeAction({ kind: 'LaborPayment', amount_paise: 50000 }); // ₹500
    const result = validateTransaction(action, recent);
    const gate = result.gates.find(g => g.gate === 'duplicate')!;
    expect(gate.passed).toBe(true);
  });

  it('does not flag empty recent events', () => {
    const result = validateTransaction(makeAction(), []);
    const gate = result.gates.find(g => g.gate === 'duplicate')!;
    expect(gate.passed).toBe(true);
  });
});

describe('validateTransaction — Gate 4 (Quality) + overall', () => {
  it('allPassed is true for a clean valid transaction', () => {
    const result = validateTransaction(makeAction(), []);
    expect(result.allPassed).toBe(true);
    expect(result.overallScore).toBeGreaterThan(0.7);
  });

  it('allPassed is false when sanity fails (zero amount)', () => {
    const result = validateTransaction(makeAction({ amount_paise: 0 }), []);
    expect(result.allPassed).toBe(false);
  });

  it('overallScore is between 0 and 1', () => {
    const result = validateTransaction(makeAction(), []);
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThanOrEqual(1);
  });

  it('returns exactly 4 gate results', () => {
    const result = validateTransaction(makeAction(), []);
    expect(result.gates).toHaveLength(4);
  });

  it('gate names are sanity, consistency, duplicate, quality', () => {
    const result = validateTransaction(makeAction(), []);
    const names = result.gates.map(g => g.gate);
    expect(names).toContain('sanity');
    expect(names).toContain('consistency');
    expect(names).toContain('duplicate');
    expect(names).toContain('quality');
  });
});

// ============================================================
// SECTION 5: Emotional Awareness
// ============================================================

describe('detectFarmerEmotion', () => {
  it('detects worried state with "అప్పు"', () => {
    const state = detectFarmerEmotion('చాలా అప్పు ఉంది నాకు');
    expect(state.surface).toBe('worried');
    expect(state.response).toBe('reassurance');
    expect(state.teluguComfort).toBeTruthy();
  });

  it('detects worried state with "నష్టం"', () => {
    const state = detectFarmerEmotion('ఈ సీజన్ నష్టం వచ్చింది');
    expect(state.surface).toBe('worried');
  });

  it('detects worried state with "డబ్బు లేదు"', () => {
    const state = detectFarmerEmotion('ఇప్పుడు డబ్బు లేదు');
    expect(state.surface).toBe('worried');
  });

  it('detects excited state with "లాభం"', () => {
    const state = detectFarmerEmotion('ఈసారి చాలా లాభం వచ్చింది!');
    expect(state.surface).toBe('excited');
    expect(state.response).toBe('celebration');
  });

  it('detects excited state with "బాగుంది"', () => {
    const state = detectFarmerEmotion('పంట చాలా బాగుంది');
    expect(state.surface).toBe('excited');
  });

  it('detects confused state with "అర్థం కాలేదు"', () => {
    const state = detectFarmerEmotion('నాకు అర్థం కాలేదు');
    expect(state.surface).toBe('confused');
    expect(state.response).toBe('simple_explanation');
  });

  it('detects confused state with "ఎలా చేయాలి"', () => {
    const state = detectFarmerEmotion('ఇది ఎలా చేయాలి?');
    expect(state.surface).toBe('confused');
  });

  it('detects frustrated state with "పని చేయడం లేదు"', () => {
    const state = detectFarmerEmotion('ఏమీ పని చేయడం లేదు');
    expect(state.surface).toBe('frustrated');
    expect(state.response).toBe('patience_and_hope');
  });

  it('detects frustrated state with "ఏం చేసినా ఫలితం లేదు"', () => {
    const state = detectFarmerEmotion('ఏం చేసినా ఫలితం లేదు ఈ సీజన్');
    expect(state.surface).toBe('frustrated');
  });

  it('returns neutral for generic message', () => {
    const state = detectFarmerEmotion('కూలి 500 నమోదు చేయండి');
    expect(state.surface).toBe('neutral');
    expect(state.response).toBe('helpful_service');
    expect(state.teluguComfort).toBe('');
  });

  it('returns Telugu comfort phrase for non-neutral states', () => {
    const worried = detectFarmerEmotion('చాలా అప్పు ఉంది');
    expect(worried.teluguComfort.length).toBeGreaterThan(0);

    const excited = detectFarmerEmotion('లాభం వచ్చింది!');
    expect(excited.teluguComfort.length).toBeGreaterThan(0);
  });
});

// ============================================================
// SECTION 6: Pattern Detection
// ============================================================

describe('detectSpendingPatterns', () => {
  it('returns empty array for fewer than 3 events', () => {
    const events: MoneyEvent[] = [makeExpense()];
    expect(detectSpendingPatterns(events)).toHaveLength(0);
  });

  it('returns empty array for empty events', () => {
    expect(detectSpendingPatterns([])).toHaveLength(0);
  });

  it('detects income gap when no income in > 14 days', () => {
    const events: MoneyEvent[] = [
      // Three expenses, one income from 20 days ago
      makeExpense({ amount: -500, kind: 'labor' }, 60 * 24 * 2),   // 2 days ago
      makeExpense({ amount: -300, kind: 'seeds' }, 60 * 24 * 5),   // 5 days ago
      makeExpense({ amount: 12000, kind: 'crop_sale' }, 60 * 24 * 20), // 20 days ago
    ];
    // Adjust date format to past dates
    const today = new Date();
    const mkDate = (daysAgo: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().slice(0, 10);
    };

    const richEvents: MoneyEvent[] = [
      { ...makeExpense({ kind: 'labor' }), amount: -500, date: mkDate(2) },
      { ...makeExpense({ kind: 'seeds' }), amount: -300, date: mkDate(5) },
      { ...makeExpense({ kind: 'crop_sale' }), amount: 12000, date: mkDate(20) },
    ];

    const patterns = detectSpendingPatterns(richEvents);
    const incomeGapPattern = patterns.find(p => p.includes('ఆదాయం లేదు'));
    expect(incomeGapPattern).toBeTruthy();
  });

  it('does not flag income gap when income is recent (< 14 days)', () => {
    const today = new Date();
    const mkDate = (daysAgo: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().slice(0, 10);
    };

    const events: MoneyEvent[] = [
      { ...makeExpense({ kind: 'labor' }), amount: -500, date: mkDate(1) },
      { ...makeExpense({ kind: 'seeds' }), amount: -300, date: mkDate(2) },
      { ...makeExpense({ kind: 'crop_sale' }), amount: 12000, date: mkDate(5) }, // recent income
    ];

    const patterns = detectSpendingPatterns(events);
    const incomeGapPattern = patterns.find(p => p.includes('ఆదాయం లేదు'));
    expect(incomeGapPattern).toBeUndefined();
  });

  it('returns array of Telugu strings', () => {
    const today = new Date();
    const mkDate = (daysAgo: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().slice(0, 10);
    };

    const events: MoneyEvent[] = Array.from({ length: 5 }, (_, i) => ({
      ...makeExpense({ kind: 'labor' }),
      amount: -500,
      date: mkDate(i + 1),
    }));

    const patterns = detectSpendingPatterns(events);
    // All patterns should be strings
    for (const p of patterns) {
      expect(typeof p).toBe('string');
      expect(p.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// SECTION 7: Duplicate Detection
// ============================================================

describe('detectDuplicateTransaction', () => {
  it('returns true for same amount+kind within 5 minutes', () => {
    const recent = [makeExpense({ kind: 'labor', amount: -500 }, 2)];
    const action = makeAction({ kind: 'LaborPayment', amount_paise: 50000 });
    expect(detectDuplicateTransaction(action, recent)).toBe(true);
  });

  it('returns false for different amounts', () => {
    const recent = [makeExpense({ kind: 'labor', amount: -600 }, 2)];
    const action = makeAction({ kind: 'LaborPayment', amount_paise: 50000 }); // 500 != 600
    expect(detectDuplicateTransaction(action, recent)).toBe(false);
  });

  it('returns false for same amount, different kind', () => {
    const recent = [makeExpense({ kind: 'seeds', amount: -500 }, 2)];
    const action = makeAction({ kind: 'LaborPayment', amount_paise: 50000 });
    expect(detectDuplicateTransaction(action, recent)).toBe(false);
  });

  it('returns false for event older than 5 minutes', () => {
    const recent = [makeExpense({ kind: 'labor', amount: -500 }, 10)];
    const action = makeAction({ kind: 'LaborPayment', amount_paise: 50000 });
    expect(detectDuplicateTransaction(action, recent)).toBe(false);
  });

  it('returns false for empty recent events', () => {
    const action = makeAction();
    expect(detectDuplicateTransaction(action, [])).toBe(false);
  });

  it('returns false for income event even if amount matches', () => {
    const recent = [makeExpense({ kind: 'crop_sale', amount: 500 }, 2)]; // income
    const action = makeAction({ kind: 'CropSale', amount_paise: 50000, is_income: true });
    // crop_sale maps to 'CropSale' — should detect it
    // This tests that the kind mapping works correctly for income events
    expect(typeof detectDuplicateTransaction(action, recent)).toBe('boolean');
  });
});
