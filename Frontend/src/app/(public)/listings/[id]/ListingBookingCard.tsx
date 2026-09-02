'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import PaydunyaPaymentModal from '@/components/ui/PaydunyaPaymentModal';
import AvailabilityCalendar, { isBooked, type BookedRange } from '@/components/listings/AvailabilityCalendar';
import MonthlyBookingRequestForm from './MonthlyBookingRequestForm';
import type { RentalMode } from '@/types';

const DAYS_PER_MONTH = 30;
// Repli si une annonce MIXTE (legacy) n'a pas de minLeaseMonths — ce champ
// est désormais requis en mode MIXTE, ne devrait plus arriver en pratique.
const DEFAULT_MIN_LEASE_MONTHS = 1;

interface Props {
  listingId:     string;
  listingStatus?: string;
  rentalMode?: RentalMode;
  pricePerMonth: number;
  pricePerNight?: number | null;
  minimumNights?: number | null;
  maximumNights?: number | null;
  depositMonths?: number | null;
  minLeaseMonths?: number | null;
  numLocale:     string;
}

/**
 * Calcule le montant total selon les mêmes règles que le backend.
 *
 * ⚠️ Cette fonction doit rester synchronisée avec le calcul de
 * Backend/src/bookings/bookings.service.ts (méthode create). Tout écart
 * afficherait au locataire un montant différent de celui qui lui est facturé.
 *
 * Tarif/nuit × nombre de nuits — pas de bascule vers le tarif mensuel ici.
 */
function computePrice(
  days: number,
  pricePerMonth: number,
  pricePerNight: number | null | undefined,
): { amount: number } {
  const hasNightly = !!pricePerNight && pricePerNight > 0;
  return {
    amount: hasNightly
      ? Math.round((pricePerNight ?? 0) * days)
      : Math.round((pricePerMonth / 30) * days),
  };
}

