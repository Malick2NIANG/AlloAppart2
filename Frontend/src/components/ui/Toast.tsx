'use client';

import { createContext, useContext } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ToastContextValue {
  // `durationMs` optionnel : surcharge la durée d'affichage par défaut
  // (voir AUTO_DISMISS_MS dans ToastProvider) pour ce toast précis.
  addToast: (type: ToastType, message: string, durationMs?: number) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return {
    toast: {
      success: (message: string, durationMs?: number) => ctx.addToast('success', message, durationMs),
      error:   (message: string, durationMs?: number) => ctx.addToast('error',   message, durationMs),
      info:    (message: string, durationMs?: number) => ctx.addToast('info',    message, durationMs),
    },
  };
}
