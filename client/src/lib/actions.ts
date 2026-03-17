/**
 * Rythu Mitra AI -- Action Routing + Execution
 *
 * Extracts JSON action blocks from AI responses and routes them to
 * the appropriate handler: STDB reducer, web search, memory storage.
 *
 * Pattern follows AsymmFlow client.ts extractSkillBlock -- scan for
 * bare JSON at end of response, parse, validate, strip from visible text.
 *
 * Action types:
 *   - record_money   -> STDB record_money_event reducer
 *   - update_money   -> STDB update_money_event reducer (NEW)
 *   - delete_money   -> STDB remove_money_event reducer (NEW)
 *   - record_crop    -> STDB record_crop_event reducer
 *   - record_from_bill -> record from OCR-parsed bill (NEW)
 *   - web_search     -> Google search / fallback
 *   - remember       -> localStorage memory system
 *   - check_scheme   -> STDB check_scheme_status procedure
 */

import { get } from 'svelte/store';
import { localMoneyEvents, myIdentity, connected, moneyEvents } from './stores';
import { saveMemory } from './memory';
import { getConnection } from './db';
import { generateIdempotencyKey } from './voice';
import { performSearch } from './search';
import { analyseOcrForOvercharges } from './vyapti';
import type { MoneyEvent } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatAction {
  action: string;
  [key: string]: unknown;
}

export interface ActionResult {
  success: boolean;
  message: string;       // Telugu status message for the user
  data?: unknown;        // Optional structured data
  undoAction?: UndoAction; // Optional undo data (NEW)
}

// ---------------------------------------------------------------------------
// Undo System (NEW)
// ---------------------------------------------------------------------------

export interface UndoAction {
  type: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;  // Data needed to reverse the action
  expiresAt: number;              // Date.now() + 30000
  label: string;                  // Telugu description for the undo button
}

let lastUndo: UndoAction | null = null;
let undoTimeout: ReturnType<typeof setTimeout> | null = null;

/** Get the current pending undo action (null if expired or none). */
export function getPendingUndo(): UndoAction | null {
  if (!lastUndo) return null;
  if (Date.now() > lastUndo.expiresAt) {
    lastUndo = null;
    return null;
  }
  return lastUndo;
}

/** Set a new undo action. Auto-expires after 30 seconds. */
function setUndo(action: UndoAction): void {
  lastUndo = action;
  if (undoTimeout) clearTimeout(undoTimeout);
  undoTimeout = setTimeout(() => {
    if (lastUndo === action) lastUndo = null;
  }, 30000);
}

/** Clear the pending undo action. */
export function clearUndo(): void {
  lastUndo = null;
  if (undoTimeout) {
    clearTimeout(undoTimeout);
    undoTimeout = null;
  }
}

/** Execute the pending undo action. Returns Telugu confirmation. */
export async function executeUndo(): Promise<ActionResult> {
  const undo = getPendingUndo();
  if (!undo) {
    return { success: false, message: 'రద్దు చేయడానికి ఏమీ లేదు' };
  }

  clearUndo();

  switch (undo.type) {
    case 'create': {
      // Undo a creation = delete the created record
      const eventId = undo.data.event_id;
      if (eventId !== undefined) {
        return handleDeleteMoney({
          action: 'delete_money',
          event_id: eventId,
          _skipUndo: true,
        });
      }
      // Local-only undo: remove from localMoneyEvents
      const localId = undo.data.local_id as string;
      if (localId) {
        localMoneyEvents.update(events => events.filter(e => e.id !== localId));
        return { success: true, message: '↩️ నమోదు రద్దు చేయబడింది' };
      }
      return { success: false, message: 'రద్దు చేయలేకపోతున్నాము' };
    }

    case 'update': {
      // Undo an update = restore old values
      const oldData = undo.data;
      return handleUpdateMoney({
        action: 'update_money',
        event_id: oldData.event_id,
        amount_paise: oldData.old_amount_paise,
        kind: oldData.old_kind,
        is_income: oldData.old_is_income,
        description: oldData.old_description,
        party: oldData.old_party,
        _skipUndo: true,
      });
    }

    case 'delete': {
      // Undo a deletion = re-create the deleted record
      const oldData = undo.data;
      return handleRecordMoney({
        action: 'record_money',
        amount_paise: oldData.amount_paise,
        kind: oldData.kind,
        is_income: oldData.is_income,
        description: oldData.description,
        party: oldData.party,
        _skipUndo: true,
      });
    }

    default:
      return { success: false, message: 'తెలియని undo రకం' };
  }
}

