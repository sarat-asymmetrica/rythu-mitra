/**
 * Persistent Memory System for Rythu Mitra.
 *
 * Stores AI observations, farmer-stated facts, and detected patterns
 * in localStorage. When STDB farmer_memory table is available, syncs there.
 *
 * Memory is injected into the system prompt so the AI "remembers" across conversations.
 *
 * Guidelines (from F014 spec):
 *   - Store observations useful in FUTURE conversations
 *   - DO NOT store every transaction (money_events handles that)
 *   - DO store: preferences, patterns, relationships, plans, concerns, deadlines
 *   - Max ~30 active memories; oldest low-confidence auto-pruned
 */

import type { MoneyEvent } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FarmerMemory {
  id: number;
  content: string;
  source: 'ai_observed' | 'farmer_stated' | 'pattern_detected';
  confidence: number;  // 0.0 to 1.0
  active: boolean;
  createdAt: string;   // ISO string
  lastUsedAt: string;  // ISO string
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const MEMORY_KEY = 'rythu_mitra_memories';
const MAX_ACTIVE = 30;

let nextId = 1;

function initNextId(memories: FarmerMemory[]): void {
  if (memories.length > 0) {
    nextId = Math.max(...memories.map(m => m.id)) + 1;
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Load all memories from localStorage. */
export function loadMemories(): FarmerMemory[] {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return [];
    const memories = JSON.parse(raw) as FarmerMemory[];
    initNextId(memories);
    return memories;
  } catch {
    return [];
  }
}

/** Persist memories array to localStorage. */
function persistMemories(memories: FarmerMemory[]): void {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(memories));
}

/** Save a new memory. Auto-prunes if over limit. Returns the new memory. */
export function saveMemory(
  content: string,
  source: FarmerMemory['source'],
  confidence: number,
): FarmerMemory {
  const memories = loadMemories();
  const now = new Date().toISOString();

  // Check for duplicate content (fuzzy: same first 50 chars)
  const prefix = content.slice(0, 50).toLowerCase();
  const existing = memories.find(
    m => m.active && m.content.slice(0, 50).toLowerCase() === prefix
  );
  if (existing) {
    // Update existing instead of creating duplicate
    existing.confidence = Math.max(existing.confidence, confidence);
    existing.lastUsedAt = now;
    existing.content = content; // Update to latest wording
    persistMemories(memories);
    return existing;
  }

  const memory: FarmerMemory = {
    id: nextId++,
    content,
    source,
    confidence: Math.max(0, Math.min(1, confidence)),
    active: true,
    createdAt: now,
    lastUsedAt: now,
  };

  memories.push(memory);

  // Auto-prune if over limit
  pruneMemoriesInPlace(memories);

  persistMemories(memories);
  return memory;
}

/** Soft-delete: set active=false. Farmer can see dismissed memories in Settings. */
export function dismissMemory(id: number): void {
  const memories = loadMemories();
  const memory = memories.find(m => m.id === id);
  if (memory) {
    memory.active = false;
    persistMemories(memories);
  }
}

/** Restore a dismissed memory. */
export function restoreMemory(id: number): void {
  const memories = loadMemories();
  const memory = memories.find(m => m.id === id);
  if (memory) {
    memory.active = true;
    memory.lastUsedAt = new Date().toISOString();
    persistMemories(memories);
  }
}

/** Get only active memories, sorted by lastUsedAt descending. */
export function getActiveMemories(): FarmerMemory[] {
  return loadMemories()
    .filter(m => m.active)
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
}

/** Get dismissed memories. */
export function getDismissedMemories(): FarmerMemory[] {
  return loadMemories()
    .filter(m => !m.active)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Mark a memory as "used" (updates lastUsedAt). Call when memory appears in prompt. */
export function touchMemory(id: number): void {
  const memories = loadMemories();
  const memory = memories.find(m => m.id === id);
  if (memory) {
    memory.lastUsedAt = new Date().toISOString();
    persistMemories(memories);
  }
}

// ---------------------------------------------------------------------------
// Pruning
// ---------------------------------------------------------------------------

/** Remove oldest low-confidence memories when over MAX_ACTIVE. In-place mutation. */
function pruneMemoriesInPlace(memories: FarmerMemory[]): void {
  const active = memories.filter(m => m.active);
  if (active.length <= MAX_ACTIVE) return;

  // Sort active by: confidence ASC, then lastUsedAt ASC (oldest least-confident first)
  const toRemove = [...active]
    .sort((a, b) => {
      if (a.confidence !== b.confidence) return a.confidence - b.confidence;
      return a.lastUsedAt.localeCompare(b.lastUsedAt);
    })
    .slice(0, active.length - MAX_ACTIVE);

  for (const mem of toRemove) {
    mem.active = false; // Soft-delete, not hard delete
  }
}

/** Explicit prune call (run periodically or on app start). */
export function pruneMemories(): void {
  const memories = loadMemories();
  pruneMemoriesInPlace(memories);
  persistMemories(memories);
}

// ---------------------------------------------------------------------------
// Pattern Detection
// ---------------------------------------------------------------------------

/**
 * Analyze money events to detect spending patterns.
 * Returns human-readable pattern strings (Telugu/English mix).
 * Each pattern becomes a memory if not already stored.
 */
export function detectPatterns(events: MoneyEvent[]): string[] {
  const patterns: string[] = [];
  if (events.length < 3) return patterns;

  // Pattern 1: Day-of-week spending spikes
  const dayTotals = new Map<number, { count: number; total: number }>();
  for (const e of events) {
    if (e.amount >= 0) continue; // Only expenses
    const day = new Date(e.date).getDay();
    const existing = dayTotals.get(day) || { count: 0, total: 0 };
    existing.count++;
    existing.total += Math.abs(e.amount);
    dayTotals.set(day, existing);
  }

  const dayNames = ['ఆదివారం', 'సోమవారం', 'మంగళవారం', 'బుధవారం', 'గురువారం', 'శుక్రవారం', 'శనివారం'];
  const avgPerDay = Array.from(dayTotals.entries()).map(([day, data]) => ({
    day,
    avg: data.count > 0 ? data.total / data.count : 0,
    count: data.count,
  }));

  const overallAvg = avgPerDay.reduce((s, d) => s + d.avg, 0) / Math.max(avgPerDay.length, 1);
  for (const d of avgPerDay) {
    if (d.count >= 2 && d.avg > overallAvg * 1.5) {
      patterns.push(`${dayNames[d.day]} రోజు ఖర్చులు ఎక్కువగా ఉంటాయి`);
    }
  }

  // Pattern 2: Category spending trends (month-over-month)
  const now = new Date();
  const thisMonth = events.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && e.amount < 0;
  });
  const lastMonth = events.filter(e => {
    const d = new Date(e.date);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear() && e.amount < 0;
  });

  const byCategoryThis = new Map<string, number>();
  const byCategoryLast = new Map<string, number>();
  for (const e of thisMonth) {
    byCategoryThis.set(e.kind, (byCategoryThis.get(e.kind) || 0) + Math.abs(e.amount));
  }
  for (const e of lastMonth) {
    byCategoryLast.set(e.kind, (byCategoryLast.get(e.kind) || 0) + Math.abs(e.amount));
  }

  const kindLabels: Record<string, string> = {
    labor: 'కూలి', seeds: 'విత్తనాలు', fertilizer: 'ఎరువులు',
    irrigation: 'నీటిపారుదల', transport: 'రవాణా', other: 'ఇతర',
  };

  for (const [kind, thisAmt] of byCategoryThis) {
    const lastAmt = byCategoryLast.get(kind) || 0;
    if (lastAmt > 0 && thisAmt > lastAmt * 1.3) {
      const pct = Math.round(((thisAmt - lastAmt) / lastAmt) * 100);
      const label = kindLabels[kind] || kind;
      patterns.push(`${label} ఖర్చు గత నెల కంటే ${pct}% ఎక్కువ`);
    }
  }

  // Pattern 3: Repeated party transactions
  const partyCount = new Map<string, number>();
  for (const e of events) {
    if (e.kind === 'crop_sale' && e.description) {
      // Simple heuristic: look for trader names in description
      const desc = e.description;
      partyCount.set(desc, (partyCount.get(desc) || 0) + 1);
    }
  }

  return patterns;
}

/**
 * Run pattern detection and auto-save new patterns as memories.
 * Returns count of new memories created.
 */
export function detectAndSavePatterns(events: MoneyEvent[]): number {
  const patterns = detectPatterns(events);
  const existing = getActiveMemories();
  let created = 0;

  for (const pattern of patterns) {
    // Check if similar memory already exists
    const alreadyKnown = existing.some(
      m => m.content.includes(pattern.slice(0, 20))
    );
    if (!alreadyKnown) {
      saveMemory(pattern, 'pattern_detected', 0.6);
      created++;
    }
  }

  return created;
}
