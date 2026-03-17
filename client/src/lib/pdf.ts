/**
 * Rythu Mitra -- PDF Generation via pdf-lib
 *
 * Two document types:
 *   1. Season Summary Report  — full ledger for a kharif/rabi season
 *   2. Transaction Receipt    — single payment proof
 *
 * Design (Matti earth palette):
 *   - Header bar: Brown #8B4513
 *   - Income amounts: Green #2D6A4F
 *   - Expense amounts: Red #C0392B
 *   - Accent/separator: Gold-brown #C5A059
 *   - Telugu font: Noto Sans Telugu (embedded from /fonts/NotoSansTelugu-Regular.ttf)
 *   - Fallback: Helvetica (pdf-lib built-in, Latin only) when font load fails
 *
 * Font loading strategy:
 *   - Attempt fetch from local /fonts/NotoSansTelugu-Regular.ttf (bundled in public/)
 *   - Cache in module-level variable — only fetched once per app session
 *   - Graceful fallback to Helvetica if font unavailable (offline/error)
 *   - Use Helvetica for amounts (₹ → "Rs." since Helvetica is WinAnsi)
 *   - Use Telugu font for all user-generated Telugu text (names, descriptions, labels)
 *
 * All amounts are in rupees (already converted from paise by callers).
 */

import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Telugu font loader — cached, graceful fallback
// ---------------------------------------------------------------------------

/** Module-level cache: null = not tried, Uint8Array = loaded, false = failed */
let _teluguFontCache: Uint8Array | false | null = null;

/**
 * Load Noto Sans Telugu TTF bytes for PDF embedding.
 *
 * Tries /fonts/NotoSansTelugu-Regular.ttf (served from public/).
 * Returns null on any failure — callers fall back to Helvetica gracefully.
 */
