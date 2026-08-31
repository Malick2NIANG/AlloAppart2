'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import PaydunyaPaymentModal from '@/components/ui/PaydunyaPaymentModal';

const MONTHLY_THRESHOLD = 25; // jours — au-delà, tarif mensuel appliqué

interface Props {
  listingId:     string;
  pricePerMonth: number;
  pricePerNight?: number | null;
  minimumNights?: number | null;
  numLocale:     string;
}

/**
 * Ajoute n mois en bornant au dernier jour du mois d'arrivée.
 * Doit rester identique à addMonthsClamped du backend
 * (Backend/src/bookings/bookings.service.ts).
 */
function addMonthsClamped(date: Date, n: number): Date {
  const day = date.getDate();
  const r = new Date(date);
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  const lastDayOfTargetMonth = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, lastDayOfTargetMonth));
  return r;
}

/** Découpe un séjour en mois calendaires complets + jours résiduels. */
function splitCalendarMonths(start: Date, end: Date): { months: number; remainderDays: number } {
  let months = 0;
  let cursor = start;
  for (;;) {
    const next = addMonthsClamped(start, months + 1);
    if (next.getTime() > end.getTime()) break;
    months += 1;
    cursor = next;
  }
  return {
    months,
    remainderDays: Math.max(0, Math.round((end.getTime() - cursor.getTime()) / 86_400_000)),
  };
}

/**
 * Calcule le montant total selon les mêmes règles que le backend.
 *
 * ⚠️ Cette fonction doit rester synchronisée avec le calcul de
 * Backend/src/bookings/bookings.service.ts (méthode create). Tout écart
 * afficherait au locataire un montant différent de celui qui lui est facturé.
 *
 * Règle : au-delà de 25 jours, un mois calendaire = un loyer mensuel, et les
 * jours résiduels sont au prorata (loyer ÷ 30).
 */
function computePrice(
  days: number,
  pricePerMonth: number,
  pricePerNight: number | null | undefined,
  start: Date | null,
  end: Date | null,
): { amount: number; isMonthlyRate: boolean; months: number; remainderDays: number } {
  const hasMonthly = pricePerMonth > 0;
  const hasNightly = !!pricePerNight && pricePerNight > 0;

  if (days >= MONTHLY_THRESHOLD && hasMonthly && start && end) {
    const { months, remainderDays } = splitCalendarMonths(start, end);
    return {
      amount: Math.round(months * pricePerMonth + remainderDays * (pricePerMonth / 30)),
      isMonthlyRate: true,
      months,
      remainderDays,
    };
  }
  if (hasNightly) {
    return {
      amount: Math.round((pricePerNight ?? 0) * days),
      isMonthlyRate: false, months: 0, remainderDays: days,
    };
  }
  return {
    amount: Math.round((pricePerMonth / 30) * days),
    isMonthlyRate: false, months: 0, remainderDays: days,
  };
}

