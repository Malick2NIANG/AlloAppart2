'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

interface Props {
  listingId: string;
  pricePerMonth: number;
  numLocale: string;
}

export default function ListingBookingCard({ listingId, pricePerMonth, numLocale }: Props) {
  const { isSignedIn, getToken } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const t = useTranslations('detail');

  const [startDate,    setStartDate]    = useState('');
  const [endDate,      setEndDate]      = useState('');
  const [loading,      setLoading]      = useState(false);
  const [redirecting,  setRedirecting]  = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const months = startDate && endDate
    ? (() => {
        const s = new Date(startDate);
        const e = new Date(endDate);
        const m = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
          + (e.getDate() > s.getDate() ? 1 : 0);
        return Math.max(1, m);
      })()
    : null;
  const totalAmount = pricePerMonth * (months ?? 1);

  const handleSubmit = async () => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!startDate) return;

    setLoading(true);
    setError(null);
    try {
      const token = await getToken();

      // Étape 1 : créer la réservation — totalAmount calculé côté serveur
      const booking = await api.post<{ id: string }>('/bookings', {
        listingId,
        startDate,
        ...(endDate ? { endDate } : {}),
      }, token ?? undefined);

      // Étape 2 : initier le paiement CinetPay
      setLoading(false);
      setRedirecting(true);
      const { payment_url } = await api.post<{ payment_url: string }>(
        '/payments/initiate',
        { bookingId: booking.id },
        token ?? undefined,
      );

      // Étape 3 : rediriger vers CinetPay
      window.location.href = payment_url;
    } catch {
      setLoading(false);
      setRedirecting(false);
      setError(t('bookingPayError'));
    }
  };

  /* ── Redirection CinetPay ───────────────────────────────── */
  if (redirecting) {
    return (
      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-line rounded-3xl p-6 shadow-lg">
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-gold-dark" />
          <p className="font-semibold text-text">{t('bookingRedirecting')}</p>
          <p className="text-sm text-sub">Vous allez être redirigé vers la page de paiement sécurisée.</p>
        </div>
      </div>
    );
  }

  /* ── Visiteur non connecté ──────────────────────────────── */
  if (!isSignedIn) {
    return (
      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-line rounded-3xl p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <i className="fa-solid fa-calendar-check text-gold-dark" />
          <h3 className="font-semibold text-text">{t('bookingTitle')}</h3>
        </div>
        <p className="text-sm text-sub mb-4">{t('bookingSignInDesc')}</p>
        <a
          href={`/sign-in?redirect_url=${encodeURIComponent(pathname)}`}
          className="btn-gold w-full py-2.5 rounded-full font-semibold text-center block text-sm"
        >
          {t('bookingSignIn')}
        </a>
      </div>
    );
  }

  /* ── Formulaire ─────────────────────────────────────────── */
  return (
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-line rounded-3xl p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <i className="fa-solid fa-calendar-check text-gold-dark" />
        <h3 className="font-semibold text-text">{t('bookingTitle')}</h3>
      </div>

      <div className="space-y-3">
        {/* Date d'entrée */}
        <div>
          <label className="block text-xs font-medium text-sub mb-1">
            {t('bookingStart')} <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            min={today}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-line rounded-xl px-3 py-2 text-sm text-text bg-bg outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition"
          />
        </div>

        {/* Date de fin */}
        <div>
          <label className="block text-xs font-medium text-sub mb-1">{t('bookingEnd')}</label>
          <input
            type="date"
            min={startDate || today}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-line rounded-xl px-3 py-2 text-sm text-text bg-bg outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition"
          />
        </div>
      </div>

      {/* Récap montant */}
      {startDate && (
        <div className="mt-4 rounded-xl bg-gold-pale px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-sub">
            {months ? `${months} mois` : t('bookingMonthsEst')}
          </span>
          <span className="font-bold text-gold-dark">
            {totalAmount.toLocaleString(numLocale)} FCFA
          </span>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600">
          <i className="fa-solid fa-circle-exclamation text-xs" />
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!startDate || loading}
        className="mt-4 w-full btn-gold py-2.5 rounded-full font-semibold text-sm hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <i className="fa-solid fa-spinner fa-spin text-xs" />
            {t('bookingSubmitting')}
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <i className="fa-solid fa-credit-card text-xs" />
            {t('bookingPayNow')}
          </span>
        )}
      </button>
    </div>
  );
}
