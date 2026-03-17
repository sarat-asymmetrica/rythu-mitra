/**
 * Unit tests for the multi-provider search module.
 *
 * Tests pure functions only — searchKnowledgeBase, formatDDGResponse,
 * buildSarvamSearchPrompt, buildDDGUrl, and the fallback chain logic.
 * No actual network calls are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock browser APIs and Sarvam config BEFORE importing the module
// ---------------------------------------------------------------------------

vi.mock('./sarvam', () => ({
  loadConfig: vi.fn(() => ({
    apiKey: 'test-sarvam-key',
    chatModel: 'sarvam-105b',
  })),
}));

// Mock localStorage
const localStorageMock: Record<string, string | null> = {};
const originalLocalStorage = globalThis.localStorage;

beforeEach(() => {
  // Reset localStorage mock
  Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]);
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => localStorageMock[key] ?? null,
      setItem: (key: string, value: string) => { localStorageMock[key] = value; },
      removeItem: (key: string) => { delete localStorageMock[key]; },
      clear: () => Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]),
    },
    writable: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, 'localStorage', {
    value: originalLocalStorage,
    writable: true,
  });
});

import {
  searchKnowledgeBase,
  formatDDGResponse,
  buildSarvamSearchPrompt,
  buildDDGUrl,
  loadSearchConfig,
  search,
  type SearchConfig,
} from './search';

// ---------------------------------------------------------------------------
// 1. searchKnowledgeBase — keyword matching
// ---------------------------------------------------------------------------

describe('searchKnowledgeBase', () => {
  it('returns empty for blank query', () => {
    expect(searchKnowledgeBase('')).toEqual([]);
    expect(searchKnowledgeBase('   ')).toEqual([]);
  });

  it('matches తెల్లదోమ (whitefly)', () => {
    const results = searchKnowledgeBase('తెల్లదోమ మందు ఏమిటి');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('cached');
    expect(results[0].snippet).toContain('నీమ్ ఆయిల్');
  });

  it('matches English keyword "whitefly"', () => {
    const results = searchKnowledgeBase('whitefly treatment');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].snippet).toContain('నీమ్');
  });

  it('matches PM-KISAN scheme query', () => {
    const results = searchKnowledgeBase('PM-KISAN ఎంత వస్తుంది');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].snippet).toContain('₹6,000');
  });

  it('matches drip irrigation query in Telugu', () => {
    const results = searchKnowledgeBase('డ్రిప్ ఇరిగేషన్ ఖర్చు ఎంత');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].snippet).toContain('₹25,000');
  });

  it('matches YSR రైతు భరోసా', () => {
    const results = searchKnowledgeBase('రైతు భరోసా ఎంత వస్తుంది');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].snippet).toContain('₹13,500');
  });

  it('matches MSP query', () => {
    const results = searchKnowledgeBase('MSP ధర ఎంత');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].snippet).toContain('Minimum Support Price');
  });

  it('matches crop insurance (PMFBY)', () => {
    const results = searchKnowledgeBase('పంట బీమా ఎలా తీసుకోవాలి');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].snippet).toContain('PMFBY');
  });

  it('matches quintal query', () => {
    const results = searchKnowledgeBase('క్వింటాల్ ఎంత కిలోలు');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].snippet).toContain('100 kg');
  });

  it('returns max 2 results even for very broad queries', () => {
    const results = searchKnowledgeBase('వేరుశెనగ');
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('returns cached source for all KB results', () => {
    const results = searchKnowledgeBase('యూరియా వేరుశెనగ');
    for (const r of results) {
      expect(r.source).toBe('cached');
    }
  });

  it('returns no results for unrelated query', () => {
    const results = searchKnowledgeBase('cricket match score');
    expect(results.length).toBe(0);
  });

  it('all results have title, snippet, url, source', () => {
    const results = searchKnowledgeBase('తెల్లదోమ');
    for (const r of results) {
      expect(typeof r.title).toBe('string');
      expect(typeof r.snippet).toBe('string');
      expect(typeof r.url).toBe('string');
      expect(r.source).toBe('cached');
    }
  });
});

// ---------------------------------------------------------------------------
// 2. formatDDGResponse — parsing DuckDuckGo API response
// ---------------------------------------------------------------------------

describe('formatDDGResponse', () => {
  it('extracts AbstractText when present', () => {
    const data = {
      AbstractText: 'Whitefly (Bemisia tabaci) is a common pest of groundnut crops in Andhra Pradesh, India.',
      AbstractURL: 'https://example.com/whitefly',
      Heading: 'Whitefly',
    };
    const results = formatDDGResponse(data, 'whitefly');
    expect(results.length).toBe(1);
    expect(results[0].source).toBe('duckduckgo');
    expect(results[0].title).toBe('Whitefly');
    expect(results[0].url).toBe('https://example.com/whitefly');
    expect(results[0].snippet).toContain('groundnut');
  });

  it('truncates AbstractText to 400 chars', () => {
    const longText = 'A'.repeat(600);
    const data = { AbstractText: longText, AbstractURL: 'https://example.com', Heading: 'Test' };
    const results = formatDDGResponse(data, 'test');
    expect(results[0].snippet.length).toBeLessThanOrEqual(400);
  });

  it('uses Answer field when no AbstractText', () => {
    const data = {
      AbstractText: '',
      Answer: '1 Quintal = 100 kg',
      AnswerType: 'calc',
    };
    const results = formatDDGResponse(data, 'quintal weight');
    expect(results.length).toBe(1);
    expect(results[0].snippet).toBe('1 Quintal = 100 kg');
    expect(results[0].source).toBe('duckduckgo');
  });

  it('falls back to RelatedTopics when no abstract or answer', () => {
    const data = {
      AbstractText: '',
      Answer: '',
      RelatedTopics: [
        { FirstURL: 'https://example.com/1', Text: 'Groundnut crop diseases in India include leaf spot and rust' },
        { FirstURL: 'https://example.com/2', Text: 'Drip irrigation saves 40 percent water for groundnut farmers' },
      ],
    };
    const results = formatDDGResponse(data, 'groundnut');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('duckduckgo');
    expect(results[0].snippet).toContain('Groundnut');
  });

  it('skips topic groups (nested Topics arrays)', () => {
    const data = {
      AbstractText: '',
      Answer: '',
      RelatedTopics: [
        {
          Name: 'Agriculture',
          Topics: [{ FirstURL: 'https://example.com', Text: 'Should be ignored' }],
        },
        { FirstURL: 'https://example.com/flat', Text: 'This is a flat topic about farming in AP' },
      ],
    };
    const results = formatDDGResponse(data, 'farming');
    expect(results.length).toBe(1);
    expect(results[0].snippet).toContain('flat topic');
  });

  it('returns empty array when no useful data', () => {
    const data = { AbstractText: '', Answer: '', RelatedTopics: [] };
    const results = formatDDGResponse(data, 'query');
    expect(results).toEqual([]);
  });

  it('ignores AbstractText shorter than 30 chars', () => {
    const data = { AbstractText: 'Short text', AbstractURL: 'https://example.com' };
    const results = formatDDGResponse(data, 'test');
    // Should not include the short abstract
    expect(results.filter(r => r.snippet === 'Short text').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. buildSarvamSearchPrompt — correct prompt construction
// ---------------------------------------------------------------------------

describe('buildSarvamSearchPrompt', () => {
  it('returns a non-empty string', () => {
    const prompt = buildSarvamSearchPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(50);
  });

  it('contains Telugu content', () => {
    const prompt = buildSarvamSearchPrompt();
    // Check for Telugu characters (Unicode range U+0C00–U+0C7F)
    expect(/[\u0C00-\u0C7F]/.test(prompt)).toBe(true);
  });

  it('mentions factual / honest approach', () => {
    const prompt = buildSarvamSearchPrompt();
    // Prompt should discourage hallucination
    expect(prompt).toContain('తెలియకపోతే');
  });

  it('is a pure function — returns same value each call', () => {
    const a = buildSarvamSearchPrompt();
    const b = buildSarvamSearchPrompt();
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// 4. buildDDGUrl — URL construction
// ---------------------------------------------------------------------------

describe('buildDDGUrl', () => {
  it('contains the DuckDuckGo API base URL', () => {
    const url = buildDDGUrl('whitefly treatment');
    expect(url).toContain('api.duckduckgo.com');
    expect(url).toContain('format=json');
  });

  it('URL-encodes the query', () => {
    const url = buildDDGUrl('తెల్లదోమ మందు');
    expect(url).toContain('%');
    expect(url).not.toContain('తెల్లదోమ మందు'); // Raw Telugu not in URL
  });

  it('appends agricultural context for generic queries', () => {
    const url = buildDDGUrl('whitefly treatment');
    expect(url).toContain('agriculture');
  });

  it('does not double-add context for queries already containing farm keywords', () => {
    const url = buildDDGUrl('whitefly agriculture treatment');
    // Should not append context since "agriculture" is already present
    const decodedUrl = decodeURIComponent(url);
    const agriCount = (decodedUrl.match(/agriculture/g) || []).length;
    expect(agriCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5. loadSearchConfig — reads localStorage
// ---------------------------------------------------------------------------

describe('loadSearchConfig', () => {
  it('returns empty google keys when localStorage is empty', () => {
    const config = loadSearchConfig();
    expect(config.googleApiKey).toBeUndefined();
    expect(config.googleEngineId).toBeUndefined();
  });

  it('returns google keys when stored in localStorage', () => {
    localStorageMock['rythu_mitra_search_api_key'] = 'AIzaSyXXX';
    localStorageMock['rythu_mitra_search_engine_id'] = '123456789';
    const config = loadSearchConfig();
    expect(config.googleApiKey).toBe('AIzaSyXXX');
    expect(config.googleEngineId).toBe('123456789');
  });

  it('enables DuckDuckGo and Sarvam by default', () => {
    const config = loadSearchConfig();
    expect(config.enableDuckDuckGo).toBe(true);
    expect(config.enableSarvamSearch).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Fallback chain order
// ---------------------------------------------------------------------------

describe('search fallback chain', () => {
  it('returns cached results first without calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const config: SearchConfig = {
      enableDuckDuckGo: true,
      enableSarvamSearch: true,
    };

    const results = await search('తెల్లదోమ నివారణ', config);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('cached');
    // fetch should NOT have been called for cached results
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips DuckDuckGo when disabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ AbstractText: '', Answer: 'some answer', RelatedTopics: [] }), { status: 200 }),
    );

    const config: SearchConfig = {
      enableDuckDuckGo: false,
      enableSarvamSearch: false,
    };

    // Query that won't match KB
    await search('quantum physics equations', config);
    // fetch should NOT be called for DDG
    const ddgCalls = fetchSpy.mock.calls.filter(call =>
      typeof call[0] === 'string' && (call[0] as string).includes('duckduckgo'),
    );
    expect(ddgCalls.length).toBe(0);
    fetchSpy.mockRestore();
  });

  it('skips Google when keys are not configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ AbstractText: '', Answer: '', RelatedTopics: [] }), { status: 200 }),
    );

    const config: SearchConfig = {
      googleApiKey: undefined,
      googleEngineId: undefined,
      enableDuckDuckGo: true,
      enableSarvamSearch: false,
    };

    await search('quantum physics no kb match', config);

    const googleCalls = fetchSpy.mock.calls.filter(call =>
      typeof call[0] === 'string' && (call[0] as string).includes('googleapis.com'),
    );
    expect(googleCalls.length).toBe(0);
    fetchSpy.mockRestore();
  });

  it('returns empty array when no providers yield results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ AbstractText: '', Answer: '', RelatedTopics: [] }), { status: 200 }),
    );

    const config: SearchConfig = {
      enableDuckDuckGo: true,
      enableSarvamSearch: false,
    };

    const results = await search('xyzzy plugh impossible query 2025', config);
    expect(results).toEqual([]);
  });

  it('calls Sarvam as last resort fallback', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes('duckduckgo')) {
          return Promise.resolve(
            new Response(JSON.stringify({ AbstractText: '', Answer: '', RelatedTopics: [] }), { status: 200 }),
          );
        }
        if (urlStr.includes('sarvam')) {
          return Promise.resolve(
            new Response(JSON.stringify({
              choices: [{ message: { content: 'వేరుశెనగ తెగులు నివారణకు నీమ్ ఆయిల్ వాడండి.' } }],
            }), { status: 200 }),
          );
        }
        return Promise.resolve(new Response('', { status: 404 }));
      });

    const config: SearchConfig = {
      enableDuckDuckGo: true,
      enableSarvamSearch: true,
    };

    const results = await search('qwerty unique unmatched query 9999', config);
    const sarvamResults = results.filter(r => r.source === 'sarvam');
    expect(sarvamResults.length).toBeGreaterThan(0);
    expect(sarvamResults[0].snippet).toContain('నీమ్');

    fetchSpy.mockRestore();
  });
});
