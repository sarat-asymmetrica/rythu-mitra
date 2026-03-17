/**
 * Tests for offline.ts -- Offline Action Queue
 *
 * Tests cover:
 *   - Enqueue/dequeue lifecycle
 *   - Queue persists in localStorage
 *   - Queue size tracking
 *   - FIFO order verification
 *   - Max retry limit (5 retries → dead letter)
 *   - getQueuedActions returns correct order
 *   - replayQueue success/failure paths
 *   - Dead letter accumulation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enqueueAction,
  dequeueAction,
  getQueuedActions,
  getQueueSize,
  getDeadLetterActions,
  clearQueue,
  clearDeadLetter,
  replayQueue,
  type QueuedAction,
} from './offline';

// ---------------------------------------------------------------------------
// localStorage mock (jsdom provides one; reset between tests)
// ---------------------------------------------------------------------------

const QUEUE_KEY = 'rythu_mitra_offline_queue';
const DEAD_LETTER_KEY = 'rythu_mitra_offline_dead_letter';

beforeEach(() => {
  localStorage.clear();
  clearQueue();
  clearDeadLetter();
});

// ---------------------------------------------------------------------------
// Enqueue / dequeue lifecycle
// ---------------------------------------------------------------------------

describe('enqueueAction', () => {
  it('adds an action to the queue', () => {
    enqueueAction('record_money', { amountPaise: 100000 });
    expect(getQueueSize()).toBe(1);
  });

  it('assigns a unique id to each action', () => {
    enqueueAction('record_money', { amountPaise: 1000 });
    enqueueAction('record_money', { amountPaise: 2000 });
    const actions = getQueuedActions();
    expect(actions[0].id).not.toBe(actions[1].id);
  });

  it('stores the action type correctly', () => {
    enqueueAction('record_crop', { kind: 'sowing' });
    const actions = getQueuedActions();
    expect(actions[0].action).toBe('record_crop');
  });

  it('stores the payload correctly', () => {
    const payload = { farmerId: 'farmer-1', amountPaise: 50000, isIncome: true };
    enqueueAction('record_money', payload);
    const actions = getQueuedActions();
    expect(actions[0].payload).toEqual(payload);
  });

  it('sets initial retries to 0', () => {
    enqueueAction('record_money', {});
    const actions = getQueuedActions();
    expect(actions[0].retries).toBe(0);
  });

  it('sets createdAt as a recent timestamp', () => {
    const before = Date.now();
    enqueueAction('record_money', {});
    const after = Date.now();
    const actions = getQueuedActions();
    expect(actions[0].createdAt).toBeGreaterThanOrEqual(before);
    expect(actions[0].createdAt).toBeLessThanOrEqual(after);
  });
});

describe('dequeueAction', () => {
  it('removes the action by id', () => {
    enqueueAction('record_money', { amountPaise: 100 });
    const actions = getQueuedActions();
    const id = actions[0].id;
    dequeueAction(id);
    expect(getQueueSize()).toBe(0);
  });

  it('only removes the targeted action', () => {
    enqueueAction('record_money', { amountPaise: 100 });
    enqueueAction('record_money', { amountPaise: 200 });
    const actions = getQueuedActions();
    dequeueAction(actions[0].id);
    expect(getQueueSize()).toBe(1);
    expect(getQueuedActions()[0].payload).toEqual({ amountPaise: 200 });
  });

  it('is a no-op for unknown id', () => {
    enqueueAction('record_money', {});
    dequeueAction('nonexistent-id');
    expect(getQueueSize()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Queue persists in localStorage
// ---------------------------------------------------------------------------

describe('localStorage persistence', () => {
  it('queue survives a "page reload" (read from localStorage directly)', () => {
    enqueueAction('record_money', { amountPaise: 999 });

    // Simulate reload: read queue key directly, then re-import actions
    const raw = localStorage.getItem(QUEUE_KEY);
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw!) as QueuedAction[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0].action).toBe('record_money');
  });

  it('getQueuedActions reads persisted data correctly', () => {
    const items: QueuedAction[] = [
      { id: 'test-1', action: 'record_crop', payload: { crop: 'groundnut' }, createdAt: 1000, retries: 0 },
      { id: 'test-2', action: 'record_money', payload: { amountPaise: 500 }, createdAt: 2000, retries: 1 },
    ];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));

    const actions = getQueuedActions();
    expect(actions).toHaveLength(2);
    expect(actions[0].id).toBe('test-1');
  });

  it('handles corrupted localStorage gracefully (returns empty)', () => {
    localStorage.setItem(QUEUE_KEY, 'NOT_VALID_JSON{{{');
    expect(() => getQueuedActions()).not.toThrow();
    expect(getQueuedActions()).toEqual([]);
  });

  it('handles non-array localStorage data gracefully', () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify({ not: 'an array' }));
    expect(getQueuedActions()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Queue size tracking
// ---------------------------------------------------------------------------

describe('getQueueSize', () => {
  it('returns 0 on empty queue', () => {
    expect(getQueueSize()).toBe(0);
  });

  it('returns correct count after multiple enqueues', () => {
    enqueueAction('record_money', {});
    enqueueAction('record_money', {});
    enqueueAction('record_crop', {});
    expect(getQueueSize()).toBe(3);
  });

  it('decrements after dequeue', () => {
    enqueueAction('record_money', {});
    enqueueAction('record_money', {});
    const id = getQueuedActions()[0].id;
    dequeueAction(id);
    expect(getQueueSize()).toBe(1);
  });

  it('returns 0 after clearQueue', () => {
    enqueueAction('record_money', {});
    enqueueAction('record_money', {});
    clearQueue();
    expect(getQueueSize()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// FIFO order verification
// ---------------------------------------------------------------------------

describe('FIFO order', () => {
  it('getQueuedActions returns items in creation order (oldest first)', () => {
    // Manually insert with specific createdAt timestamps to guarantee order
    const items: QueuedAction[] = [
      { id: 'a', action: 'record_money', payload: { seq: 1 }, createdAt: 1000, retries: 0 },
      { id: 'b', action: 'record_money', payload: { seq: 2 }, createdAt: 2000, retries: 0 },
      { id: 'c', action: 'record_money', payload: { seq: 3 }, createdAt: 3000, retries: 0 },
    ];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));

    const actions = getQueuedActions();
    expect(actions[0].id).toBe('a');
    expect(actions[1].id).toBe('b');
    expect(actions[2].id).toBe('c');
  });

  it('unordered storage is still returned in FIFO order', () => {
    // Items stored in reverse order in localStorage
    const items: QueuedAction[] = [
      { id: 'c', action: 'record_money', payload: {}, createdAt: 3000, retries: 0 },
      { id: 'a', action: 'record_money', payload: {}, createdAt: 1000, retries: 0 },
      { id: 'b', action: 'record_money', payload: {}, createdAt: 2000, retries: 0 },
    ];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));

    const ordered = getQueuedActions();
    expect(ordered[0].id).toBe('a');
    expect(ordered[1].id).toBe('b');
    expect(ordered[2].id).toBe('c');
  });
});

// ---------------------------------------------------------------------------
// Max retry limit
// ---------------------------------------------------------------------------

describe('max retry limit', () => {
  it('moves action to dead letter after MAX_RETRIES failures', async () => {
    enqueueAction('record_money', { amountPaise: 500 });

    // Mock conn that always fails
    const mockConn = makeMockConn({ alwaysFail: true });

    // Replay 5 times (each time the one action fails and increments retries)
    // After the 5th failure, the action should be dead-lettered
    for (let i = 0; i < 5; i++) {
      await replayQueue(mockConn);
    }

    expect(getQueueSize()).toBe(0);
    const dl = getDeadLetterActions();
    expect(dl).toHaveLength(1);
    expect(dl[0].retries).toBe(5);
  });

  it('retries incremented correctly on each failure (stays in queue before max)', async () => {
    enqueueAction('record_money', { amountPaise: 200 });
    const mockConn = makeMockConn({ alwaysFail: true });

    // After 1st replay: retries should be 1
    await replayQueue(mockConn);
    const actions1 = getQueuedActions();
    expect(actions1[0].retries).toBe(1);

    // After 2nd replay: retries should be 2
    await replayQueue(mockConn);
    const actions2 = getQueuedActions();
    expect(actions2[0].retries).toBe(2);
  });

  it('action stays in queue until MAX_RETRIES is reached', async () => {
    enqueueAction('record_money', { amountPaise: 100 });
    const mockConn = makeMockConn({ alwaysFail: true });

    // Replay 4 times — should still be in queue (not yet dead-lettered)
    for (let i = 0; i < 4; i++) {
      await replayQueue(mockConn);
    }
    expect(getQueueSize()).toBe(1);
    expect(getDeadLetterActions()).toHaveLength(0);

    // 5th replay — dead-lettered
    await replayQueue(mockConn);
    expect(getQueueSize()).toBe(0);
    expect(getDeadLetterActions()).toHaveLength(1);
  });

  it('successful replay removes action before retry limit', async () => {
    enqueueAction('record_money', { amountPaise: 100 });
    const mockConn = makeMockConn({ alwaysFail: false });

    const result = await replayQueue(mockConn);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(getQueueSize()).toBe(0);
    expect(getDeadLetterActions()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// replayQueue result tracking
// ---------------------------------------------------------------------------

describe('replayQueue', () => {
  it('returns correct succeeded/failed/remaining counts', async () => {
    enqueueAction('record_money', { amountPaise: 100 });
    enqueueAction('record_money', { amountPaise: 200 });

    let callCount = 0;
    const mockConn = makeMockConnWithCallback(async () => {
      callCount++;
      return callCount === 1; // first succeeds, second fails
    });

    const result = await replayQueue(mockConn);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.remaining).toBe(1);
  });

  it('returns 0/0/0 for empty queue', async () => {
    const mockConn = makeMockConn({ alwaysFail: false });
    const result = await replayQueue(mockConn);
    expect(result).toEqual({ succeeded: 0, failed: 0, remaining: 0 });
  });

  it('replays all actions in FIFO order', async () => {
    const callOrder: number[] = [];

    const items: QueuedAction[] = [
      { id: 'first',  action: 'record_money', payload: { seq: 1 }, createdAt: 1000, retries: 0 },
      { id: 'second', action: 'record_money', payload: { seq: 2 }, createdAt: 2000, retries: 0 },
    ];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));

    const mockConn = makeMockConnWithCallback(async (action: QueuedAction) => {
      callOrder.push(action.payload.seq as number);
      return true;
    });

    await replayQueue(mockConn);
    expect(callOrder).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// Mock connection factory helpers
// ---------------------------------------------------------------------------

function makeMockConn(options: { alwaysFail: boolean }) {
  return {
    reducers: {
      recordMoneyEvent: vi.fn(async () => {
        if (options.alwaysFail) throw new Error('Mock connection failure');
      }),
      recordCropEvent: vi.fn(async () => {
        if (options.alwaysFail) throw new Error('Mock connection failure');
      }),
    },
    onConnect: vi.fn(),
  } as unknown as DbConnection;
}

type DispatchCallback = (action: QueuedAction) => Promise<boolean>;

function makeMockConnWithCallback(callback: DispatchCallback) {
  return {
    reducers: {
      recordMoneyEvent: vi.fn(async (..._args: unknown[]) => {
        // We need to resolve which action is being replayed
        // The callback is called per dispatch attempt
        const allActions = getQueuedActions();
        // Find the action currently being dispatched (lowest createdAt not yet succeeded)
        const ok = await callback(allActions[0] ?? { payload: {} } as QueuedAction);
        if (!ok) throw new Error('Callback said fail');
      }),
      recordCropEvent: vi.fn(async () => {
        // For simplicity, always succeed for crop events in this mock
      }),
    },
    onConnect: vi.fn(),
  } as unknown as DbConnection;
}