export default function ListingBookingCard({
  listingId,
  pricePerMonth,
  pricePerNight,
  minimumNights,
  numLocale,
}: Props) {
  const { isSignedIn, getToken } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const t = useTranslations('detail');

  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [loading,     setLoading]     = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<{
    bookingId: string; paymentToken: string; cardUrl: string; amount: number;
  } | null>(null);

  const today = new Date().toISOString().split('T')[0];

  // Calcul du nombre de jours
  const days = startDate && endDate
    ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const pricing = days !== null && days > 0
    ? computePrice(
        days,
        pricePerMonth,
        pricePerNight,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
      )
    : null;

  // Vérification séjour minimum côté client
  const belowMinimum = minimumNights && days !== null && days > 0 && days < minimumNights;

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
      const booking = await api.post<{ id: string; totalAmount: string }>('/bookings', {
        listingId,
        startDate,
        ...(endDate ? { endDate } : {}),
      }, token ?? undefined);

      // Étape 2 : initier le paiement PayDunya
      const res = await api.post<{ payment_url: string; paymentToken?: string }>(
        '/payments/initiate',
        { bookingId: booking.id },
        token ?? undefined,
      );

      setLoading(false);

      if (res.paymentToken) {
        setPaymentModal({
          bookingId: booking.id,
          paymentToken: res.paymentToken,
          cardUrl: res.payment_url,
          amount: Number(booking.totalAmount ?? 0),
        });
      } else {
        // Bypass dev — redirection directe vers la page de confirmation
        setRedirecting(true);
        window.location.href = res.payment_url;
      }
    } catch (err: unknown) {
      setLoading(false);
      setRedirecting(false);
      const msg = err instanceof Error ? err.message : '';
      setError(msg || t('bookingPayError'));
    }
  };

  const verifyBookingPayment = async () => {
    if (!paymentModal) return false;
    const token = await getToken();
    if (!token) return false;
    const res = await api.post<{ status: string }>(
      `/payments/verify/${paymentModal.bookingId}`, {}, token,
    );
    return res.status === 'CONFIRMED';
  };

  /* ── Redirection PayDunya ───────────────────────────────────── */
  if (redirecting) {
    return (
      <div className="bg-card border border-line rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-gold-dark" />
          <p className="font-semibold text-text">{t('bookingRedirecting')}</p>
          <p className="text-sm text-sub">{t('bookingRedirectDesc')}</p>
        </div>
      </div>
    );
  }

  /* ── Visiteur non connecté ──────────────────────────────────── */
  if (!isSignedIn) {
    return (
      <div className="bg-card border border-line rounded-3xl p-6 shadow-sm">
        {/* Tarifs affichés même sans connexion */}
        <PricingBadges pricePerMonth={pricePerMonth} pricePerNight={pricePerNight} numLocale={numLocale} />
        <div className="flex items-center gap-2 mb-2 mt-4">
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

  /* ── Formulaire ─────────────────────────────────────────────── */
  return (
    <div className="bg-card border border-line rounded-3xl p-6 shadow-sm">
      {/* Tarifs */}
      <PricingBadges pricePerMonth={pricePerMonth} pricePerNight={pricePerNight} numLocale={numLocale} />

      <div className="flex items-center gap-2 mb-4 mt-4">
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

      {/* Séjour minimum non respecté */}
      {belowMinimum && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <i className="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" />
          <span>{t('bookingMinNightsWarning', { count: minimumNights ?? 0 })}</span>
        </div>
      )}

      {/* Notification basculement vers tarif mensuel */}
      {pricing?.isMonthlyRate && days !== null && days > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
          <i className="fa-solid fa-circle-info mt-0.5 shrink-0" />
          <span>{t('bookingMonthlyRateNote')}</span>
        </div>
      )}

      {/* Récap montant */}
      {pricing && days !== null && days > 0 && (
        <div className="mt-4 rounded-xl bg-gold-pale px-4 py-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-sub">
              {pricing.isMonthlyRate
                ? pricing.remainderDays > 0
                  ? t('pricingMonthsPlusDays', { months: pricing.months, days: pricing.remainderDays })
                  : t('pricingMonthsOnly', { months: pricing.months })
                : t('pricingNights', { count: days })
              }
            </span>
            <span className="font-bold text-gold-dark">
              {pricing.amount.toLocaleString(numLocale)} FCFA
            </span>
          </div>
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
        disabled={!startDate || loading || !!belowMinimum}
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

      {/* Modal paiement réservation (SOFTPAY custom) */}
      <PaydunyaPaymentModal
        open={paymentModal !== null}
        onClose={() => setPaymentModal(null)}
        amount={paymentModal?.amount ?? 0}
        paymentToken={paymentModal?.paymentToken ?? null}
        cardUrl={paymentModal?.cardUrl ?? null}
        onVerify={verifyBookingPayment}
        onSuccess={() => {
          if (paymentModal) {
            router.push(`/paiement/confirmation?booking_id=${paymentModal.bookingId}`);
          }
        }}
      />
    </div>
  );
}

/** Affiche les badges de tarifs disponibles (nuit / mois) */
function PricingBadges({
  pricePerMonth,
  pricePerNight,
  numLocale,
}: {
  pricePerMonth: number;
  pricePerNight?: number | null;
  numLocale: string;
}) {
  const tb = useTranslations('detail');
  return (
    <div className="flex flex-wrap gap-2">
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-extrabold text-text">
          {pricePerMonth.toLocaleString(numLocale)}
        </span>
        <span className="text-xs text-sub">{tb('pricePerMonthUnit')}</span>
      </div>
      {pricePerNight && pricePerNight > 0 && (
        <>
          <span className="text-sub self-center">·</span>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-semibold text-sub">
              {Math.round(pricePerNight).toLocaleString(numLocale)}
            </span>
            <span className="text-xs text-sub">{tb('pricePerNightUnit')}</span>
          </div>
        </>
      )}
    </div>
  );
}
