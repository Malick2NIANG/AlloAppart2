'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/utils';
import type { Booking } from '@/types';

const ESCROW_CLS: Record<string, string> = {
  AWAITING_PAYMENT: 'bg-gold-pale text-gold-dark border-gold/30',
  HELD:             'bg-blue-50 text-blue-700 border-blue-200',
  RELEASED:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  REFUNDED:         'bg-red-50 text-red-600 border-red-200',
};

const ESCROW_ICON: Record<string, string> = {
  AWAITING_PAYMENT: 'fa-clock',
  HELD:             'fa-shield-halved',
  RELEASED:         'fa-circle-check',
  REFUNDED:         'fa-rotate-left',
};

export default function PaiementsPage() {
  const { getToken } = useAuth();
  const t = useTranslations('locataire');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const ESCROW_LABEL: Record<string, string> = {
    AWAITING_PAYMENT: t('escrowAwaitingShort'),
    HELD:             t('escrowHeldShort'),
    RELEASED:         t('escrowReleasedShort'),
    REFUNDED:         t('escrowRefunded'),
  };

  const STATUS_LABEL: Record<string, string> = {
    PENDING:   t('statusPending'),
    CONFIRMED: t('statusConfirmed'),
    CANCELLED: t('statusCancelled'),
    COMPLETED: t('statusCompleted'),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      const data = await api.get<Booking[]>('/bookings/mine', token);
      setBookings(data);
    } catch {
      setError(t('paymentsError'));
    } finally {
      setLoading(false);
    }
  }, [getToken, t]);

  useEffect(() => { void load(); }, [load]);

  /* ── Agrégats financiers ── */
  const paid    = bookings.filter((b) => ['HELD', 'RELEASED'].includes(b.escrowStatus));
  const refunded = bookings.filter((b) => b.escrowStatus === 'REFUNDED');
  const pending  = bookings.filter((b) => b.escrowStatus === 'AWAITING_PAYMENT');

  const totalPaid     = paid.reduce((s, b) => s + Number(b.totalAmount), 0);
  const totalRefunded = refunded.reduce((s, b) => s + Number(b.totalAmount), 0);
  const totalPending  = pending.reduce((s, b) => s + Number(b.totalAmount), 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-line bg-card h-20" />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-line bg-card h-16" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
        <p className="text-sm text-sub">{error}</p>
        <button onClick={() => void load()} className="mt-4 btn-gold text-sm">
          <i className="fa-solid fa-rotate-right mr-1.5" />{t('retryBtn')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-text">{t('paymentsTitle')}</h1>
        <p className="mt-1 text-sm text-sub">{t('paymentsDesc')}</p>
      </div>

      {/* KPI Cards financières */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold mb-1">{t('kpiTotalPaid')}</p>
          <p className="text-2xl font-bold text-emerald-800">{formatPrice(totalPaid)}</p>
          <p className="text-xs text-emerald-600 mt-0.5">{t('transactionsCount', { count: paid.length })}</p>
        </div>
        <div className="rounded-2xl border border-gold/30 bg-gold-pale p-4">
          <p className="text-[10px] uppercase tracking-widest text-gold-dark font-semibold mb-1">{t('kpiPending')}</p>
          <p className="text-2xl font-bold text-gold-dark">{formatPrice(totalPending)}</p>
          <p className="text-xs text-gold-dark/70 mt-0.5">{t('transactionsCount', { count: pending.length })}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-[10px] uppercase tracking-widest text-red-600 font-semibold mb-1">{t('kpiRefunded')}</p>
          <p className="text-2xl font-bold text-red-700">{formatPrice(totalRefunded)}</p>
          <p className="text-xs text-red-500 mt-0.5">{t('transactionsCount', { count: refunded.length })}</p>
        </div>
      </div>

      {/* Liste des transactions */}
      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-line bg-card">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-wallet text-xl text-gold-dark" />
          </div>
          <p className="text-sm font-medium text-text">{t('noTransactions')}</p>
          <p className="mt-1 text-xs text-sub">{t('noTransactionsHint')}</p>
          <Link href="/" className="mt-4 btn-gold text-sm">
            <i className="fa-solid fa-magnifying-glass mr-1.5" />
            {t('browseBtn')}
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-line">
            <p className="text-xs font-semibold text-sub uppercase tracking-widest">
              {t('transactionsCount', { count: bookings.length })}
            </p>
          </div>
          <div className="divide-y divide-line">
            {bookings.map((b) => (
              <Link
                key={b.id}
                href={`/locataire/bookings/${b.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gold-pale/30 transition-colors group"
              >
                {/* Icône escrow */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${ESCROW_CLS[b.escrowStatus] ?? 'bg-card border-line text-sub'}`}>
                  <i className={`fa-solid ${ESCROW_ICON[b.escrowStatus] ?? 'fa-circle'} text-sm`} />
                </div>

                {/* Infos */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text truncate group-hover:text-gold-dark transition-colors">
                    {b.listing?.title ?? b.listingId}
                  </p>
                  <p className="text-xs text-sub mt-0.5">
                    {formatDate(b.startDate)}
                    {b.endDate ? ` → ${formatDate(b.endDate)}` : ''}
                    <span className="mx-1.5">·</span>
                    {STATUS_LABEL[b.status] ?? b.status}
                  </p>
                </div>

                {/* Montant + statut escrow */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-text">{formatPrice(b.totalAmount)}</p>
                  <span className={`inline-block mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ESCROW_CLS[b.escrowStatus] ?? 'bg-card border-line text-sub'}`}>
                    {ESCROW_LABEL[b.escrowStatus] ?? b.escrowStatus}
                  </span>
                </div>

                <i className="fa-solid fa-chevron-right text-[10px] text-sub opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