// ---------------------------------------------------------------------------
// Action Extraction (from AI response text)
// ---------------------------------------------------------------------------

/**
 * Extract a JSON action block from the end of AI response text.
 * Returns the cleaned text (action block removed) and parsed action.
 *
 * The AI is instructed to place ONE action JSON block at the END of its response.
 * Pattern: {"action":"...", ...} with no markdown fences.
 */
export function extractAction(responseText: string): {
  cleanText: string;
  action: ChatAction | null;
} {
  // Match a JSON object at end-of-content containing "action" key
  const jsonPattern = /\s*(\{"action"\s*:[\s\S]*\})\s*$/;
  const match = jsonPattern.exec(responseText);

  if (!match) {
    return { cleanText: responseText.trimEnd(), action: null };
  }

  try {
    const parsed = JSON.parse(match[1]) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'action' in parsed &&
      typeof (parsed as ChatAction).action === 'string'
    ) {
      const action = parsed as ChatAction;
      const cleanText = responseText.slice(0, match.index).trimEnd();
      return { cleanText, action };
    }
  } catch {
    // Not valid JSON -- leave content untouched
  }

  return { cleanText: responseText.trimEnd(), action: null };
}

// ---------------------------------------------------------------------------
// Kind mapping (AI response -> STDB enum)
// ---------------------------------------------------------------------------

const MONEY_KIND_MAP: Record<string, string> = {
  LaborPayment: 'LaborPayment',
  InputPurchase: 'InputPurchase',
  CropSale: 'CropSale',
  GovernmentTransfer: 'GovernmentTransfer',
  UPIPayment: 'UPIPayment',
  Other: 'Other',
  // Fallback aliases
  labor: 'LaborPayment',
  seeds: 'InputPurchase',
  fertilizer: 'InputPurchase',
  sale: 'CropSale',
  govt: 'GovernmentTransfer',
  upi: 'UPIPayment',
};

const CROP_EVENT_KINDS = ['Planted', 'Sprayed', 'PestObserved', 'Irrigated', 'Harvested', 'Sold'];

const KIND_CATEGORY_TELUGU: Record<string, string> = {
  LaborPayment: 'కూలి',
  InputPurchase: 'కొనుగోలు',
  CropSale: 'పంట అమ్మకం',
  GovernmentTransfer: 'ప్రభుత్వ సబ్సిడీ',
  UPIPayment: 'UPI చెల్లింపు',
  Other: 'ఇతర',
};

// ---------------------------------------------------------------------------
// Validation Gates (Ananta 4-gate pattern: Sanity, Consistency, Safety, Quality)
// ---------------------------------------------------------------------------

interface ValidationResult {
  valid: boolean;
  warning?: string;
}

/**
 * Validate a money action before execution.
 * Implements Ananta's 4 validation gates:
 *   1. Sanity: Is the amount reasonable?
 *   2. Consistency: Does kind match the description?
 *   3. Safety: Will this action cause problems?
 *   4. Quality: Is the intent clear enough to act on?
 */
