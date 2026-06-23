'use client';

import { createContext, useContext } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ToastContextValue {
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return {
    toast: {
      success: (message: string) => ctx.addToast('success', message),
      error:   (message: string) => ctx.addToast('error',   message),
      info:    (message: string) => ctx.addToast('info',    message),
    },
  };
}
