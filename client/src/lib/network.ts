/**
 * Network status utilities for Rythu Mitra.
 *
 * Provides reactive network monitoring and offline detection
 * for graceful degradation of AI features.
 */

import { writable } from 'svelte/store';

// ---------------------------------------------------------------------------
// Reactive online store
// ---------------------------------------------------------------------------

/**
 * Svelte store that tracks navigator.onLine reactively.
 * Components can subscribe: $online ? 'connected' : 'offline'
 */
export const online = writable<boolean>(
  typeof navigator !== 'undefined' ? navigator.onLine : true,
);

// Set up event listeners (safe for SSR — checks typeof window)
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => online.set(true));
  window.addEventListener('offline', () => online.set(false));
}

// ---------------------------------------------------------------------------
// Imperative helpers
// ---------------------------------------------------------------------------

/**
 * Check if the browser is currently online.
 * Use this in async functions before making API calls.
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Register a callback for network status changes.
 * Returns an unsubscribe function.
 *
 * @example
 * const unsub = onNetworkChange((isOnline) => {
 *   if (!isOnline) showToast('ఆఫ్‌లైన్ మోడ్', 'warning');
 * });
 */
export function onNetworkChange(
  callback: (isOnline: boolean) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