async function loadTeluguFontBytes(): Promise<Uint8Array | null> {
  // Return cached result immediately
  if (_teluguFontCache instanceof Uint8Array) return _teluguFontCache;
  if (_teluguFontCache === false) return null;

  try {
    const res = await fetch('/fonts/NotoSansTelugu-Regular.ttf');
    if (!res.ok) {
      _teluguFontCache = false;
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    _teluguFontCache = bytes;
    return bytes;
  } catch {
    _teluguFontCache = false;
    return null;
  }
}

/**
 * Embed Noto Sans Telugu into a PDFDocument.
 * Returns the custom font, or null if the font could not be loaded.
 * When null is returned, callers use the provided Helvetica fallback.
 */
async function embedTeluguFont(pdfDoc: PDFDocument): Promise<PDFFont | null> {
  const bytes = await loadTeluguFontBytes();
  if (!bytes) return null;
  try {
    return await pdfDoc.embedFont(bytes, { subset: false });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Color palette (Matti earth)
// ---------------------------------------------------------------------------

const COLOR_BROWN = rgb(0.545, 0.271, 0.075);      // #8B4513
const COLOR_GOLD  = rgb(0.773, 0.627, 0.349);      // #C5A059
const COLOR_GREEN = rgb(0.176, 0.416, 0.310);      // #2D6A4F
const COLOR_RED   = rgb(0.753, 0.224, 0.169);      // #C0392B
const COLOR_BLACK = rgb(0.1, 0.1, 0.1);
const COLOR_GRAY  = rgb(0.5, 0.5, 0.5);
const COLOR_LIGHT_GRAY = rgb(0.95, 0.94, 0.92);
const COLOR_WHITE = rgb(1, 1, 1);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SeasonReport {
  farmerName: string;
  village: string;
  district: string;
  season: string;           // e.g. "Rabi 2026"
  totalIncome: number;      // rupees
  totalExpense: number;     // rupees
  balance: number;          // rupees
  transactions: Array<{
    date: string;
    description: string;
    amount: number;         // rupees (positive = income, negative = expense)
    kind: string;
  }>;
  topExpenseCategory: string;
  topExpensePercent: number;
  cropEvents: Array<{
    date: string;
    kind: string;
    crop: string;
    notes: string;
  }>;
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595;   // A4 points
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function fmt(n: number): string {
  // Use "Rs." prefix — WinAnsi (Helvetica) cannot encode the ₹ Unicode symbol
  return 'Rs. ' + Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function drawHeaderBar(
  page: PDFPage,
  boldFont: PDFFont,
  title: string,
  subtitle: string,
  teFont?: PDFFont | null,
): void {
  // Brown header bar
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 80,
    width: PAGE_WIDTH,
    height: 80,
    color: COLOR_BROWN,
  });

  // Title — use Telugu font if available (farmer names are in Telugu)
  page.drawText(title, {
    x: MARGIN,
    y: PAGE_HEIGHT - 32,
    size: 18,
    font: teFont ?? boldFont,
    color: COLOR_WHITE,
  });

  // Subtitle — season + location (may contain Telugu)
  page.drawText(subtitle, {
    x: MARGIN,
    y: PAGE_HEIGHT - 54,
    size: 11,
    font: teFont ?? boldFont,
    color: COLOR_GOLD,
  });

  // Gold accent line below header
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 84,
    width: PAGE_WIDTH,
    height: 4,
    color: COLOR_GOLD,
  });
}

function drawHRule(page: PDFPage, y: number): void {
  page.drawRectangle({
    x: MARGIN,
    y,
    width: CONTENT_WIDTH,
    height: 0.5,
    color: COLOR_GOLD,
    opacity: 0.5,
  });
}

function drawFooter(page: PDFPage, regularFont: PDFFont, pageNum: number): void {
  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  page.drawText(`Generated by Rythu Mitra  |  ${today}  |  Page ${pageNum}`, {
    x: MARGIN,
    y: 20,
    size: 8,
    font: regularFont,
    color: COLOR_GRAY,
  });
  drawHRule(page, 34);
}

// ---------------------------------------------------------------------------
// Season Report
// ---------------------------------------------------------------------------

/**
 * Generate a season summary PDF.
 *
 * Layout:
 *   Page 1: Header, financial summary, top 20 transactions
 *   Page 2 (if needed): remaining transactions + crop diary
 *
 * Telugu text (farmer name, village, labels) uses embedded Noto Sans Telugu.
 * Falls back to Helvetica if the font cannot be loaded.
 *
 * @returns Uint8Array of PDF bytes ready for download or sharing
 */
export async function generateSeasonReport(report: SeasonReport): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const boldFont    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Attempt Telugu font embedding — null means fall back to Helvetica
  const teFont = await embedTeluguFont(pdfDoc);

  // Helper: pick Telugu font when available, else Latin fallback
  const te  = (font: PDFFont) => teFont ?? font;
  const teBold = teFont ?? boldFont;

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // Header — pass teBold for farmer name + season (both may contain Telugu)
  drawHeaderBar(
    page,
    boldFont,
    `${report.farmerName} - Season Report`,
    `${report.season}  |  ${report.village}, ${report.district}`,
    teBold,
  );

  let y = PAGE_HEIGHT - 110;

  // ---- Financial Summary Box ----
  page.drawRectangle({
    x: MARGIN,
    y: y - 80,
    width: CONTENT_WIDTH,
    height: 80,
    color: COLOR_LIGHT_GRAY,
    borderColor: COLOR_GOLD,
    borderWidth: 1,
  });

  // Income / Expense / Balance labels: Latin-only, use Helvetica
  page.drawText('Total Income', { x: MARGIN + 10, y: y - 20, size: 10, font: regularFont, color: COLOR_GRAY });
  page.drawText(fmt(report.totalIncome), { x: MARGIN + 10, y: y - 38, size: 14, font: boldFont, color: COLOR_GREEN });

  const expX = MARGIN + CONTENT_WIDTH / 3;
  page.drawText('Total Expense', { x: expX, y: y - 20, size: 10, font: regularFont, color: COLOR_GRAY });
  page.drawText(fmt(report.totalExpense), { x: expX, y: y - 38, size: 14, font: boldFont, color: COLOR_RED });

  const balX = MARGIN + (CONTENT_WIDTH / 3) * 2;
  const balColor = report.balance >= 0 ? COLOR_GREEN : COLOR_RED;
  page.drawText('Balance', { x: balX, y: y - 20, size: 10, font: regularFont, color: COLOR_GRAY });
  page.drawText(fmt(report.balance), { x: balX, y: y - 38, size: 14, font: boldFont, color: balColor });

  // Top expense category label — may contain Telugu via kindLabel
  page.drawText(
    `Top expense: ${report.topExpenseCategory} (${report.topExpensePercent.toFixed(0)}%)`,
    { x: MARGIN + 10, y: y - 62, size: 9, font: te(regularFont), color: COLOR_GRAY },
  );

  y -= 100;

  // ---- Transactions Table ----
  // Section heading: "Transactions" is Latin
  page.drawText('Transactions', { x: MARGIN, y, size: 13, font: boldFont, color: COLOR_BROWN });
  y -= 20;
  drawHRule(page, y);
  y -= 12;

  // Table column headers: Latin
  const colDate  = MARGIN;
  const colDesc  = MARGIN + 70;
  const colKind  = MARGIN + 290;
  const colAmt   = MARGIN + 410;

  page.drawText('Date',        { x: colDate, y, size: 9, font: boldFont, color: COLOR_GRAY });
  page.drawText('Description', { x: colDesc, y, size: 9, font: boldFont, color: COLOR_GRAY });
  page.drawText('Category',    { x: colKind, y, size: 9, font: boldFont, color: COLOR_GRAY });
  page.drawText('Amount',      { x: colAmt,  y, size: 9, font: boldFont, color: COLOR_GRAY });
  y -= 6;
  drawHRule(page, y);
  y -= 14;

  const ROW_HEIGHT = 16;
  const FOOTER_MARGIN = 50;

  let pageNum = 1;
  let txIndex = 0;

  for (const tx of report.transactions) {
    // New page if needed
    if (y < FOOTER_MARGIN + ROW_HEIGHT) {
      drawFooter(page, regularFont, pageNum);
      pageNum++;
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawHeaderBar(page, boldFont, `${report.farmerName} - Season Report (cont.)`, report.season, teBold);
      y = PAGE_HEIGHT - 110;
    }

    // Alternating row background
    if (txIndex % 2 === 0) {
      page.drawRectangle({
        x: MARGIN,
        y: y - 3,
        width: CONTENT_WIDTH,
        height: ROW_HEIGHT,
        color: COLOR_LIGHT_GRAY,
        opacity: 0.5,
      });
    }

    const amtColor = tx.amount >= 0 ? COLOR_GREEN : COLOR_RED;
    const amtStr = (tx.amount >= 0 ? '+' : '-') + fmt(tx.amount);

    // Truncate long descriptions — Telugu text, use te() font
    const descShort = tx.description.length > 28 ? tx.description.slice(0, 26) + '..' : tx.description;
    const kindShort = tx.kind.length > 16 ? tx.kind.slice(0, 14) + '..' : tx.kind;

    page.drawText(tx.date,    { x: colDate, y, size: 9, font: regularFont,   color: COLOR_BLACK });
    page.drawText(descShort,  { x: colDesc, y, size: 9, font: te(regularFont), color: COLOR_BLACK });
    page.drawText(kindShort,  { x: colKind, y, size: 9, font: te(regularFont), color: COLOR_GRAY  });
    page.drawText(amtStr,     { x: colAmt,  y, size: 9, font: boldFont,       color: amtColor    });

    y -= ROW_HEIGHT;
    txIndex++;
  }

  // ---- Crop Diary ----
  if (report.cropEvents.length > 0) {
    // New page if not enough room
    if (y < FOOTER_MARGIN + 80) {
      drawFooter(page, regularFont, pageNum);
      pageNum++;
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawHeaderBar(page, boldFont, `${report.farmerName} - Crop Diary`, report.season, teBold);
      y = PAGE_HEIGHT - 110;
    }

    y -= 10;
    page.drawText('Crop Diary', { x: MARGIN, y, size: 13, font: boldFont, color: COLOR_BROWN });
    y -= 20;
    drawHRule(page, y);
    y -= 14;

    // Column headers: Latin
    page.drawText('Date',  { x: MARGIN,       y, size: 9, font: boldFont, color: COLOR_GRAY });
    page.drawText('Event', { x: MARGIN + 70,  y, size: 9, font: boldFont, color: COLOR_GRAY });
    page.drawText('Crop',  { x: MARGIN + 150, y, size: 9, font: boldFont, color: COLOR_GRAY });
    page.drawText('Notes', { x: MARGIN + 230, y, size: 9, font: boldFont, color: COLOR_GRAY });
    y -= 6;
    drawHRule(page, y);
    y -= 14;

    for (const ev of report.cropEvents) {
      if (y < FOOTER_MARGIN + ROW_HEIGHT) {
        drawFooter(page, regularFont, pageNum);
        pageNum++;
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawHeaderBar(page, boldFont, `${report.farmerName} - Crop Diary (cont.)`, report.season, teBold);
        y = PAGE_HEIGHT - 110;
      }

      const notesShort = ev.notes.length > 30 ? ev.notes.slice(0, 28) + '..' : ev.notes;
      // ev.kind, ev.crop, ev.notes may all be Telugu
      page.drawText(ev.date,     { x: MARGIN,       y, size: 9, font: regularFont,     color: COLOR_BLACK });
      page.drawText(ev.kind,     { x: MARGIN + 70,  y, size: 9, font: te(regularFont), color: COLOR_BROWN });
      page.drawText(ev.crop,     { x: MARGIN + 150, y, size: 9, font: te(regularFont), color: COLOR_BLACK });
      page.drawText(notesShort,  { x: MARGIN + 230, y, size: 9, font: te(regularFont), color: COLOR_GRAY  });
      y -= ROW_HEIGHT;
    }
  }

  drawFooter(page, regularFont, pageNum);

  return pdfDoc.save();
}

