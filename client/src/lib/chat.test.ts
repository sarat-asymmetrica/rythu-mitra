/**
 * Tests for chat.ts pure functions.
 *
 * Tests: extractActions, stripActionFromContent, relativeTime
 *
 * chat.ts initialises Svelte stores at module load, which call localStorage.
 * We use happy-dom environment so localStorage is available.
 *
 * Svelte stores, fetch, and SSE streaming are NOT tested here — those
 * require a full integration environment.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from 'vitest';
import { extractActions, stripActionFromContent, relativeTime } from './chat';
import { detectRecordIntent } from './intent';

// ---------------------------------------------------------------------------
// extractActions
// ---------------------------------------------------------------------------

describe('extractActions', () => {
  it('extracts action from JSON on its own line at end of response', () => {
    const content = 'బాగుంది!\n{"action":"record_money","amount_paise":100000}';
    const actions = extractActions(content);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('record_money');
    expect(actions[0].amount_paise).toBe(100000);
  });

  it('returns last JSON block when multiple appear in content', () => {
    // Pattern 1 matches the LAST JSON at end of string on its own line
    const content = 'some text\n{"action":"first","amount_paise":100}\nmore text\n{"action":"second","amount_paise":200}';
    const actions = extractActions(content);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('second');
  });

  it('extracts action from fenced JSON block (```json{...}```)', () => {
    // Only fenced — no \n before { so pattern 1 won't match
    // allJsonPattern (pattern 2) also matches — it fires first on simple objects
    const content = '₹1,000 కూలి.\n```json\n{"action":"record_money","amount_paise":100000}\n```';
    const actions = extractActions(content);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('record_money');
  });

  it('returns empty array when no action present', () => {
    const content = 'హాలో! ఎలా ఉన్నారు?';
    const actions = extractActions(content);
    expect(actions).toHaveLength(0);
  });

  it('returns empty array for invalid JSON', () => {
    const content = 'text\n{invalid json here}';
    const actions = extractActions(content);
    expect(actions).toHaveLength(0);
  });

  it('extracts action with all standard fields populated', () => {
    const content = '₹800 కూలి ఖర్చు నమోదు చేయమంటారా? 🧑‍🌾\n{"action":"record_money","amount_paise":80000,"kind":"LaborPayment","is_income":false,"description":"కూలి","party":"","season":"rabi_2026"}';
    const actions = extractActions(content);
    expect(actions).toHaveLength(1);
    const a = actions[0];
    expect(a.action).toBe('record_money');
    expect(a.amount_paise).toBe(80000);
    expect(a.kind).toBe('LaborPayment');
    expect(a.is_income).toBe(false);
    expect(a.description).toBe('కూలి');
    expect(a.party).toBe('');
    expect(a.season).toBe('rabi_2026');
  });

  it('extracts web_search action', () => {
    const content = 'గూగుల్‌లో చెక్ చేస్తాను...\n{"action":"web_search","query":"whitefly treatment groundnut"}';
    const actions = extractActions(content);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('web_search');
  });

  it('handles JSON with spaces around colon after action key', () => {
    const content = 'text\n{"action" : "record_money","amount_paise":50000}';
    const actions = extractActions(content);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('record_money');
  });

  it('returns empty array when JSON has no action field', () => {
    const content = 'some text\n{"amount_paise":100000,"kind":"labor"}';
    const actions = extractActions(content);
    expect(actions).toHaveLength(0);
  });

  it('extracts crop event action', () => {
    const content = '💧 నీటిపారుదల నమోదు చేస్తాను.\n{"action":"record_crop","kind":"Irrigated","crop":"వేరుశెనగ","description":"బోర్ నీళ్ళు పెట్టాను"}';
    const actions = extractActions(content);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('record_crop');
  });
});

// ---------------------------------------------------------------------------
// stripActionFromContent
// ---------------------------------------------------------------------------

describe('stripActionFromContent', () => {
  it('strips end-of-line JSON and keeps Telugu text', () => {
    const content = '₹1,000 కూలి ఖర్చు నమోదు చేయమంటారా? 🧑‍🌾\n{"action":"record_money","amount_paise":100000}';
    const result = stripActionFromContent(content);
    expect(result).toBe('₹1,000 కూలి ఖర్చు నమోదు చేయమంటారా? 🧑‍🌾');
    expect(result).not.toContain('"action"');
  });

  it('strips fenced JSON block', () => {
    const content = '₹800 యూరియా ఎరువులు. సరేనా?\n```json\n{"action":"record_money","amount_paise":80000}\n```';
    const result = stripActionFromContent(content);
    expect(result).not.toContain('```');
    expect(result).not.toContain('"action"');
    expect(result).toContain('₹800 యూరియా ఎరువులు');
  });

  it('strips inline JSON action block', () => {
    const content = 'నమోదు చేస్తాను {"action":"record_money","amount_paise":50000} ధన్యవాదాలు';
    const result = stripActionFromContent(content);
    expect(result).not.toContain('"action"');
    // Telugu text around it should be preserved (possibly trimmed)
    expect(result.length).toBeGreaterThan(0);
  });

  it('preserves emojis and markdown in remaining text', () => {
    const content = '🎉 ₹12,000 వేరుశెనగ అమ్మకం! **బాగుంది!** నమోదు చేయనా?\n{"action":"record_money","amount_paise":1200000}';
    const result = stripActionFromContent(content);
    expect(result).toContain('🎉');
    expect(result).toContain('**బాగుంది!**');
    expect(result).not.toContain('"action"');
  });

  it('returns trimmed result (no leading/trailing whitespace)', () => {
    const content = '  ₹500 నమోదు.\n{"action":"record_money","amount_paise":50000}  ';
    const result = stripActionFromContent(content);
    expect(result).toBe(result.trim());
  });

  it('returns unchanged text when no action block present', () => {
    const content = 'మీ బ్యాలెన్స్ ₹8,500 ఉంది.';
    const result = stripActionFromContent(content);
    expect(result).toBe('మీ బ్యాలెన్స్ ₹8,500 ఉంది.');
  });

  it('returns empty string (or trimmed empty) when content is only a JSON block', () => {
    const content = '\n{"action":"record_money","amount_paise":100000}';
    const result = stripActionFromContent(content);
    expect(result.trim()).toBe('');
  });
});

// ---------------------------------------------------------------------------
// relativeTime
// ---------------------------------------------------------------------------

describe('relativeTime', () => {
  it('returns "ఇప్పుడే" for timestamps less than 1 minute ago', () => {
    const now = Date.now();
    expect(relativeTime(now)).toBe('ఇప్పుడే');
    expect(relativeTime(now - 30_000)).toBe('ఇప్పుడే'); // 30 seconds ago
    expect(relativeTime(now - 59_000)).toBe('ఇప్పుడే'); // 59 seconds ago
  });

  it('returns "N ని. క్రితం" for timestamps 1-59 minutes ago', () => {
    const fiveMinAgo = Date.now() - 5 * 60_000;
    expect(relativeTime(fiveMinAgo)).toBe('5 ని. క్రితం');

    const thirtyMinAgo = Date.now() - 30 * 60_000;
    expect(relativeTime(thirtyMinAgo)).toBe('30 ని. క్రితం');

    const fiftyNineMinAgo = Date.now() - 59 * 60_000;
    expect(relativeTime(fiftyNineMinAgo)).toBe('59 ని. క్రితం');
  });

  it('returns "N గం. క్రితం" for timestamps 1-23 hours ago', () => {
    const twoHrsAgo = Date.now() - 2 * 60 * 60_000;
    expect(relativeTime(twoHrsAgo)).toBe('2 గం. క్రితం');

    const twelveHrsAgo = Date.now() - 12 * 60 * 60_000;
    expect(relativeTime(twelveHrsAgo)).toBe('12 గం. క్రితం');
  });

  it('returns "నిన్న" for timestamps exactly 1 day ago (24-47 hours)', () => {
    const oneDayAgo = Date.now() - 25 * 60 * 60_000; // 25 hours ago -> days=1
    expect(relativeTime(oneDayAgo)).toBe('నిన్న');
  });

  it('returns "N రోజుల క్రితం" for timestamps 2-6 days ago', () => {
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60_000;
    expect(relativeTime(threeDaysAgo)).toBe('3 రోజుల క్రితం');

    const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60_000;
    expect(relativeTime(sixDaysAgo)).toBe('6 రోజుల క్రితం');
  });

  it('returns formatted date string for timestamps 7+ days ago', () => {
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60_000;
    const result = relativeTime(tenDaysAgo);
    // Should be a formatted date like "Mar 7" or similar (te-IN locale short format)
    expect(result).not.toBe('ఇప్పుడే');
    expect(result).not.toMatch(/ని\. క్రితం/);
    expect(result).not.toMatch(/గం\. క్రితం/);
    expect(result).not.toBe('నిన్న');
    expect(result).not.toMatch(/రోజుల క్రితం/);
    // Should be a non-empty string (locale date)
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// detectRecordIntent — intent detection with negative pattern guards
// ---------------------------------------------------------------------------

describe('detectRecordIntent', () => {
  // Positive cases — should return a ParsedExpense
  it('"కూలి 1000" -> record intent (labor expense)', () => {
    const result = detectRecordIntent('కూలి 1000');
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('labor');
    expect(result?.amount_paise).toBe(100000);
  });

  it('"DAP 800 కొన్నా" -> record intent (short form, no question mark)', () => {
    const result = detectRecordIntent('DAP 800 కొన్నా');
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('fertilizer');
  });

  it('"కూలి 1000 ఇచ్చానా?" -> record intent (rhetorical question)', () => {
    const result = detectRecordIntent('కూలి 1000 ఇచ్చానా?');
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('labor');
    expect(result?.amount_paise).toBe(100000);
  });

  it('"విత్తనాలు 1500 కొన్నానా?" -> record intent (rhetorical confirmation)', () => {
    const result = detectRecordIntent('విత్తనాలు 1500 కొన్నానా?');
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('seeds');
  });

  it('"మండీలో 12000 అమ్మాను" -> record intent (crop sale)', () => {
    const result = detectRecordIntent('మండీలో 12000 అమ్మాను');
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('crop_sale');
    expect(result?.is_income).toBe(true);
  });

  it('"రిపేర్ 600" -> record intent (repair expense)', () => {
    const result = detectRecordIntent('రిపేర్ 600');
    expect(result).not.toBeNull();
    expect(result?.is_income).toBe(false);
  });

  it('"భరోసా 2000 వచ్చింది" -> record intent (govt subsidy income)', () => {
    const result = detectRecordIntent('భరోసా 2000 వచ్చింది');
    expect(result).not.toBeNull();
    expect(result?.is_income).toBe(true);
  });

  // Negative cases — should return null (not record intents)
  it('"ధర ఎంత?" -> NOT a record intent (price query)', () => {
    expect(detectRecordIntent('ధర ఎంత?')).toBeNull();
  });

  it('"balance ఎంత?" -> NOT a record intent (balance query)', () => {
    expect(detectRecordIntent('balance ఎంత?')).toBeNull();
  });

  it('"బ్యాలెన్స్ ఎంత?" -> NOT a record intent', () => {
    expect(detectRecordIntent('బ్యాలెన్స్ ఎంత?')).toBeNull();
  });

  it('"గత నెల ఎంత ఖర్చు అయింది?" -> NOT a record intent (historical query)', () => {
    expect(detectRecordIntent('గత నెల ఎంత ఖర్చు అయింది?')).toBeNull();
  });

  it('"హాలో" -> NOT a record intent (greeting)', () => {
    expect(detectRecordIntent('హాలో')).toBeNull();
  });

  it('"నమస్తే" -> NOT a record intent (greeting)', () => {
    expect(detectRecordIntent('నమస్తే')).toBeNull();
  });

  it('"రేటు ఎంత?" -> NOT a record intent (rate query)', () => {
    expect(detectRecordIntent('రేటు ఎంత?')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Think tag stripping — tested via extractActions behavior
// (stripThinkTags is not exported, but we can verify chat pipeline handles it)
// ---------------------------------------------------------------------------

describe('extractActions — think tag content does not interfere', () => {
  it('extracts action from content that had think tags stripped', () => {
    // Simulate post-think-strip content (think tags already removed by the time
    // extractActions is called in the actual pipeline)
    const cleanedContent = '₹1,000 కూలి ఖర్చు.\n{"action":"record_money","amount_paise":100000,"kind":"LaborPayment","is_income":false}';
    const actions = extractActions(cleanedContent);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('record_money');
  });

  it('handles response with no think tags normally', () => {
    const content = 'నేరుగా సమాధానం.\n{"action":"web_search","query":"pest control"}';
    const actions = extractActions(content);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('web_search');
    expect(actions[0].query).toBe('pest control');
  });
});
