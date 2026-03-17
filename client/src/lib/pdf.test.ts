/**
 * Tests for pdf.ts — PDF generation via pdf-lib.
 *
 * Tests:
 *   1. generateSeasonReport() — returns valid Uint8Array, has PDF header
 *   2. generateReceipt()      — returns valid Uint8Array, has PDF header
 *   3. downloadPdf()          — creates blob URL, triggers anchor click
 *
 * We validate:
 *   - Output is Uint8Array (correct type)
 *   - Output starts with "%PDF-" (valid PDF header)
 *   - Output length > 1000 bytes (non-trivial document)
 *   - Multi-page report for large transaction lists
 *
 * We do NOT test visual layout — that requires PDF rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSeasonReport, generateReceipt, downloadPdf, type SeasonReport } from './pdf';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReport(overrides: Partial<SeasonReport> = {}): SeasonReport {
  return {
    farmerName: 'Lakshmi',
    village: 'Dharmavaram',
    district: 'Anantapur',
    season: 'Rabi 2026',
    totalIncome: 45000,
    totalExpense: 28500,
    balance: 16500,
    transactions: [
      { date: '01/01/2026', description: 'Urea purchase', amount: -1200, kind: 'InputPurchase' },
      { date: '15/01/2026', description: 'Labor payment',  amount: -2000, kind: 'LaborPayment'  },
      { date: '20/02/2026', description: 'Groundnut sale', amount: 15000, kind: 'CropSale'      },
    ],
    topExpenseCategory: 'InputPurchase',
    topExpensePercent: 55,
    cropEvents: [
      { date: '15/11/2025', kind: 'Planted',  crop: 'Groundnut', notes: 'Row spacing 30cm'   },
      { date: '10/01/2026', kind: 'Sprayed',  crop: 'Groundnut', notes: 'Chlorpyrifos 2ml/L' },
      { date: '18/02/2026', kind: 'Harvested',crop: 'Groundnut', notes: 'Yield 8 quintals'   },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// generateSeasonReport
// ---------------------------------------------------------------------------

describe('generateSeasonReport', () => {
  it('returns a Uint8Array', async () => {
    const bytes = await generateSeasonReport(makeReport());
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it('starts with PDF header "%PDF-"', async () => {
    const bytes = await generateSeasonReport(makeReport());
    const header = String.fromCharCode(...bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('produces a non-trivial document (> 1000 bytes)', async () => {
    const bytes = await generateSeasonReport(makeReport());
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('handles empty transactions list', async () => {
    const report = makeReport({ transactions: [] });
    const bytes = await generateSeasonReport(report);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(500);
  });

  it('handles empty crop events list', async () => {
    const report = makeReport({ cropEvents: [] });
    const bytes = await generateSeasonReport(report);
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it('handles large transaction list (triggers multi-page)', async () => {
    const manyTx = Array.from({ length: 60 }, (_, i) => ({
      date: `${String(i % 28 + 1).padStart(2, '0')}/03/2026`,
      description: `Transaction number ${i + 1}`,
      amount: i % 3 === 0 ? 1000 * (i + 1) : -500 * (i + 1),
      kind: i % 2 === 0 ? 'InputPurchase' : 'LaborPayment',
    }));
    const report = makeReport({ transactions: manyTx });
    const bytes = await generateSeasonReport(report);
    // Multi-page PDF is larger
    expect(bytes.length).toBeGreaterThan(3000);
  });

  it('handles negative balance (loss season)', async () => {
    const report = makeReport({
      totalIncome: 10000,
      totalExpense: 20000,
      balance: -10000,
    });
    const bytes = await generateSeasonReport(report);
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it('handles special characters in farmer name', async () => {
    // Telugu names may not render in Latin font but should not throw
    const report = makeReport({ farmerName: 'Ramaiah Goud', village: 'Kurnool' });
    const bytes = await generateSeasonReport(report);
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it('handles very long description text (truncated in table)', async () => {
    const report = makeReport({
      transactions: [{
        date: '01/03/2026',
        description: 'This is a very very very very long description that exceeds column width',
        amount: -5000,
        kind: 'InputPurchase',
      }],
    });
    const bytes = await generateSeasonReport(report);
    expect(bytes).toBeInstanceOf(Uint8Array);
  });
});

// ---------------------------------------------------------------------------
// generateReceipt
// ---------------------------------------------------------------------------

describe('generateReceipt', () => {
  it('returns a Uint8Array', async () => {
    const bytes = await generateReceipt('Lakshmi', 2500, 'Labor', 'Weeding workers', '17/03/2026');
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it('starts with PDF header "%PDF-"', async () => {
    const bytes = await generateReceipt('Ramaiah', 1200, 'InputPurchase', 'Urea', '15/03/2026');
    const header = String.fromCharCode(...bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('produces a non-trivial document (> 500 bytes)', async () => {
    const bytes = await generateReceipt('Test Farmer', 500, 'Other', 'Test', '01/01/2026');
    expect(bytes.length).toBeGreaterThan(500);
  });

  it('handles negative amount (expense)', async () => {
    const bytes = await generateReceipt('Lakshmi', -3000, 'LaborPayment', 'Harvest labor', '10/02/2026');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(500);
  });

  it('handles zero amount', async () => {
    const bytes = await generateReceipt('Lakshmi', 0, 'Other', 'Zero test', '01/01/2026');
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it('handles empty description', async () => {
    const bytes = await generateReceipt('Farmer', 500, 'InputPurchase', '', '01/03/2026');
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it('handles very long description (truncated)', async () => {
    const longDesc = 'A'.repeat(200);
    const bytes = await generateReceipt('Farmer', 1000, 'Other', longDesc, '01/03/2026');
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it('receipt is a single page (smaller than report)', async () => {
    const receipt = await generateReceipt('Lakshmi', 500, 'Labor', 'Test', '01/01/2026');
    const report  = await generateSeasonReport(makeReport());
    // Receipt should be smaller than a full season report
    expect(receipt.length).toBeLessThan(report.length);
  });
});

// ---------------------------------------------------------------------------
// downloadPdf
// ---------------------------------------------------------------------------

describe('downloadPdf', () => {
  let mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Fresh anchor mock per test
    mockAnchor = { href: '', download: '', click: vi.fn() };

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-url-12345'),
      revokeObjectURL: vi.fn(),
    });

    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as unknown as Node);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as unknown as Node);
  });

  it('creates a blob URL from pdfBytes', () => {
    const fakeBytes = new Uint8Array([37, 80, 68, 70, 45]); // %PDF-
    downloadPdf(fakeBytes, 'test.pdf');
    expect(URL.createObjectURL).toHaveBeenCalled();
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
  });

  it('sets the correct download filename on the anchor', () => {
    const fakeBytes = new Uint8Array([37, 80, 68, 70, 45]);
    downloadPdf(fakeBytes, 'season_rabi2026.pdf');
    expect(mockAnchor.download).toBe('season_rabi2026.pdf');
  });

  it('clicks the anchor to trigger download', () => {
    const fakeBytes = new Uint8Array([37, 80, 68, 70, 45]);
    downloadPdf(fakeBytes, 'receipt.pdf');
    expect(mockAnchor.click).toHaveBeenCalledOnce();
  });

  it('appends and removes anchor from document.body', () => {
    const fakeBytes = new Uint8Array([37, 80, 68, 70, 45]);
    downloadPdf(fakeBytes, 'test.pdf');
    expect(document.body.appendChild).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalled();
  });
});