// ---------------------------------------------------------------------------
// Single Transaction Receipt
// ---------------------------------------------------------------------------

/**
 * Generate a single-page transaction receipt.
 *
 * Layout:
 *   Brown header with "Receipt" title
 *   Centered amount (green for income, red for expense)
 *   Details grid: date, kind, description
 *   Footer: "Generated by Rythu Mitra"
 *
 * @param farmerName  Farmer's name
 * @param amount      Amount in rupees (positive = income, negative = expense)
 * @param kind        Transaction category label
 * @param description Free text description
 * @param date        Date string (ISO or DD/MM/YYYY)
 * @returns Uint8Array of PDF bytes
 */
export async function generateReceipt(
  farmerName: string,
  amount: number,
  kind: string,
  description: string,
  date: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const boldFont    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Attempt Telugu font embedding — null means fall back to Helvetica
  const teFont = await embedTeluguFont(pdfDoc);
  const te  = (font: PDFFont) => teFont ?? font;
  const teBold = teFont ?? boldFont;

  // Half-page receipt (A5 landscape feel: 595 × 420)
  const RECEIPT_HEIGHT = 420;
  const page = pdfDoc.addPage([PAGE_WIDTH, RECEIPT_HEIGHT]);

  // Brown header
  page.drawRectangle({
    x: 0,
    y: RECEIPT_HEIGHT - 70,
    width: PAGE_WIDTH,
    height: 70,
    color: COLOR_BROWN,
  });

  page.drawText('Rythu Mitra - Receipt', {
    x: MARGIN,
    y: RECEIPT_HEIGHT - 28,
    size: 16,
    font: boldFont,
    color: COLOR_WHITE,
  });

  // Farmer name is Telugu — use teBold
  page.drawText(farmerName, {
    x: MARGIN,
    y: RECEIPT_HEIGHT - 50,
    size: 11,
    font: teBold,
    color: COLOR_GOLD,
  });

  // Gold accent
  page.drawRectangle({ x: 0, y: RECEIPT_HEIGHT - 74, width: PAGE_WIDTH, height: 4, color: COLOR_GOLD });

  // Large amount display (centered)
  const isIncome = amount >= 0;
  const amtColor = isIncome ? COLOR_GREEN : COLOR_RED;
  const amtLabel = isIncome ? 'Income' : 'Expense';
  const amtStr = fmt(amount);

  const amtFontSize = 32;
  const amtWidth = boldFont.widthOfTextAtSize(amtStr, amtFontSize);
  page.drawText(amtStr, {
    x: (PAGE_WIDTH - amtWidth) / 2,
    y: RECEIPT_HEIGHT - 140,
    size: amtFontSize,
    font: boldFont,
    color: amtColor,
  });

  const labelWidth = regularFont.widthOfTextAtSize(amtLabel, 12);
  page.drawText(amtLabel, {
    x: (PAGE_WIDTH - labelWidth) / 2,
    y: RECEIPT_HEIGHT - 162,
    size: 12,
    font: regularFont,
    color: COLOR_GRAY,
  });

  // Gold separator
  page.drawRectangle({ x: MARGIN, y: RECEIPT_HEIGHT - 180, width: CONTENT_WIDTH, height: 1, color: COLOR_GOLD, opacity: 0.6 });

  // Details grid
  // Labels are Latin; values may be Telugu (kind label, description)
  const detailY = RECEIPT_HEIGHT - 210;
  const labelX = MARGIN;
  const valueX = MARGIN + 100;
  const ROW = 24;

  const details: Array<[string, string, boolean]> = [
    //  [label,         value,               isTeluguValue]
    ['Date',        date,                 false],
    ['Category',    kind,                 true],
    ['Description', description || '\u2014', true],
  ];

  for (let i = 0; i < details.length; i++) {
    const ry = detailY - i * ROW;
    const [label, rawVal, isTe] = details[i];

    page.drawText(label + ':', { x: labelX, y: ry, size: 11, font: boldFont, color: COLOR_GRAY });

    // Use Telugu font for Telugu values; Helvetica for date
    const valFont = isTe ? te(regularFont) : regularFont;

    // Truncate long values to fit — measure with the right font
    let val = rawVal;
    while (val.length > 3 && valFont.widthOfTextAtSize(val, 11) > CONTENT_WIDTH - 110) {
      val = val.slice(0, -4) + '...';
    }
    page.drawText(val, { x: valueX, y: ry, size: 11, font: valFont, color: COLOR_BLACK });
  }

  // Footer
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  page.drawRectangle({ x: MARGIN, y: 34, width: CONTENT_WIDTH, height: 0.5, color: COLOR_GOLD, opacity: 0.5 });
  page.drawText(`Generated by Rythu Mitra  |  ${today}`, {
    x: MARGIN,
    y: 20,
    size: 8,
    font: regularFont,
    color: COLOR_GRAY,
  });

  return pdfDoc.save();
}

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

/**
 * Trigger a browser file download for a PDF Uint8Array.
 *
 * Creates a temporary blob URL, clicks it, then revokes.
 * Safe to call in Tauri webview + standard browser.
 *
 * @param pdfBytes  The raw PDF bytes from generateSeasonReport / generateReceipt
 * @param filename  Suggested filename (e.g. "season_report_rabi2026.pdf")
 */
export function downloadPdf(pdfBytes: Uint8Array, filename: string): void {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revoke to ensure the download starts
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
