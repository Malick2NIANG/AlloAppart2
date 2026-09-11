'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

interface Props {
  listingId:     string;
  pricePerMonth: number;
  depositMonths?: number | null;
  minLeaseMonths?: number | null;
  numLocale:     string;
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
  const t = useTranslations('detail');

  const [moveInDate, setMoveInDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const deposit  = Math.round(pricePerMonth * (depositMonths ?? 0));
  const dueToday = pricePerMonth + deposit;

  const handleSubmit = async () => {
    if (!moveInDate) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();

      await api.post('/bookings/monthly', {
        listingId,
        moveInDate,
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

      {error && (
        <p className="mb-3 flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
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
