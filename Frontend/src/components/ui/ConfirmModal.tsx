'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: 'danger' | 'default';
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmer',
  variant = 'default',
}: ConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {variant === 'danger' && (
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <i className="fa-solid fa-triangle-exclamation text-lg text-red-600" />
              </div>
            )}
            <h2 className="mb-1 text-base font-semibold text-text">{title}</h2>
            {description && <p className="text-sm text-sub">{description}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-sub transition-colors hover:text-text disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={loading}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                  variant === 'danger'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gold-dark text-white hover:bg-gold'
                }`}
              >
                {loading ? (
                  <><i className="fa-solid fa-spinner fa-spin mr-1.5" />{confirmLabel}</>
                ) : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
