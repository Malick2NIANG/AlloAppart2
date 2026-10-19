'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import BottomSheet from './BottomSheet';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'default',
}: ConfirmModalProps) {
  const t       = useTranslations('modal');
  const [loading, setLoading] = useState(false);
  const titleId = useId();

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const resolvedConfirmLabel = confirmLabel ?? t('confirm');
  const resolvedCancelLabel  = cancelLabel  ?? t('cancel');

  return (
    <BottomSheet open={open} onClose={onClose} titleId={titleId}>
      {variant === 'danger' && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
          <i className="fa-solid fa-triangle-exclamation text-lg text-red-600 dark:text-red-400" />
        </div>
      )}
      <h2 id={titleId} className="mb-1 text-base font-semibold text-text">{title}</h2>
      {description && <p className="text-sm text-sub">{description}</p>}
      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-sub transition-colors hover:text-text disabled:opacity-50"
        >
          {resolvedCancelLabel}
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
            <><i className="fa-solid fa-spinner fa-spin mr-1.5" />{resolvedConfirmLabel}</>
          ) : resolvedConfirmLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
