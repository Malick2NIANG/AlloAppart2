'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

const REASON_VALUES = [
  { value: 'FRAUD',          icon: 'fa-triangle-exclamation' },
  { value: 'WRONG_PRICE',    icon: 'fa-tag'                  },
  { value: 'WRONG_PHOTOS',   icon: 'fa-image'                },
  { value: 'ALREADY_RENTED', icon: 'fa-lock'                 },
  { value: 'WRONG_LOCATION', icon: 'fa-location-dot'         },
  { value: 'OFFENSIVE',      icon: 'fa-ban'                  },
  { value: 'OTHER',          icon: 'fa-ellipsis'             },
] as const;

type ReasonValue = typeof REASON_VALUES[number]['value'];

interface Props {
  listingId: string;
  onClose: () => void;
}

export default function ReportModal({ listingId, onClose }: Props) {
  const { isSignedIn, getToken } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const t = useTranslations('report');

  const [step,        setStep]        = useState<'form' | 'confirm' | 'done'>('form');
  const [reason,      setReason]      = useState<ReasonValue | null>(null);
  const [description, setDescription] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const REASONS = useMemo(() => [
    { value: 'FRAUD'          as const, label: t('reasonFraud'),         icon: 'fa-triangle-exclamation' },
    { value: 'WRONG_PRICE'    as const, label: t('reasonWrongPrice'),     icon: 'fa-tag'                  },
    { value: 'WRONG_PHOTOS'   as const, label: t('reasonWrongPhotos'),    icon: 'fa-image'                },
    { value: 'ALREADY_RENTED' as const, label: t('reasonAlreadyRented'),  icon: 'fa-lock'                 },
    { value: 'WRONG_LOCATION' as const, label: t('reasonWrongLocation'),  icon: 'fa-location-dot'         },
    { value: 'OFFENSIVE'      as const, label: t('reasonOffensive'),      icon: 'fa-ban'                  },
    { value: 'OTHER'          as const, label: t('reasonOther'),          icon: 'fa-ellipsis'             },
  ], [t]);

  if (!isSignedIn) {
    return (
      <Backdrop onClose={onClose}>
        <div className="w-full max-w-md rounded-2xl bg-card border border-line p-6 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-text flex items-center gap-2">
            <i className="fa-regular fa-flag text-gold-dark" />
            {t('title')}
          </h2>
          <p className="text-sm text-sub">{t('signInRequired')}</p>
          <button
            onClick={() => router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`)}
            className="btn-gold w-full text-sm"
          >
            <i className="fa-solid fa-arrow-right-to-bracket mr-1.5" />
            {t('signIn')}
          </button>
        </div>
      </Backdrop>
    );
  }

  if (step === 'done') {
    return (
      <Backdrop onClose={onClose}>
        <div className="w-full max-w-md rounded-2xl bg-card border border-line p-6 shadow-xl space-y-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 mx-auto">
            <i className="fa-solid fa-check text-emerald-600 text-xl" />
          </div>
          <h2 className="text-base font-bold text-text">{t('doneThanks')}</h2>
          <p className="text-sm text-sub">{t('doneDesc')}</p>
          <button onClick={onClose} className="btn-gold w-full text-sm">{t('closeBtn')}</button>
        </div>
      </Backdrop>
    );
  }

  if (step === 'confirm') {
    const selectedReason = REASONS.find((r) => r.value === reason);
    return (
      <Backdrop onClose={onClose}>
        <div className="w-full max-w-md rounded-2xl bg-card border border-line p-6 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-text flex items-center gap-2">
            <i className="fa-regular fa-flag text-red-500" />
            {t('confirmTitle')}
          </h2>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-1">
            <p className="font-semibold">{t('confirmMotive')} : {selectedReason?.label}</p>
            {description && <p className="text-amber-700 text-xs">{description}</p>}
          </div>
          <p className="text-xs text-sub">{t('confirmWarning')}</p>
          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-exclamation" />{error}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setStep('form')}
              className="flex-1 rounded-xl border border-line bg-card px-4 py-2 text-sm font-medium text-sub hover:text-text transition"
            >
              {t('confirmModify')}
            </button>
            <button
              onClick={async () => {
                if (!reason) return;
                setSaving(true);
                setError(null);
                try {
                  const token = await getToken();
                  await api.post(`/listings/${listingId}/report`, { reason, description: description.trim() || undefined }, token ?? undefined);
                  setStep('done');
                } catch {
                  setError(t('error'));
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            >
              {saving
                ? <><i className="fa-solid fa-spinner fa-spin mr-1.5" />{t('sending')}</>
                : <><i className="fa-solid fa-flag mr-1.5" />{t('confirmBtn')}</>
              }
            </button>
          </div>
        </div>
      </Backdrop>
    );
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card border border-line p-6 shadow-xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-text flex items-center gap-2">
              <i className="fa-regular fa-flag text-gold-dark" />
              {t('title')}
            </h2>
            <p className="text-xs text-sub mt-0.5">{t('formSubtitle')}</p>
          </div>
          <button onClick={onClose} className="text-sub hover:text-text transition mt-0.5">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Raisons */}
        <div className="space-y-2">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReason(r.value)}
              className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-left transition ${
                reason === r.value
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : 'border-line bg-card text-text hover:border-line/80 hover:bg-gold-pale/30'
              }`}
            >
              <i className={`fa-solid ${r.icon} text-xs w-4 shrink-0 ${reason === r.value ? 'text-red-500' : 'text-sub'}`} />
              <span className="font-medium">{r.label}</span>
              {reason === r.value && <i className="fa-solid fa-circle-check text-red-500 ml-auto text-xs" />}
            </button>
          ))}
        </div>

        {/* Description optionnelle */}
        {reason && (
          <div>
            <label className="block text-xs font-medium text-sub mb-1.5 uppercase tracking-wide">
              {t('detailsLabel')} <span className="normal-case">{t('detailsOptional')}</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder={t('detailsPlaceholder')}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 transition resize-none"
            />
            <p className="text-right text-[10px] text-sub mt-0.5">{description.length}/500</p>
          </div>
        )}

        {/* Bouton suivant */}
        <button
          disabled={!reason}
          onClick={() => setStep('confirm')}
          className="w-full rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('nextBtn')} <i className="fa-solid fa-arrow-right ml-1.5" />
        </button>
      </div>
    </Backdrop>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}
