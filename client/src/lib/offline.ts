/**
 * Rythu Mitra -- Offline Action Queue
 *
 * When STDB is disconnected, money/crop events recorded via voice or manual
 * entry go to localMoneyEvents but are never synced back to STDB. This module
 * provides a durable localStorage-backed queue that replays actions once the
 * connection is restored.
 *
 * Queue lifecycle:
 *   1. enqueueAction()   -- add an action to the queue
 *   2. STDB reconnects   -- setupAutoReplay() triggers replayQueue()
 *   3. replayQueue()     -- processes actions in FIFO order via the DbConnection
 *   4. On success        -- dequeueAction() removes the action
 *   5. On failure        -- retries incremented, action stays (max 5 retries)
 *   6. Dead-letter       -- after 5 failures, action moved to dead letter key
 */

import type { DbConnection } from '../module_bindings';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUEUE_KEY = 'rythu_mitra_offline_queue';
const DEAD_LETTER_KEY = 'rythu_mitra_offline_dead_letter';
const MAX_RETRIES = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueuedAction {
  id: string;
  action: string;           // 'record_money' | 'record_crop' | etc.
  payload: Record<string, unknown>;
  createdAt: number;        // Date.now() timestamp
  retries: number;
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/**
 * Generate a unique ID for a queued action.
 * Format: "offline_<timestamp>_<4-random-hex>"
 */
function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `offline_${ts}_${rand}`;
}

// ---------------------------------------------------------------------------
// Queue persistence helpers
// ---------------------------------------------------------------------------

function readQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as QueuedAction[];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedAction[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

function readDeadLetter(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(DEAD_LETTER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as QueuedAction[];
  } catch {
    return [];
  }
}

function writeDeadLetter(items: QueuedAction[]): void {
  try {
    localStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(items));
  } catch {
    // Silently fail
  }
}

// ---------------------------------------------------------------------------
// Public queue management API
// ---------------------------------------------------------------------------

/**
 * Add an action to the offline queue.
 * The action will be replayed (in order) when STDB reconnects.
 *
 * @param action   Action type string, e.g. 'record_money' or 'record_crop'
 * @param payload  Arbitrary data needed to replay the action
 */
export function enqueueAction(action: string, payload: Record<string, unknown>): void {
  const queue = readQueue();
  const item: QueuedAction = {
    id: generateId(),
    action,
    payload,
    createdAt: Date.now(),
    retries: 0,
  };
  queue.push(item);
  writeQueue(queue);
}

/**
 * Remove a specific action from the queue by ID.
 * Called after a successful replay.
 *
 * @param id  The QueuedAction.id to remove
 */
export function dequeueAction(id: string): void {
  const queue = readQueue().filter(item => item.id !== id);
  writeQueue(queue);
}

/**
 * Return all pending queued actions in FIFO order (oldest first).
 */
export function getQueuedActions(): QueuedAction[] {
  return readQueue().slice().sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Return the number of pending actions in the queue.
 */
export function getQueueSize(): number {
  return readQueue().length;
}

/**
 * Return all dead-lettered actions (exceeded MAX_RETRIES).
 */
export function getDeadLetterActions(): QueuedAction[] {
  return readDeadLetter();
}

/**
 * Clear the entire offline queue. Useful for testing or a full data reset.
 */
export function clearQueue(): void {
  writeQueue([]);
}

/**
 * Clear the dead letter store.
 */
export function clearDeadLetter(): void {
  writeDeadLetter([]);
}

// ---------------------------------------------------------------------------
// Action dispatchers
// ---------------------------------------------------------------------------

/**
 * Dispatch a single queued action against the live DbConnection.
 *
 * Supported actions:
 *   - record_money: calls conn.reducers.recordMoneyEvent(...)
 *   - record_crop:  calls conn.reducers.recordCropEvent(...)
 *
 * Returns true on success, false on failure.
 */
async function dispatchAction(action: QueuedAction, conn: DbConnection): Promise<boolean> {
  try {
    switch (action.action) {
      case 'record_money': {
        const p = action.payload as {
          farmerId?: string;
          amountPaise?: number;
          isIncome?: boolean;
          kind?: string;
          category?: string;
          description?: string;
        };
        await conn.reducers.recordMoneyEvent(
          p.farmerId ?? '',
          BigInt(p.amountPaise ?? 0),
          p.isIncome ?? false,
          p.kind ?? 'Other',
          p.category ?? '',
          p.description ?? '',
        );
        return true;
      }
      case 'record_crop': {
        const p = action.payload as {
          farmerId?: string;
          fieldId?: string;
          kind?: string;
          title?: string;
          body?: string;
          date?: string;
        };
        await conn.reducers.recordCropEvent(
          p.farmerId ?? '',
          p.fieldId ?? '',
          p.kind ?? 'Other',
          p.title ?? '',
          p.body ?? '',
          p.date ?? new Date().toISOString().slice(0, 10),
        );
        return true;
      }
      default:
        // Unknown action type — treat as permanent failure, move to dead letter
        return false;
    }
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Replay engine
// ---------------------------------------------------------------------------

/**
 * Replay all queued actions against a live STDB connection.
 *
 * Processes actions in FIFO order. For each action:
 *   - Success: removes from queue
 *   - Failure: increments retries
 *     - If retries < MAX_RETRIES: stays in queue for next reconnect
 *     - If retries >= MAX_RETRIES: moved to dead letter queue
 *
 * @param conn  A live DbConnection instance
 * @returns Object with succeeded, failed, and remaining counts
 */
export async function replayQueue(conn: DbConnection): Promise<{
  succeeded: number;
  failed: number;
  remaining: number;
}> {
  const actions = getQueuedActions();
  let succeeded = 0;
  let failed = 0;

  for (const action of actions) {
    const ok = await dispatchAction(action, conn);

    if (ok) {
      dequeueAction(action.id);
      succeeded++;
    } else {
      const updatedRetries = action.retries + 1;

      if (updatedRetries >= MAX_RETRIES) {
        // Move to dead letter — this action has exhausted its retries
        dequeueAction(action.id);
        const dl = readDeadLetter();
        dl.push({ ...action, retries: updatedRetries });
        writeDeadLetter(dl);
      } else {
        // Increment retry count and keep in queue
        const queue = readQueue().map(item =>
          item.id === action.id
            ? { ...item, retries: updatedRetries }
            : item,
        );
        writeQueue(queue);
      }
      failed++;
    }
  }

  const remaining = getQueueSize();
  return { succeeded, failed, remaining };
}

// ---------------------------------------------------------------------------
// Auto-replay setup
// ---------------------------------------------------------------------------

/**
 * Set up automatic queue replay on STDB reconnect.
 *
 * Call this once from db.ts after the DbConnection is created.
 * It registers a listener on the connection's onConnect event
 * and replays the queue whenever the connection is (re)established.
 *
 * If no queued actions exist, the replay is skipped for efficiency.
 *
 * @param conn  The DbConnection instance from db.ts
 */
export function setupAutoReplay(conn: DbConnection): void {
  conn.onConnect((_conn, _identity, _token) => {
    if (getQueueSize() === 0) return;
    // Fire-and-forget — replay errors are handled internally
    void replayQueue(conn).then(({ succeeded, remaining }) => {
      if (succeeded > 0 || remaining === 0) {
        // Could emit a custom event here for UI notification
        window.dispatchEvent(
          new CustomEvent('offline-queue-replayed', {
            detail: { succeeded, remaining },
          }),
        );
      }
    });
  });
}
