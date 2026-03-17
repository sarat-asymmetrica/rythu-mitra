/**
 * Toast store for Rythu Mitra.
 * Callable from ANY component via: import { showToast } from '../lib/toast';
 */
import { writable } from 'svelte/store';

export interface ToastItem {
  id: number;
  message: string;
  type: 'default' | 'warning' | 'alert';
  floating: boolean;
}

export const toasts = writable<ToastItem[]>([]);

let nextId = 0;

export function showToast(
  message: string,
  type: 'default' | 'warning' | 'alert' = 'default',
  duration: number = 4000,
) {
  const id = nextId++;
  const toast: ToastItem = { id, message, type, floating: false };
  toasts.update((t) => [...t, toast]);

  // Switch to floating bob after entry animation (610ms)
  setTimeout(() => {
    toasts.update((t) => t.map((item) => (item.id === id ? { ...item, floating: true } : item)));
  }, 610);

  // Auto-dismiss
  const dismissAt = Math.max(duration, 710);
  setTimeout(() => {
    toasts.update((t) => t.filter((item) => item.id !== id));
  }, dismissAt);
}

export function dismissToast(id: number) {
  toasts.update((t) => t.filter((item) => item.id !== id));
}
