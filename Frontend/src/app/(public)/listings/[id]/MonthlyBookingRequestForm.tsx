'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { DocumentType } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const MAX_DOC_SIZE = 8 * 1024 * 1024; // 8 Mo — même limite que les photos d'annonce

const DOC_TYPES: { type: DocumentType; icon: string; required: boolean }[] = [
  { type: 'ID_CARD',         icon: 'fa-id-card',       required: false },
  { type: 'PROOF_OF_INCOME', icon: 'fa-file-invoice-dollar', required: false },
  { type: 'GUARANTOR',       icon: 'fa-user-shield',   required: false },
];

interface Props {
  listingId:     string;
  pricePerMonth: number;
  depositMonths?: number | null;
  minLeaseMonths?: number | null;
  numLocale:     string;
}

interface DocSlotState {
  fileUrl?: string;
  fileName?: string;
  status: 'idle' | 'uploading' | 'error';
}

export default function MonthlyBookingRequestForm({
  listingId,
  pricePerMonth,
  depositMonths,
  minLeaseMonths,
  numLocale,
}: Props) {
  const { getToken } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const t = useTranslations('detail');

  const [moveInDate, setMoveInDate] = useState('');
  const [docs, setDocs] = useState<Record<DocumentType, DocSlotState>>({
    ID_CARD:         { status: 'idle' },
    PROOF_OF_INCOME: { status: 'idle' },
    GUARANTOR:       { status: 'idle' },
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const deposit  = Math.round(pricePerMonth * (depositMonths ?? 0));
  const dueToday = pricePerMonth + deposit;

  const uploadDoc = async (type: DocumentType, file: File) => {
    if (file.size > MAX_DOC_SIZE) {
      setDocs((prev) => ({ ...prev, [type]: { status: 'error' } }));
      return;
    }
    setDocs((prev) => ({ ...prev, [type]: { status: 'uploading' } }));
    try {
      const token = await getToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json() as { url: string };
      setDocs((prev) => ({ ...prev, [type]: { status: 'idle', fileUrl: url, fileName: file.name } }));
    } catch {
      setDocs((prev) => ({ ...prev, [type]: { status: 'error' } }));
    }
  };

  const removeDoc = (type: DocumentType) => {
    setDocs((prev) => ({ ...prev, [type]: { status: 'idle' } }));
  };

  const handleSubmit = async () => {
    if (!moveInDate) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const documents = DOC_TYPES
        .map(({ type }) => ({ type, fileUrl: docs[type].fileUrl }))
        .filter((d): d is { type: DocumentType; fileUrl: string } => !!d.fileUrl);

      await api.post('/bookings/monthly', {
        listingId,
        moveInDate,
        ...(documents.length ? { documents } : {}),
      }, token ?? undefined);

      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg || t('bookingError'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-card border border-line rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <i className="fa-solid fa-circle-check text-3xl text-green-500" />
          <p className="font-semibold text-text">{t('bookingSuccessTitle')}</p>
          <p className="text-sm text-sub">{t('bookingSuccessDesc')}</p>
          <button
            onClick={() => router.push('/locataire/bookings')}
            className="mt-2 btn-gold py-2 px-5 rounded-full font-semibold text-sm"
          >
            {t('bookingViewMine')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-line rounded-3xl p-6 shadow-sm">
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-extrabold text-text">
          {pricePerMonth.toLocaleString(numLocale)}
        </span>
        <span className="text-xs text-sub">{t('pricePerMonthUnit')}</span>
      </div>

      <div className="flex items-center gap-2 mb-4 mt-4">
        <i className="fa-solid fa-key text-gold-dark" />
        <h3 className="font-semibold text-text">{t('monthlyRequestTitle')}</h3>
      </div>

      {!!minLeaseMonths && minLeaseMonths > 1 && (
        <p className="text-xs text-sub mb-3 flex items-center gap-1.5">
          <i className="fa-solid fa-circle-info text-[11px]" />
          {t('monthlyMinLeaseNote', { count: minLeaseMonths })}
        </p>
      )}

      {/* Date d'emménagement */}
      <label className="block text-[11px] font-medium text-sub mb-1">
        {t('moveInDateLabel')} <span className="text-red-400">*</span>
      </label>
      <input
        type="date"
        value={moveInDate}
        min={new Date().toISOString().slice(0, 10)}
        onChange={(e) => setMoveInDate(e.target.value)}
        className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition mb-4"
      />

      {/* Récap financier */}
      {!!depositMonths && (
        <div className="rounded-xl bg-gold-pale px-4 py-3 space-y-1.5 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-sub">{t('monthlyFirstMonthLabel')}</span>
            <span className="font-medium text-text">{pricePerMonth.toLocaleString(numLocale)} FCFA</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-sub">{t('monthlyDepositLabel', { count: depositMonths })}</span>
            <span className="font-medium text-text">{deposit.toLocaleString(numLocale)} FCFA</span>
          </div>
          <div className="border-t border-gold/20 my-1.5" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text">{t('monthlyTotalDueLabel')}</span>
            <span className="font-bold text-gold-dark">{dueToday.toLocaleString(numLocale)} FCFA</span>
          </div>
        </div>
      )}

      {!!depositMonths && (
        <p className="text-[11px] text-sub mb-4 flex items-start gap-1.5">
          <i className="fa-solid fa-circle-info mt-0.5 shrink-0" />
          {t('tenantDepositCommissionNote')}
        </p>
      )}

      {/* Dossier locataire (optionnel) */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-text mb-0.5">{t('monthlyDocumentsTitle')}</p>
        <p className="text-[11px] text-sub mb-3">{t('monthlyDocumentsDesc')}</p>
        <div className="space-y-2">
          {DOC_TYPES.map(({ type, icon }) => (
            <DocSlot
              key={type}
              icon={icon}
              state={docs[type]}
              onUpload={(file) => uploadDoc(type, file)}
              onRemove={() => removeDoc(type)}
              label={t(`docType${type === 'ID_CARD' ? 'IdCard' : type === 'PROOF_OF_INCOME' ? 'ProofOfIncome' : 'Guarantor'}`)}
            />
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-3 flex items-center gap-1.5 text-sm text-red-600">
          <i className="fa-solid fa-circle-exclamation text-xs" />
          {error}
        </p>
      )}

      <button
        onClick={() => void handleSubmit()}
        disabled={!moveInDate || loading}
        className="w-full btn-gold py-2.5 rounded-full font-semibold text-sm hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <i className="fa-solid fa-spinner fa-spin text-xs" />
            {t('bookingSubmitting')}
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <i className="fa-solid fa-paper-plane text-xs" />
            {t('bookingSubmit')}
          </span>
        )}
      </button>
    </div>
  );
}

function DocSlot({
  icon, state, onUpload, onRemove, label,
}: {
  icon: string;
  state: DocSlotState;
  onUpload: (file: File) => void;
  onRemove: () => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('detail');

  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2.5">
      <span className="h-8 w-8 rounded-full bg-gold-pale text-gold-dark inline-grid place-items-center shrink-0">
        <i className={`fa-solid ${icon} text-xs`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-text truncate">{label}</p>
        {state.status === 'error' && (
          <p className="text-[11px] text-red-500">{t('docUploadError')}</p>
        )}
      </div>
      {state.status === 'uploading' ? (
        <i className="fa-solid fa-spinner fa-spin text-gold-dark text-sm shrink-0" />
      ) : state.fileUrl ? (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600 transition-colors"
        >
          <i className="fa-solid fa-check text-xs" />
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="shrink-0 text-xs font-medium text-gold-dark hover:underline whitespace-nowrap"
          >
            <i className="fa-solid fa-upload text-[11px] mr-1" />
            {t('docUploadBtn')}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) onUpload(e.target.files[0]); e.target.value = ''; }}
          />
        </>
      )}
    </div>
  );
}
