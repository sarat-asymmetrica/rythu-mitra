/**
 * Tests for ocr.ts — Mistral OCR module (pure functions only).
 *
 * No fetch calls, no browser FileReader, no Sarvam/Mistral APIs.
 * Tests cover:
 *   1. loadOcrConfig / saveOcrConfig / hasOcrKey  — localStorage wrappers
 *   2. imageToBase64                              — FileReader data URL
 *   3. extractBillData                            — bill parsing patterns
 *
 * performOcr() makes real HTTP calls — not unit-tested here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock localStorage before importing the module
// ---------------------------------------------------------------------------

const localStorageStore: Record<string, string> = {};

const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }),
};

vi.stubGlobal('localStorage', mockLocalStorage);

// Mock sarvam.ts so loadConfig() doesn't blow up in Node
vi.mock('./sarvam', () => ({
  loadConfig: vi.fn(() => ({ apiKey: '', chatModel: 'sarvam-105b' })),
}));

import {
  loadOcrConfig,
  saveOcrConfig,
  hasOcrKey,
  imageToBase64,
  extractBillData,
} from './ocr';

// ---------------------------------------------------------------------------
// Reset localStorage state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);
  vi.clearAllMocks();
  mockLocalStorage.getItem.mockImplementation((key: string) => localStorageStore[key] ?? null);
  mockLocalStorage.setItem.mockImplementation((key: string, value: string) => { localStorageStore[key] = value; });
});

// ---------------------------------------------------------------------------
// loadOcrConfig / saveOcrConfig / hasOcrKey
// ---------------------------------------------------------------------------

describe('loadOcrConfig', () => {
  it('returns empty key when nothing in localStorage', () => {
    const cfg = loadOcrConfig();
    expect(cfg.mistralApiKey).toBe('');
  });

  it('returns stored key after saveOcrConfig', () => {
    saveOcrConfig({ mistralApiKey: 'test-key-123' });
    const cfg = loadOcrConfig();
    expect(cfg.mistralApiKey).toBe('test-key-123');
  });

  it('overwrites existing key', () => {
    saveOcrConfig({ mistralApiKey: 'old-key' });
    saveOcrConfig({ mistralApiKey: 'new-key' });
    expect(loadOcrConfig().mistralApiKey).toBe('new-key');
  });
});

describe('saveOcrConfig', () => {
  it('persists key to localStorage with correct storage key', () => {
    saveOcrConfig({ mistralApiKey: 'abc123' });
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'rythu_mitra_mistral_key',
      'abc123',
    );
  });
});

describe('hasOcrKey', () => {
  it('returns false when no key stored', () => {
    expect(hasOcrKey()).toBe(false);
  });

  it('returns true after storing a key', () => {
    saveOcrConfig({ mistralApiKey: 'some-api-key' });
    expect(hasOcrKey()).toBe(true);
  });

  it('returns false for empty string key', () => {
    saveOcrConfig({ mistralApiKey: '' });
    expect(hasOcrKey()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// imageToBase64
// ---------------------------------------------------------------------------

describe('imageToBase64', () => {
  it('converts a Blob to a data URL string', async () => {
    // Mock FileReader using a proper class so `new FileReader()` works
    const fakeDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgAB';
    const originalFileReader = globalThis.FileReader;

    class MockFileReaderSuccess {
      result: string | null = null;
      onload: ((e: Event) => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      readAsDataURL() {
        setTimeout(() => {
          this.result = fakeDataUrl;
          if (this.onload) this.onload(new Event('load'));
        }, 0);
      }
    }
    vi.stubGlobal('FileReader', MockFileReaderSuccess);

    const blob = new Blob(['fake image data'], { type: 'image/jpeg' });
    const result = await imageToBase64(blob);

    expect(result).toBe(fakeDataUrl);
    expect(typeof result).toBe('string');
    expect(result.startsWith('data:')).toBe(true);

    vi.stubGlobal('FileReader', originalFileReader);
  });

  it('rejects when FileReader errors', async () => {
    const originalFileReader = globalThis.FileReader;

    class MockFileReaderError {
      result: string | null = null;
      onload: ((e: Event) => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      readAsDataURL() {
        setTimeout(() => {
          if (this.onerror) this.onerror(new Event('error'));
        }, 0);
      }
    }
    vi.stubGlobal('FileReader', MockFileReaderError);

    const blob = new Blob(['bad data'], { type: 'image/jpeg' });
    await expect(imageToBase64(blob)).rejects.toThrow('FileReader failed to read file');

    vi.stubGlobal('FileReader', originalFileReader);
  });
});

// ---------------------------------------------------------------------------
// extractBillData
// ---------------------------------------------------------------------------

describe('extractBillData', () => {
  it('returns empty object for empty string', () => {
    const result = extractBillData('');
    expect(result).toEqual({});
  });

  it('returns empty object for whitespace-only string', () => {
    const result = extractBillData('   \n\t  ');
    expect(result).toEqual({});
  });

  it('extracts total amount with ₹ symbol', () => {
    const text = 'Sri Rama Fertilizers\nDate: 15/03/2026\nUrea 50kg  ₹900\nDAP 25kg  ₹650\nTotal: ₹1,550';
    const result = extractBillData(text);
    expect(result.totalAmount).toBe(155000); // paise
  });

  it('extracts total from "Total:" label (case insensitive)', () => {
    const text = 'Shop Name\nItem A 200\nItem B 300\nTOTAL: Rs.500';
    const result = extractBillData(text);
    expect(result.totalAmount).toBeDefined();
    expect(result.totalAmount).toBeGreaterThan(0);
  });

  it('extracts total from మొత్తం (Telugu for total)', () => {
    const text = 'రాజు అగ్రి సెంటర్\nయూరియా ₹800\nమొత్తం: ₹800';
    const result = extractBillData(text);
    expect(result.totalAmount).toBe(80000);
  });

  it('extracts the largest amount as total', () => {
    const text = '₹100\n₹250\n₹1200\n₹50';
    const result = extractBillData(text);
    expect(result.totalAmount).toBe(120000); // largest = 1200 rupees
  });

  it('extracts date in DD/MM/YYYY format', () => {
    const text = 'Bill Date: 17/03/2026\nAmount: ₹500';
    const result = extractBillData(text);
    expect(result.date).toBe('17/03/2026');
  });

  it('extracts date in DD-MM-YYYY format', () => {
    const text = 'Date: 15-03-2026\nTotal ₹300';
    const result = extractBillData(text);
    expect(result.date).toBe('15-03-2026');
  });

  it('extracts shop name from first meaningful line', () => {
    const text = 'Krishna Agro Centre\n17/03/2026\nUrea ₹500\nTotal ₹500';
    const result = extractBillData(text);
    expect(result.shopName).toBe('Krishna Agro Centre');
  });

  it('skips pure-number lines when looking for shop name', () => {
    const text = '1234\nAnnapurna Seeds\nItem ₹200\nTotal ₹200';
    const result = extractBillData(text);
    expect(result.shopName).toBe('Annapurna Seeds');
  });

  it('extracts amounts with Indian number formatting (commas)', () => {
    const text = 'Pesticide ₹1,200\nTotal ₹1,200';
    const result = extractBillData(text);
    expect(result.totalAmount).toBe(120000);
  });

  it('handles /- convention (1500/- only)', () => {
    const text = 'Fertilizer Supply\nTotal 1500/-';
    const result = extractBillData(text);
    expect(result.totalAmount).toBeGreaterThan(0);
  });

  it('handles decimal amounts (Rs.850.50)', () => {
    const text = 'Total Rs.850.50';
    const result = extractBillData(text);
    expect(result.totalAmount).toBe(85050); // 850.50 * 100
  });

  it('does not include amounts > 10 million (sanity check)', () => {
    const text = '₹99999999 some garbage\nTotal ₹500';
    const result = extractBillData(text);
    // 99999999 > 10M so it's excluded, total should be 500 rupees
    expect(result.totalAmount).toBe(50000);
  });

  it('returns undefined totalAmount when no amount patterns found', () => {
    const text = 'Hello World\nNo amounts here';
    const result = extractBillData(text);
    expect(result.totalAmount).toBeUndefined();
  });
});