export default function ListingBookingCard({
  listingId,
  listingStatus,
  rentalMode,
  pricePerMonth,
  pricePerNight,
  minimumNights,
  maximumNights,
  depositMonths,
  minLeaseMonths,
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
  const [ranges,        setRanges]        = useState<BookedRange[]>([]);
  const [rangesLoading, setRangesLoading] = useState(true);
  const [showMonthlyForm, setShowMonthlyForm] = useState(false);

  // Disponibilité de l'annonce — alimente le calendrier cliquable ci-dessous
  useEffect(() => {
    let cancelled = false;
    api.get<BookedRange[]>(`/bookings/listing/${listingId}/availability`)
      .then((data) => { if (!cancelled) setRanges(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setRanges([]); })
      .finally(() => { if (!cancelled) setRangesLoading(false); });
    return () => { cancelled = true; };
  }, [listingId]);

  /**
   * Sélection de dates par clic sur le calendrier (remplace les champs de
   * date natifs) : 1er clic = entrée, 2e clic = sortie. Un clic avant la
   * date d'entrée redémarre la sélection. Si la plage cliquée traverse une
   * réservation existante, la sélection redémarre aussi (on ne peut pas se
   * fier uniquement aux jours grisés du calendrier pour ça, une plage peut
   * enjamber une réservation sans que ses bornes soient elles-mêmes réservées).
   */
  const handleSelectDate = (iso: string) => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
      return;
    }
    const clicked = new Date(`${iso}T00:00:00`);

    if (!startDate || (startDate && endDate)) {
      setStartDate(iso);
      setEndDate('');
      setError(null);
      return;
    }

    const start = new Date(`${startDate}T00:00:00`);
    if (clicked <= start) {
      setStartDate(iso);
      setEndDate('');
      setError(null);
      return;
    }

    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() + 1);
    let blocked = false;
    while (cursor < clicked) {
      if (isBooked(cursor, ranges)) { blocked = true; break; }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (blocked) {
      setStartDate(iso);
      setEndDate('');
      setError(t('bookingRangeBlocked'));
      return;
    }
    setEndDate(iso);
    setError(null);
  };

  // Calcul du nombre de jours
  const days = startDate && endDate
    ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const pricing = days !== null && days > 0
    ? computePrice(days, pricePerMonth, pricePerNight)
    : null;

  // Vérification séjour minimum côté client
  const belowMinimum = minimumNights && days !== null && days > 0 && days < minimumNights;

  // Vérification séjour maximum côté client (mode NIGHTLY uniquement — doit
  // rester synchronisé avec la vérification serveur de bookings.service.ts)
  const aboveMaximum =
    rentalMode === 'NIGHTLY' && !!maximumNights && days !== null && days > 0 && days > maximumNights;

  // Annonce MIXTE + séjour atteignant la durée minimale du bail : on ne
  // bascule plus automatiquement vers le tarif mensuel — on suggère la
  // vraie location au mois (caution). Seuil = minLeaseMonths du bailleur,
  // pas une valeur fixe (doit rester synchronisé avec bookings.service.ts).
  const minLeaseDays = (minLeaseMonths ?? DEFAULT_MIN_LEASE_MONTHS) * DAYS_PER_MONTH;
  const suggestMonthlyInstead =
    rentalMode === 'MIXED' && days !== null && days >= minLeaseDays;

  const handleSubmit = async () => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!startDate || !endDate) return;

    setLoading(true);
    setError(null);
    try {
      const token = await getToken();

      // Étape 1 : créer la réservation — totalAmount calculé côté serveur
      // (la date de fin est obligatoire : sans elle, le calcul de prix
      // retombe sur un forfait d'un seul jour côté backend, ce qui sous-
      // facturerait un séjour sans durée définie)
      const booking = await api.post<{ id: string; totalAmount: string }>('/bookings', {
        listingId,
        startDate,
        endDate,
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

  /* ── Bien actuellement loué au mois (bail actif) ─────────────── */
  if (listingStatus === 'RENTED') {
    return (
      <div className="bg-card border border-line rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <i className="fa-solid fa-lock text-3xl text-sub/50" />
          <p className="font-semibold text-text">{t('bookingRentedTitle')}</p>
          <p className="text-sm text-sub">{t('bookingRentedDesc')}</p>
        </div>
      </div>
    );
  }

  /* ── Location au mois (formulaire de demande, pas de calendrier) ─ */
  if (rentalMode === 'MONTHLY') {
    if (!isSignedIn) {
      return (
        <div className="bg-card border border-line rounded-3xl p-6 shadow-sm">
          <PricingBadges pricePerMonth={pricePerMonth} pricePerNight={pricePerNight} numLocale={numLocale} />
          <div className="flex items-center gap-2 mb-2 mt-4">
            <i className="fa-solid fa-key text-gold-dark" />
            <h3 className="font-semibold text-text">{t('monthlyRequestTitle')}</h3>
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
    return (
      <MonthlyBookingRequestForm
        listingId={listingId}
        pricePerMonth={pricePerMonth}
        depositMonths={depositMonths}
        minLeaseMonths={minLeaseMonths}
        numLocale={numLocale}
      />
    );
  }

  /* ── Annonce MIXTE : bascule volontaire vers la demande mensuelle ─ */
  if (rentalMode === 'MIXED' && showMonthlyForm) {
    if (!isSignedIn) {
      return (
        <div className="bg-card border border-line rounded-3xl p-6 shadow-sm">
          <PricingBadges pricePerMonth={pricePerMonth} pricePerNight={pricePerNight} numLocale={numLocale} />
          <div className="flex items-center gap-2 mb-2 mt-4">
            <i className="fa-solid fa-key text-gold-dark" />
            <h3 className="font-semibold text-text">{t('monthlyRequestTitle')}</h3>
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
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowMonthlyForm(false)}
          className="text-xs text-gold-dark hover:underline flex items-center gap-1"
        >
          <i className="fa-solid fa-arrow-left text-[10px]" />
          {t('backToNightlyBtn')}
        </button>
        <MonthlyBookingRequestForm
          listingId={listingId}
          pricePerMonth={pricePerMonth}
          depositMonths={depositMonths}
          minLeaseMonths={minLeaseMonths}
          numLocale={numLocale}
        />
      </div>
    );
  }

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
          className="btn-gold w-full py-2.5 rounded-full font-semibold text-center block text-sm mb-4"
        >
          {t('bookingSignIn')}
        </a>
        {/* Calendrier consultable avant connexion — un clic redirige vers le sign-in */}
        <AvailabilityCalendar
          ranges={ranges}
          loading={rangesLoading}
          selectedStart={null}
          selectedEnd={null}
          onSelectDate={handleSelectDate}
        />
      </div>
    );
  }

  /* ── Formulaire ─────────────────────────────────────────────── */
  return (
    <div className="bg-card border border-line rounded-3xl p-6 shadow-sm">
      {/* Tarifs */}
      <PricingBadges pricePerMonth={pricePerMonth} pricePerNight={pricePerNight} numLocale={numLocale} />

      <div className="flex items-center gap-2 mb-1 mt-4">
        <i className="fa-solid fa-calendar-check text-gold-dark" />
        <h3 className="font-semibold text-text">{t('bookingTitle')}</h3>
      </div>

      {/* Annonce MIXTE — le locataire choisit son option dès le départ */}
      {rentalMode === 'MIXED' && (
        <button
          type="button"
          onClick={() => setShowMonthlyForm(true)}
          className="text-xs text-gold-dark hover:underline mb-3 flex items-center gap-1"
        >
          <i className="fa-solid fa-key text-[10px]" />
          {t('preferMonthlyLink')}
        </button>
      )}

      <div className="space-y-3">
        {/* Résumé des dates sélectionnées */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg px-3 py-2.5">
          <div>
            <p className="text-[11px] font-medium text-sub mb-0.5">
              {t('bookingStart')} <span className="text-red-400">*</span>
            </p>
            <p className="text-sm font-semibold text-text">
              {startDate
                ? new Date(`${startDate}T00:00:00`).toLocaleDateString(numLocale, { day: '2-digit', month: 'short', year: 'numeric' })
                : <span className="text-sub font-normal">{t('bookingSelectStart')}</span>}
            </p>
          </div>
          <i className="fa-solid fa-arrow-right-long text-sub text-xs shrink-0" />
          <div className="text-right">
            <p className="text-[11px] font-medium text-sub mb-0.5">
              {t('bookingEnd')} <span className="text-red-400">*</span>
            </p>
            <p className="text-sm font-semibold text-text">
              {endDate
                ? new Date(`${endDate}T00:00:00`).toLocaleDateString(numLocale, { day: '2-digit', month: 'short', year: 'numeric' })
                : <span className="text-sub font-normal">{t('bookingSelectEnd')}</span>}
            </p>
          </div>
        </div>

        {(startDate || endDate) && (
          <button
            type="button"
            onClick={() => { setStartDate(''); setEndDate(''); setError(null); }}
            className="text-xs text-gold-dark hover:underline"
          >
            {t('bookingClearDates')}
          </button>
        )}

        {/* Calendrier cliquable — sélection des dates directement dessus */}
        <AvailabilityCalendar
          ranges={ranges}
          loading={rangesLoading}
          selectedStart={startDate || null}
          selectedEnd={endDate || null}
          onSelectDate={handleSelectDate}
        />
      </div>

      {/* Séjour minimum non respecté */}
      {belowMinimum && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <i className="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" />
          <span>{t('bookingMinNightsWarning', { count: minimumNights ?? 0 })}</span>
        </div>
      )}

      {/* Séjour maximum dépassé (mode NIGHTLY) */}
      {aboveMaximum && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <i className="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" />
          <span>{t('bookingMaxNightsWarning', { count: maximumNights ?? 0 })}</span>
        </div>
      )}

      {/* Séjour long sur annonce MIXTE — on suggère la location au mois */}
      {suggestMonthlyInstead ? (
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-3 text-xs text-blue-800 space-y-2">
          <div className="flex items-start gap-2">
            <i className="fa-solid fa-circle-info mt-0.5 shrink-0" />
            <span>{t('suggestMonthlyNote', { months: minLeaseMonths ?? DEFAULT_MIN_LEASE_MONTHS })}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowMonthlyForm(true)}
            className="w-full rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 transition-colors"
          >
            {t('switchToMonthlyBtn')}
          </button>
        </div>
      ) : (
        <>
          {/* Récap montant */}
          {pricing && days !== null && days > 0 && (
            <div className="mt-4 rounded-xl bg-gold-pale px-4 py-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-sub">{t('pricingNights', { count: days })}</span>
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
            disabled={!startDate || !endDate || loading || !!belowMinimum || !!aboveMaximum}
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
        </>
      )}

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