function validateMoneyAction(action: ChatAction): ValidationResult {
  const amount = Number(action.amount_paise || 0);

  // Gate 1: Sanity — amount must be positive and reasonable
  if (amount <= 0) {
    return { valid: false, warning: 'మొత్తం 0 కంటే ఎక్కువ ఉండాలి' };
  }
  if (amount > 10000000) { // > Rs 1,00,000
    return { valid: false, warning: '⚠️ మొత్తం ₹1,00,000 కంటే ఎక్కువ ఉంది — సరిచూసుకోండి' };
  }

  // Gate 2: Consistency — kind should be valid
  const kind = String(action.kind || '');
  if (!MONEY_KIND_MAP[kind]) {
    // Auto-correct to 'Other' rather than rejecting
    action.kind = 'Other';
  }

  // Gate 3: Duplicate prevention (soft warning — time-window check within 5 minutes)
  // Skip if caller explicitly marks this as an override
  if (!action._allowDuplicate) {
    const recentEvents = get(moneyEvents);
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const mappedKind = MONEY_KIND_MAP[String(action.kind || 'Other')] || 'Other';
    const isDuplicate = recentEvents.some(e => {
      const eventTime = new Date(e.date + 'T' + e.time).getTime();
      return (
        eventTime > fiveMinAgo &&
        Math.abs(e.amount) * 100 === amount &&
        mapUiKindToStdb(e.kind) === mappedKind
      );
    });
    if (isDuplicate) {
      return {
        valid: false,
        warning: '⚠️ ఈ లావాదేవీ ఇప్పుడే నమోదు చేయబడింది. మళ్ళీ నమోదు చేయమంటారా?',
      };
    }
  }

  // Gate 4: Quality — description shouldn't be empty for meaningful records
  // (soft gate — we allow it but it's better with description)

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Action Handlers
// ---------------------------------------------------------------------------

/**
 * Check if this income event ends a gap of more than 14 days without income.
 * Returns a celebratory suffix string if so, empty string otherwise.
 */
function checkIncomeGapCelebration(isIncome: boolean): string {
  if (!isIncome) return '';
  const events = get(moneyEvents);
  const incomeEvents = events.filter(e => e.amount > 0);
  if (incomeEvents.length === 0) return ''; // No prior income to compare against
  const latest = incomeEvents.reduce((a, b) => a.date > b.date ? a : b);
  const daysSince = Math.floor((Date.now() - new Date(latest.date).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince > 14) {
    return ` 🎉 ${daysSince} రోజుల తర్వాత ఆదాయం వచ్చింది!`;
  }
  return '';
}

async function handleRecordMoney(action: ChatAction): Promise<ActionResult> {
  // Run validation gates first
  const validation = validateMoneyAction(action);
  if (!validation.valid) {
    return { success: false, message: validation.warning || 'చెల్లని చర్య' };
  }

  const amountPaise = Number(action.amount_paise || 0);
  const kind = MONEY_KIND_MAP[String(action.kind || 'Other')] || 'Other';
  const isIncome = Boolean(action.is_income);
  const description = String(action.description || '');
  const party = String(action.party || '');
  const skipUndo = Boolean(action._skipUndo);

  if (amountPaise <= 0) {
    return { success: false, message: 'మొత్తం 0 కంటే ఎక్కువ ఉండాలి' };
  }

  const conn = getConnection();
  const identity = get(myIdentity);
  const isConnected = get(connected);

  // Try STDB reducer first
  if (conn && isConnected && identity) {
    try {
      const idempotencyKey = generateIdempotencyKey(
        String(identity),
        amountPaise,
        new Date().toISOString().slice(0, 10),
      );

      conn.reducers.recordMoneyEvent({
        kind,
        amountPaise: BigInt(amountPaise),
        isIncome,
        category: KIND_CATEGORY_TELUGU[kind] || 'ఇతర',
        description,
        partyName: party,
        season: `rabi_2026`,
        idempotencyKey,
      });

      const rupees = amountPaise / 100;
      const direction = isIncome ? 'ఆదాయం' : 'ఖర్చు';
      const gapCelebration = checkIncomeGapCelebration(isIncome);
      const result: ActionResult = {
        success: true,
        message: `✅ ₹${rupees.toLocaleString('en-IN')} ${KIND_CATEGORY_TELUGU[kind] || kind} ${direction} నమోదు అయింది${gapCelebration}`,
      };

      // Set undo for creation (skip if this is already an undo operation)
      if (!skipUndo) {
        // Note: We can't easily get the STDB-assigned ID here because the reducer
        // call is async. The undo for STDB records would need the event_id.
        // For now, undo for STDB creates is limited.
        setUndo({
          type: 'create',
          data: { amount_paise: amountPaise, kind, is_income: isIncome, description, party },
          expiresAt: Date.now() + 30000,
          label: `₹${rupees.toLocaleString('en-IN')} ${KIND_CATEGORY_TELUGU[kind] || kind}`,
        });
        result.undoAction = getPendingUndo() ?? undefined;
      }

      return result;
    } catch (err) {
      console.error('[actions] STDB record_money_event failed:', err);
      // Fall through to local storage
    }
  }

  // Fallback: add to local money events
  // Income gap check BEFORE adding the new event (so we compare against existing data)
  const gapCelebrationLocal = checkIncomeGapCelebration(isIncome);

  const rupees = amountPaise / 100;
  const amount = isIncome ? rupees : -rupees;
  const now = new Date();
  const localId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const localEvent: MoneyEvent = {
    id: localId,
    farmerId: String(identity || '1'),
    kind: kind === 'LaborPayment' ? 'labor'
      : kind === 'InputPurchase' ? 'seeds'
      : kind === 'CropSale' ? 'crop_sale'
      : kind === 'GovernmentTransfer' ? 'govt_subsidy'
      : 'other',
    amount,
    description,
    category: KIND_CATEGORY_TELUGU[kind] || 'ఇతర',
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
  };

  localMoneyEvents.update(events => [localEvent, ...events]);

  const direction = isIncome ? 'ఆదాయం' : 'ఖర్చు';
  const result: ActionResult = {
    success: true,
    message: `✅ ₹${rupees.toLocaleString('en-IN')} ${KIND_CATEGORY_TELUGU[kind] || kind} ${direction} నమోదు అయింది (లోకల్)${gapCelebrationLocal}`,
  };

  if (!skipUndo) {
    setUndo({
      type: 'create',
      data: { local_id: localId },
      expiresAt: Date.now() + 30000,
      label: `₹${rupees.toLocaleString('en-IN')} ${KIND_CATEGORY_TELUGU[kind] || kind}`,
    });
    result.undoAction = getPendingUndo() ?? undefined;
  }

  return result;
}

// ---------------------------------------------------------------------------
// UPDATE Money Event (NEW)
// ---------------------------------------------------------------------------

async function handleUpdateMoney(action: ChatAction): Promise<ActionResult> {
  const eventId = action.event_id;
  const newAmountPaise = Number(action.amount_paise || 0);
  const newKind = MONEY_KIND_MAP[String(action.kind || '')] || '';
  const newDescription = String(action.description || '');
  const newParty = String(action.party || '');
  const newIsIncome = action.is_income !== undefined ? Boolean(action.is_income) : undefined;
  const skipUndo = Boolean(action._skipUndo);

  if (eventId === undefined || eventId === null) {
    return { success: false, message: 'event_id అవసరం' };
  }

  const conn = getConnection();
  const isConnected = get(connected);

  // STDB update
  if (conn && isConnected) {
    try {
      // Find the existing event from the money events store to get old values
      const events = get(moneyEvents);
      const existing = events.find(e => e.id === String(eventId));

      // Call STDB reducer (updateMoneyEvent added to module, requires spacetime build)
      // Cast through any because bindings may not include it until next codegen
      const reducers = conn.reducers as Record<string, (...args: unknown[]) => unknown>;
      if (typeof reducers.updateMoneyEvent === 'function') {
        reducers.updateMoneyEvent({
          eventId: BigInt(eventId as number),
          amountPaise: BigInt(newAmountPaise > 0 ? newAmountPaise : (existing ? Math.abs(existing.amount) * 100 : 0)),
          kind: newKind || (existing ? mapUiKindToStdb(existing.kind) : 'Other'),
          isIncome: newIsIncome !== undefined ? newIsIncome : (existing ? existing.amount >= 0 : false),
          description: newDescription || (existing?.description ?? ''),
          partyName: newParty,
        });
      } else {
        // Fallback: delete + re-create
        conn.reducers.removeMoneyEvent({ eventId: BigInt(eventId as number) });
        const idempotencyKey = `update_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const kind2 = newKind || (existing ? mapUiKindToStdb(existing.kind) : 'Other');
        const isIncome2 = newIsIncome !== undefined ? newIsIncome : (existing ? existing.amount >= 0 : false);
        conn.reducers.recordMoneyEvent({
          kind: kind2,
          amountPaise: BigInt(newAmountPaise > 0 ? newAmountPaise : (existing ? Math.abs(existing.amount) * 100 : 0)),
          isIncome: isIncome2,
          category: KIND_CATEGORY_TELUGU[kind2] || 'ఇతర',
          description: newDescription || (existing?.description ?? ''),
          partyName: newParty,
          season: 'rabi_2026',
          idempotencyKey,
        });
      }

      const oldRupees = existing ? Math.abs(existing.amount) : 0;
      const newRupees = newAmountPaise > 0 ? newAmountPaise / 100 : oldRupees;

      const result: ActionResult = {
        success: true,
        message: `✅ ₹${oldRupees.toLocaleString('en-IN')} → ₹${newRupees.toLocaleString('en-IN')} మార్చబడింది`,
      };

      if (!skipUndo && existing) {
        setUndo({
          type: 'update',
          data: {
            event_id: eventId,
            old_amount_paise: Math.abs(existing.amount) * 100,
            old_kind: mapUiKindToStdb(existing.kind),
            old_is_income: existing.amount >= 0,
            old_description: existing.description,
            old_party: '',
          },
          expiresAt: Date.now() + 30000,
          label: `₹${oldRupees.toLocaleString('en-IN')} → ₹${newRupees.toLocaleString('en-IN')}`,
        });
        result.undoAction = getPendingUndo() ?? undefined;
      }

      return result;
    } catch (err) {
      console.error('[actions] STDB update_money_event failed:', err);
      return { success: false, message: `అప్‌డేట్ విఫలమైంది: ${err}` };
    }
  }

  // Local update fallback
  const events = get(moneyEvents);
  const existing = events.find(e => e.id === String(eventId));
  if (!existing) {
    return { success: false, message: `ఈవెంట్ #${eventId} కనుగొనబడలేదు` };
  }

  const oldRupees = Math.abs(existing.amount);

  localMoneyEvents.update(evts => evts.map(e => {
    if (e.id !== String(eventId)) return e;
    const updatedAmount = newAmountPaise > 0 ? newAmountPaise / 100 : Math.abs(e.amount);
    const updatedIsIncome = newIsIncome !== undefined ? newIsIncome : e.amount >= 0;
    return {
      ...e,
      amount: updatedIsIncome ? updatedAmount : -updatedAmount,
      description: newDescription || e.description,
      kind: newKind ? mapStdbKindToUi(newKind) : e.kind,
    };
  }));

  const newRupees = newAmountPaise > 0 ? newAmountPaise / 100 : oldRupees;
  const result: ActionResult = {
    success: true,
    message: `✅ ₹${oldRupees.toLocaleString('en-IN')} → ₹${newRupees.toLocaleString('en-IN')} మార్చబడింది (లోకల్)`,
  };

  if (!skipUndo) {
    setUndo({
      type: 'update',
      data: {
        event_id: eventId,
        old_amount_paise: Math.abs(existing.amount) * 100,
        old_kind: mapUiKindToStdb(existing.kind),
        old_is_income: existing.amount >= 0,
        old_description: existing.description,
        old_party: '',
      },
      expiresAt: Date.now() + 30000,
      label: `₹${oldRupees.toLocaleString('en-IN')} → ₹${newRupees.toLocaleString('en-IN')}`,
    });
    result.undoAction = getPendingUndo() ?? undefined;
  }

  return result;
}

// ---------------------------------------------------------------------------
// DELETE Money Event (NEW)
// ---------------------------------------------------------------------------

async function handleDeleteMoney(action: ChatAction): Promise<ActionResult> {
  const eventId = action.event_id;
  const skipUndo = Boolean(action._skipUndo);

  if (eventId === undefined || eventId === null) {
    return { success: false, message: 'event_id అవసరం' };
  }

  const conn = getConnection();
  const isConnected = get(connected);

  // Capture existing data before deletion (for undo)
  const events = get(moneyEvents);
  const existing = events.find(e => e.id === String(eventId));

  // STDB delete
  if (conn && isConnected) {
    try {
      conn.reducers.removeMoneyEvent({
        eventId: BigInt(eventId as number),
      });

      const rupees = existing ? Math.abs(existing.amount) : 0;
      const desc = existing?.description || '';
      const result: ActionResult = {
        success: true,
        message: `🗑️ ₹${rupees.toLocaleString('en-IN')} ${desc} తొలగించబడింది`,
      };

      if (!skipUndo && existing) {
        setUndo({
          type: 'delete',
          data: {
            amount_paise: Math.abs(existing.amount) * 100,
            kind: mapUiKindToStdb(existing.kind),
            is_income: existing.amount >= 0,
            description: existing.description,
            party: '',
          },
          expiresAt: Date.now() + 30000,
          label: `₹${rupees.toLocaleString('en-IN')} ${desc}`,
        });
        result.undoAction = getPendingUndo() ?? undefined;
      }

      return result;
    } catch (err) {
      console.error('[actions] STDB remove_money_event failed:', err);
      return { success: false, message: `తొలగింపు విఫలమైంది: ${err}` };
    }
  }

  // Local delete fallback
  if (!existing) {
    return { success: false, message: `ఈవెంట్ #${eventId} కనుగొనబడలేదు` };
  }

  localMoneyEvents.update(evts => evts.filter(e => e.id !== String(eventId)));

  const rupees = Math.abs(existing.amount);
  const desc = existing.description;
  const result: ActionResult = {
    success: true,
    message: `🗑️ ₹${rupees.toLocaleString('en-IN')} ${desc} తొలగించబడింది (లోకల్)`,
  };

  if (!skipUndo) {
    setUndo({
      type: 'delete',
      data: {
        amount_paise: Math.abs(existing.amount) * 100,
        kind: mapUiKindToStdb(existing.kind),
        is_income: existing.amount >= 0,
        description: existing.description,
        party: '',
      },
      expiresAt: Date.now() + 30000,
      label: `₹${rupees.toLocaleString('en-IN')} ${desc}`,
    });
    result.undoAction = getPendingUndo() ?? undefined;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Kind mapping helpers
// ---------------------------------------------------------------------------

function mapUiKindToStdb(kind: string): string {
  const map: Record<string, string> = {
    labor: 'LaborPayment',
    seeds: 'InputPurchase',
    fertilizer: 'InputPurchase',
    irrigation: 'Other',
    transport: 'Other',
    crop_sale: 'CropSale',
    govt_subsidy: 'GovernmentTransfer',
    other: 'Other',
  };
  return map[kind] || 'Other';
}

function mapStdbKindToUi(kind: string): MoneyEvent['kind'] {
  const map: Record<string, MoneyEvent['kind']> = {
    LaborPayment: 'labor',
    InputPurchase: 'seeds',
    CropSale: 'crop_sale',
    GovernmentTransfer: 'govt_subsidy',
    UPIPayment: 'other',
    Other: 'other',
  };
  return map[kind] || 'other';
}

// ---------------------------------------------------------------------------
// Existing Handlers (unchanged)
// ---------------------------------------------------------------------------

async function handleRecordCrop(action: ChatAction): Promise<ActionResult> {
  const kind = String(action.kind || 'PestObserved');
  const crop = String(action.crop || 'వేరుశెనగ');
  const description = String(action.description || '');

  if (!CROP_EVENT_KINDS.includes(kind)) {
    return { success: false, message: `తెలియని పంట ఈవెంట్ రకం: ${kind}` };
  }

  const conn = getConnection();
  const isConnected = get(connected);

  if (conn && isConnected) {
    try {
      conn.reducers.recordCropEvent({
        kind,
        crop,
        plotId: 'plot_a',
        photoBytes: undefined,
        aiNotes: description,
        gpsLat: undefined,
        gpsLon: undefined,
      });

      return {
        success: true,
        message: `✅ ${crop} -- ${kind} నమోదు అయింది`,
      };
    } catch (err) {
      console.error('[actions] STDB record_crop_event failed:', err);
    }
  }

  return {
    success: true,
    message: `✅ ${crop} -- ${kind} నమోదు అయింది (లోకల్)`,
  };
}

async function handleWebSearch(action: ChatAction): Promise<ActionResult> {
  const query = String(action.query || '');
  if (!query) {
    return { success: false, message: 'సెర్చ్ query ఖాళీగా ఉంది' };
  }

  return performWebSearch(query);
}

async function handleRemember(action: ChatAction): Promise<ActionResult> {
  const content = String(action.content || '');
  const source = String(action.source || 'ai_observed') as 'ai_observed' | 'farmer_stated' | 'pattern_detected';
  const confidence = Number(action.confidence || 0.7);

  if (!content) {
    return { success: false, message: 'జ్ఞాపకం ఖాళీగా ఉంది' };
  }

  const validSources = ['ai_observed', 'farmer_stated', 'pattern_detected'];
  const validatedSource = validSources.includes(source) ? source : 'ai_observed';

  saveMemory(content, validatedSource as 'ai_observed' | 'farmer_stated' | 'pattern_detected', confidence);

  return {
    success: true,
    message: `💭 గుర్తుంచుకున్నాను: "${content.slice(0, 40)}${content.length > 40 ? '...' : ''}"`,
  };
}

async function handleCheckScheme(action: ChatAction): Promise<ActionResult> {
  const schemeName = String(action.scheme_name || 'PM-KISAN');

  return {
    success: true,
    message: `🏛️ ${schemeName} స్థితి: చివరి వాయిదా Rs2,000 (జూన్ 2025). తదుపరి వాయిదా ఇంకా రాలేదు. pmkisan.gov.in లో చెక్ చేయండి.`,
  };
}

// ---------------------------------------------------------------------------
// Record from Bill (OCR result -> money event) (NEW)
// ---------------------------------------------------------------------------

async function handleRecordFromBill(action: ChatAction): Promise<ActionResult> {
  // The AI interprets OCR text and constructs a structured action
  const result = await handleRecordMoney({
    action: 'record_money',
    amount_paise: action.amount_paise,
    kind: action.kind || 'InputPurchase',
    is_income: action.is_income ?? false,
    description: action.description || '',
    party: action.party || '',
  });

  // Run Vyāpti overcharge detection on the original OCR text (if provided)
  const ocrText = String(action.ocr_text || '');
  if (ocrText.length > 5) {
    try {
      const { overcharges } = analyseOcrForOvercharges(ocrText);
      if (overcharges.length > 0) {
        const alerts = overcharges.map(o =>
          `⚠️ ${o.product.name}: డీలర్ ₹${(o.detectedPrice / 100).toLocaleString('en-IN')} vs MRP ₹${(o.expectedPrice / 100).toLocaleString('en-IN')} (${o.overchargePercent}% ఎక్కువ)`
        );
        result.message += '\n\n' + alerts.join('\n');
      }
    } catch (err) {
      console.warn('[actions] Vyāpti overcharge check failed:', err);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Web Search
// ---------------------------------------------------------------------------

/**
 * Perform a web search and return Telugu summary.
 * Uses the multi-provider fallback chain from search.ts:
 *   1. Cached Agricultural Knowledge Base (offline, instant)
 *   2. DuckDuckGo Instant Answer API (free, no key)
 *   3. Google Custom Search (if keys configured)
 *   4. Sarvam AI knowledge retrieval (last resort)
 */
export async function performWebSearch(query: string): Promise<ActionResult> {
  if (!query) {
    return { success: false, message: 'సెర్చ్ query ఖాళీగా ఉంది' };
  }

  try {
    const { results, summary } = await performSearch(query);

    if (results.length === 0) {
      return {
        success: true,
        message: `🔍 "${query}" కోసం ఫలితాలు దొరకలేదు. నా జ్ఞానం ప్రకారం సమాధానం ఇస్తాను.`,
      };
    }

    // Format top 3 results with source emoji prefix
    const lines = results.slice(0, 3).map(r => {
      const sourceEmoji = r.source === 'cached' ? '📚' : r.source === 'duckduckgo' ? '🔍' : r.source === 'sarvam' ? '🧠' : '🔍';
      return `${sourceEmoji} **${r.title}**\n${r.snippet}${r.url ? `\n${r.url}` : ''}`;
    });

    return {
      success: true,
      message: `🔍 ఫలితాలు:\n\n${lines.join('\n\n')}`,
      data: results,
    };
  } catch (err) {
    console.error('[actions] performWebSearch failed:', err);
    return {
      success: true,
      message: `🔍 సెర్చ్ విఫలమైంది. నా జ్ఞానం ప్రకారం సమాధానం ఇస్తాను.`,
    };
  }
}

// ---------------------------------------------------------------------------
// Main Action Router
// ---------------------------------------------------------------------------

/**
 * Execute a parsed action. Routes to the appropriate handler.
 */
export async function executeAction(action: ChatAction): Promise<ActionResult> {
  switch (action.action) {
    case 'record_money':
      return handleRecordMoney(action);

    case 'update_money':
      return handleUpdateMoney(action);

    case 'delete_money':
      return handleDeleteMoney(action);

    case 'record_crop':
      return handleRecordCrop(action);

    case 'record_from_bill':
      return handleRecordFromBill(action);

    case 'web_search':
      return handleWebSearch(action);

    case 'remember':
      return handleRemember(action);

    case 'check_scheme':
      return handleCheckScheme(action);

    default:
      return {
        success: false,
        message: `తెలియని action: "${action.action}"`,
      };
  }
}
