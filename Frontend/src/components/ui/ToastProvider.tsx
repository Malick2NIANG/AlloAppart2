'use client';

import { useState, useCallback, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ToastContext, type ToastItem, type ToastType } from './Toast';

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 4000;

const ICONS: Record<ToastType, string> = {
  success: 'fa-solid fa-circle-check',
  error:   'fa-solid fa-circle-xmark',
  info:    'fa-solid fa-circle-info',
};

const COLORS: Record<ToastType, string> = {
  success: 'text-emerald-500',
  error:   'text-red-500',
  info:    'text-blue-500',
};

function ToastItem({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ duration: 0.22 }}
      className="flex items-start gap-3 rounded-xl border border-line bg-card px-4 py-3 shadow-lg"
    >
      <i className={`${ICONS[item.type]} ${COLORS[item.type]} mt-0.5 text-base shrink-0`} />
      <p className="flex-1 text-sm text-text leading-snug">{item.message}</p>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="ml-1 text-sub hover:text-text transition-colors"
        aria-label="Fermer"
      >
        <i className="fa-solid fa-xmark text-xs" />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const baseId = useId();
  let counter = 0;

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${baseId}-${Date.now()}-${counter++}`;
    setToasts((prev) => {
      const next = [...prev, { id, type, message }];
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
    setTimeout(() => removeToast(id), AUTO_DISMISS_MS);
  }, [baseId, removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div
        className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 w-80 max-w-[calc(100vw-2.5rem)]"
        aria-live="polite"
      >
        <AnimatePresence initial={false} mode="sync">
          {toasts.map((item) => (
            <ToastItem key={item.id} item={item} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
