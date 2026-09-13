'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Booking, BookingStatus } from '@/types';
import { formatDate, formatPrice, openPaymentTab, redirectPaymentTab, closePaymentTab } from '@/lib/utils';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ImageUploadZone from '@/components/ui/ImageUploadZone';
import ContractCard from '@/components/bookings/ContractCard';
import { VerificationQrModal } from '@/components/bookings/VerificationQrModal';

const DISPUTE_WINDOW_HOURS = 24;
const FALLBACK_IMG = 'https://via.placeholder.com/600x400?text=AlloAppart';
const PER_PAGE_OPTIONS = [6, 12, 24] as const;

interface MyReview {
  id: string;
  bookingId: string;
  listingId: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
}

export default function LocataireBookingsPage() {
  const { getToken } = useAuth();
  const t = useTranslations('locataire');
  const [bookings,    setBookings]    = useState<Booking[]>([]);
  const [myReviews,   setMyReviews]   = useState<MyReview[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [hasBailleur, setHasBailleur] = useState(true);

  /* Modals */
  const [reviewModal,       setReviewModal]       = useState<{ booking: Booking } | null>(null);
  const [cancellationModal, setCancellationModal] = useState<{ booking: Booking } | null>(null);
  const [disputeModal,      setDisputeModal]      = useState<{ booking: Booking } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      const [data, me, reviews] = await Promise.all([
        api.get<Booking[]>('/bookings/mine', token),
        api.get<{ roles: string[] }>('/auth/me', token),
        api.get<MyReview[]>('/reviews/mine', token),
      ]);

      // Réconciliation silencieuse : un paiement PayDunya a pu aboutir sans
      // que le webhook IPN ne soit jamais reçu (fréquent en sandbox) — on
      // revérifie activement les réservations encore "payables" qui ont déjà
      // un lien PayDunya, pour ne pas laisser le bouton "Payer" affiché à
      // tort après un paiement en réalité déjà réglé.
      const toRecheck = data.filter((b) =>
        b.paymentRef?.startsWith('PD-') &&
        ((b.bookingType === 'MONTHLY' && b.status === 'APPROVED') ||
         ((!b.bookingType || b.bookingType === 'NIGHTLY') && b.status === 'PENDING')),
      );
      let finalData = data;
      if (toRecheck.length > 0) {
        const outcomes = await Promise.all(
          toRecheck.map((b) =>
            api.post<Booking>(`/payments/verify/${b.id}`, {}, token).catch(() => null),
          ),
        );
        const changed = outcomes.some((r, i) => r && r.status !== toRecheck[i].status);
        if (changed) {
          finalData = await api.get<Booking[]>('/bookings/mine', token);
        }
      }

      setBookings(finalData);
      setMyReviews(reviews);
      setHasBailleur(me.roles.some((r) => ['BAILLEUR', 'PRO_AGENCE', 'ADMIN'].includes(r)));
    } catch {
      setError(t('loadBookingsError'));
    } finally {
      setLoading(false);
    }
  }, [getToken, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const reviewedBookingIds = new Set(myReviews.map((r) => r.bookingId));

  // Nuitée : PENDING/CONFIRMED/CANCELLED/COMPLETED — Mensuel : REQUESTED/APPROVED/ACTIVE/REJECTED/TERMINATED
  const pending   = bookings.filter((b) => b.status === 'PENDING' || b.status === 'REQUESTED');
  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'APPROVED' || b.status === 'ACTIVE');
  const archived  = bookings.filter((b) =>
    b.status === 'CANCELLED' || b.status === 'COMPLETED' || b.status === 'REJECTED' || b.status === 'TERMINATED');

  // Onglet par défaut : "En attente" s'il y a quelque chose à payer (action
  // urgente à ne pas rater), sinon le premier onglet non vide. Ne se déclenche
  // qu'une fois, au tout premier chargement — un rafraîchissement (paiement,
  // annulation, etc.) ne doit pas faire sauter l'utilisateur d'onglet.
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed' | 'archived'>('pending');
  const tabInitialized = useRef(false);
  useEffect(() => {
    if (loading || tabInitialized.current) return;
    tabInitialized.current = true;
    if (pending.length > 0) setActiveTab('pending');
    else if (confirmed.length > 0) setActiveTab('confirmed');
    else if (archived.length > 0) setActiveTab('archived');
  }, [loading, pending.length, confirmed.length, archived.length]);

  const tabs = [
    { key: 'pending' as const,   label: t('sectionPending'),   icon: 'fa-clock',        items: pending },
    { key: 'confirmed' as const, label: t('sectionConfirmed'), icon: 'fa-circle-check', items: confirmed },
    { key: 'archived' as const,  label: t('sectionArchived'),  icon: 'fa-archive',      items: archived },
  ].filter((tab) => tab.items.length > 0);
  const active = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];

  // Recherche + pagination — propres à chaque onglet (réinitialisées quand on
  // change d'onglet via switchTab ; le nombre de lignes par page, lui,
  // persiste d'un onglet à l'autre, c'est une préférence d'affichage).
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<typeof PER_PAGE_OPTIONS[number]>(6);

  const switchTab = (key: 'pending' | 'confirmed' | 'archived') => {
    setActiveTab(key);
    setSearch('');
    setPage(1);
  };

  const q = search.trim().toLowerCase();
  const filteredItems = active
    ? active.items.filter((b) =>
        !q ||
        (b.listing?.title ?? '').toLowerCase().includes(q) ||
        (b.listing?.city ?? '').toLowerCase().includes(q),
      )
    : [];
  const pageCount    = Math.max(1, Math.ceil(filteredItems.length / perPage));
  const clampedPage  = Math.min(page, pageCount);
  const visibleItems = filteredItems.slice((clampedPage - 1) * perPage, clampedPage * perPage);

  useEffect(() => {
    if (page !== clampedPage) setPage(clampedPage);
  }, [page, clampedPage]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} height="280px" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
        <p className="text-sm text-sub">{error}</p>
        <button onClick={() => void fetchData()} className="mt-4 btn-gold text-sm">
          <i className="fa-solid fa-rotate-right mr-1.5" />{t('retryBtn')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">{t('bookingsTitle')}</h1>
        <p className="mt-1 text-sm text-sub">
          {t('bookingsCount', { count: bookings.length })}
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-calendar-check text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">{t('noBookings')}</p>
          <p className="mt-1 text-sm text-sub">{t('noBookingsHint')}</p>
        </div>
      ) : active && (
        <>
          {/* Onglets par statut */}
          <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className={`relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                  active.key === tab.key ? 'text-gold-dark' : 'text-sub hover:text-text'
                }`}
              >
                <i className={`fa-solid ${tab.icon} text-xs`} />
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                  active.key === tab.key ? 'bg-gold-pale text-gold-dark' : 'bg-line text-sub'
                }`}>
                  {tab.items.length}
                </span>
                {active.key === tab.key && (
                  <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gold" />
                )}
              </button>
            ))}
          </div>

          {/* Recherche + lignes par page */}
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-sub text-sm pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-xl border border-line bg-card pl-10 pr-10 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-1 focus:ring-gold-dark transition"
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setPage(1); }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sub hover:text-text transition"
                >
                  <i className="fa-solid fa-xmark text-sm" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-sub whitespace-nowrap">{t('rowsLabel')}</span>
              <div className="flex gap-1">
                {PER_PAGE_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => { setPerPage(n); setPage(1); }}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      perPage === n ? 'bg-gold-dark text-white' : 'border border-line bg-bg text-sub hover:text-text'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grille de l'onglet actif */}
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-sub">{t('noSearchResults')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleItems.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  alreadyReviewed={reviewedBookingIds.has(booking.id)}
                  onRefresh={fetchData}
                  onReview={(b) => setReviewModal({ booking: b })}
                  onCancel={active.key === 'confirmed' ? (b) => setCancellationModal({ booking: b }) : undefined}
                  onDispute={active.key === 'confirmed' ? (b) => setDisputeModal({ booking: b }) : undefined}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={clampedPage === 1}
                className="border border-line bg-card text-sm px-4 py-2 rounded-xl disabled:opacity-50"
              >
                {t('previous')}
              </button>
              <span className="text-sm text-sub">{t('pageOf', { page: clampedPage, total: pageCount })}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={clampedPage === pageCount}
                className="border border-line bg-card text-sm px-4 py-2 rounded-xl disabled:opacity-50"
              >
                {t('next')}
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal annulation */}
      {cancellationModal && (
        <CancellationModal
          booking={cancellationModal.booking}
          onClose={() => setCancellationModal(null)}
          onSuccess={() => { setCancellationModal(null); void fetchData(); }}
        />
      )}

      {/* Modal signalement de non-conformité (Article 9 des CGU) */}
      {disputeModal && (
        <DisputeModal
          booking={disputeModal.booking}
          onClose={() => setDisputeModal(null)}
          onSuccess={() => { setDisputeModal(null); void fetchData(); }}
        />
      )}

      {/* Modal laisser un avis */}
      {reviewModal && (
        <ReviewModal
          booking={reviewModal.booking}
          onClose={() => setReviewModal(null)}
          onSuccess={() => { setReviewModal(null); void fetchData(); }}
        />
      )}
    </div>
  );
}

/* ─── BookingCard ──────────────────────────────────────────── */
function BookingCard({
  booking, alreadyReviewed, onRefresh, onReview, onCancel, onDispute,
}: {
  booking: Booking;
  alreadyReviewed: boolean;
  onRefresh: () => void;
  onReview: (b: Booking) => void;
  onCancel?: (b: Booking) => void;
  onDispute?: (b: Booking) => void;
}) {
  const router = useRouter();
  const t = useTranslations('locataire');
  const tVerif = useTranslations('verification');
  const [showContract, setShowContract] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const img = booking.listing?.images?.[0] ?? FALLBACK_IMG;
  const goToDetail = () => router.push(`/locataire/bookings/${booking.id}`);
  const hasContract = booking.bookingType === 'MONTHLY' &&
    (booking.status === 'ACTIVE' || booking.status === 'TERMINATED');
  // QR de vérification d'identité — nuitée confirmée/terminée (le bailleur
  // vérifie à l'arrivée), ou bail mensuel actif (preuve d'authenticité).
  const canShowQr =
    (booking.bookingType !== 'MONTHLY' &&
      (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED')) ||
    (booking.bookingType === 'MONTHLY' && booking.status === 'ACTIVE');

  return (
    <div className="flex flex-col gap-3">
      <div className="listing-card group flex flex-col">

        {/* Photo + statut */}
        <div className="relative h-40 overflow-hidden rounded-t-2xl cursor-pointer" onClick={goToDetail}>
          <Image
            src={img}
            alt={booking.listing?.title ?? ''}
            fill
            className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw"
          />
          <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute top-3 left-3">
            <StatusChip status={booking.status} />
          </div>
        </div>

        {/* Bien + dates + prix */}
        <div className="p-4 cursor-pointer" onClick={goToDetail}>
          <p className="font-semibold text-text truncate group-hover:text-gold-dark transition-colors">
            {booking.listing?.title ?? booking.listingId}
          </p>
          <p className="text-sm text-sub mt-1 flex items-center gap-1.5">
            <i className="fa-regular fa-calendar text-gold-dark text-xs" />
            {formatDate(booking.startDate)}
            {booking.endDate ? ` → ${formatDate(booking.endDate)}` : ''}
          </p>
          <p className="text-sm font-semibold text-text mt-1">{formatPrice(booking.totalAmount)}</p>
        </div>

        {/* Actions — même gabarit sur toutes les cartes */}
        <div className="border-t border-line p-4 pt-3" onClick={(e) => e.stopPropagation()}>
          <LocataireBookingActions
            booking={booking}
            alreadyReviewed={alreadyReviewed}
            onRefresh={onRefresh}
            onReview={onReview}
            onCancel={onCancel}
            onDispute={onDispute}
          />
          {/* Contrat de bail replié par défaut — garde toutes les cartes de la
              grille à la même hauteur ; ne s'ouvre que sur demande. */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {hasContract && (
              <button
                onClick={() => setShowContract((s) => !s)}
                className="flex items-center gap-1.5 text-xs font-medium text-gold-dark hover:text-gold transition-colors"
              >
                <i className={`fa-solid fa-chevron-${showContract ? 'up' : 'down'} text-[10px]`} />
                {showContract ? t('hideContractBtn') : t('viewContractBtn')}
              </button>
            )}
            {canShowQr && (
              <button
                onClick={() => setShowQrModal(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-gold-dark hover:text-gold transition-colors"
              >
                <i className="fa-solid fa-qrcode text-[10px]" />
                {tVerif('qrButtonLabel')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contrat de bail — affiché uniquement si l'utilisateur le demande */}
      {hasContract && showContract && (
        <div onClick={(e) => e.stopPropagation()}>
          <ContractCard bookingId={booking.id} viewerRole="tenant" />
        </div>
      )}

      <VerificationQrModal
        open={showQrModal}
        onClose={() => setShowQrModal(false)}
        bookingId={booking.id}
      />
    </div>
  );
}

/* ─── Actions ──────────────────────────────────────────────── */
function LocataireBookingActions({
  booking, alreadyReviewed, onRefresh, onReview, onCancel, onDispute,
}: {
  booking: Booking;
  alreadyReviewed: boolean;
  onRefresh: () => void;
  onReview: (b: Booking) => void;
  onCancel?: (b: Booking) => void;
  onDispute?: (b: Booking) => void;
}) {
  const { getToken } = useAuth();
  const t = useTranslations('locataire');
  const { id: bookingId, status } = booking;
  const [payLoading,       setPayLoading]       = useState(false);
  const [cancelLoading,    setCancelLoading]    = useState(false);
  const [pdfLoading,       setPdfLoading]       = useState(false);
  const [terminateLoading, setTerminateLoading] = useState(false);
  const [confirmTerminate, setConfirmTerminate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

  const handleDownloadPdf = async () => {
    const token = await getToken();
    if (!token) return;
    setPdfLoading(true);
    try {
      const res = await fetch(`${API}/bookings/${bookingId}/receipt`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('error');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `recu-${bookingId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('receiptError'));
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePay = async () => {
    // Réservé de façon SYNCHRONE avant tout `await`, sinon le navigateur
    // bloque le popup. On garde cette page ouverte (au lieu de la faire
    // naviguer vers PayDunya) pour ne pas rester "coincé" si PayDunya ne
    // redirige pas automatiquement au retour (observé en sandbox).
    const paymentTab = openPaymentTab();
    const token = await getToken();
    if (!token) { closePaymentTab(paymentTab); return; }
    setPayLoading(true);
    setError(null);
    try {
      const { payment_url } = await api.post<{ payment_url: string }>(
        '/payments/initiate',
        { bookingId },
        token,
      );
      redirectPaymentTab(paymentTab, payment_url);
    } catch (err: unknown) {
      closePaymentTab(paymentTab);
      // Le paiement a pu être finalisé côté PayDunya sans que notre webhook
      // ne soit jamais arrivé (fréquent en sandbox) — le backend revérifie
      // et débloque le statut au lieu de renvoyer vers un checkout mort.
      if (err instanceof Error && err.message === 'ALREADY_PAID') {
        onRefresh();
      } else {
        setError(t('payError'));
      }
      setPayLoading(false);
    }
  };

  const handleCancel = async () => {
    const token = await getToken();
    if (!token) return;
    setCancelLoading(true);
    setError(null);
    try {
      await api.patch(`/bookings/${bookingId}/cancel`, {}, token);
      onRefresh();
    } catch {
      setError(t('actionError'));
      setCancelLoading(false);
    }
  };

  const handleTerminate = async () => {
    const token = await getToken();
    if (!token) return;
    setTerminateLoading(true);
    setError(null);
    try {
      await api.patch(`/bookings/${bookingId}/terminate-lease`, {}, token);
      onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('actionError'));
      setTerminateLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex items-center gap-2 flex-wrap justify-start">
        {status === 'PENDING' && (
          <>
            <button
              onClick={handlePay}
              disabled={payLoading}
              className="btn-gold text-xs py-1.5 px-3 disabled:opacity-50"
            >
              {payLoading
                ? <i className="fa-solid fa-spinner fa-spin" />
                : <><i className="fa-solid fa-credit-card text-xs" /> {t('payBtn')}</>}
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelLoading}
              className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-400 border border-red-200 dark:border-red-900/40 hover:border-red-300 rounded-lg py-1.5 px-3 transition-colors disabled:opacity-50"
            >
              {cancelLoading ? <i className="fa-solid fa-spinner fa-spin" /> : t('cancelBtn')}
            </button>
          </>
        )}

        {(status === 'CONFIRMED' || status === 'CANCELLED' || status === 'COMPLETED') && (
          <StatusChip status={status as BookingStatus} />
        )}

        {/* Demande de location au mois — en attente de réponse du bailleur */}
        {status === 'REQUESTED' && (
          <>
            <StatusChip status={status} />
            <button
              onClick={handleCancel}
              disabled={cancelLoading}
              className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-400 border border-red-200 dark:border-red-900/40 hover:border-red-300 rounded-lg py-1.5 px-3 transition-colors disabled:opacity-50"
            >
              {cancelLoading ? <i className="fa-solid fa-spinner fa-spin" /> : t('withdrawRequestBtn')}
            </button>
          </>
        )}

        {/* Approuvée — le locataire doit payer le ticket d'entrée pour activer le bail */}
        {status === 'APPROVED' && (
          <>
            <button
              onClick={handlePay}
              disabled={payLoading}
              className="btn-gold text-xs py-1.5 px-3 disabled:opacity-50"
            >
              {payLoading
                ? <i className="fa-solid fa-spinner fa-spin" />
                : <><i className="fa-solid fa-credit-card text-xs" /> {t('payDepositBtn')}</>}
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelLoading}
              className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-400 border border-red-200 dark:border-red-900/40 hover:border-red-300 rounded-lg py-1.5 px-3 transition-colors disabled:opacity-50"
            >
              {cancelLoading ? <i className="fa-solid fa-spinner fa-spin" /> : t('cancelBtn')}
            </button>
          </>
        )}

        {/* Bail actif — le locataire peut le résilier à tout moment */}
        {status === 'ACTIVE' && (
          confirmTerminate ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-sub">{t('confirmTerminateLease')}</span>
              <button
                onClick={() => void handleTerminate()}
                disabled={terminateLoading}
                className="text-xs px-3 py-1.5 rounded-full font-medium bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-200 transition disabled:opacity-50"
              >
                {terminateLoading ? <i className="fa-solid fa-spinner fa-spin" /> : t('actionTerminateLeaseConfirm')}
              </button>
              <button
                onClick={() => setConfirmTerminate(false)}
                className="text-xs px-3 py-1.5 rounded-full font-medium bg-bg text-sub border border-line hover:bg-line/30 transition"
              >
                {t('actionCancelTerminate')}
              </button>
            </div>
          ) : (
            <>
              <StatusChip status={status} />
              <button
                onClick={() => setConfirmTerminate(true)}
                className="text-xs px-3 py-1.5 rounded-full font-medium bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-200 transition"
              >
                {t('actionTerminateLease')}
              </button>
            </>
          )
        )}

        {(status === 'REJECTED' || status === 'TERMINATED') && (
          <StatusChip status={status} />
        )}

        {/* Litige en cours — les fonds sont gelés en attente d'arbitrage admin */}
        {booking.escrowStatus === 'DISPUTED' && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-lg py-1.5 px-3">
            <i className="fa-solid fa-hourglass-half text-[10px]" />
            {t('disputeInProgress')}
          </span>
        )}

        {/* Signalement de non-conformité — fenêtre de 24h après l'entrée dans les lieux */}
        {status === 'CONFIRMED' && booking.escrowStatus === 'HELD' && onDispute && (() => {
          const hoursSinceStart =
            (Date.now() - new Date(booking.startDate).getTime()) / (1000 * 60 * 60);
          if (hoursSinceStart < 0 || hoursSinceStart > 24) return null; // hors fenêtre
          return (
            <button
              onClick={() => onDispute(booking)}
              className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 border border-amber-200 dark:border-amber-900/40 hover:border-amber-300 rounded-lg py-1.5 px-3 transition-colors"
            >
              <i className="fa-solid fa-triangle-exclamation mr-1" />{t('reportDisputeBtn')}
            </button>
          );
        })()}

        {/* Annulation d'une réservation CONFIRMED — ouvre le modal avec politique */}
        {status === 'CONFIRMED' && booking.escrowStatus === 'HELD' && onCancel && (() => {
          const hoursUntilStart =
            (new Date(booking.startDate).getTime() - Date.now()) / (1000 * 60 * 60);
          if (hoursUntilStart < 0) return null; // séjour en cours → pas d'annulation
          return (
            <button
              onClick={() => onCancel(booking)}
              disabled={cancelLoading}
              className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-400 border border-red-200 dark:border-red-900/40 hover:border-red-300 rounded-lg py-1.5 px-3 transition-colors disabled:opacity-50"
            >
              {cancelLoading ? <i className="fa-solid fa-spinner fa-spin" /> : t('cancelBtn')}
            </button>
          );
        })()}

        {(status === 'CONFIRMED' || status === 'COMPLETED') && (
          <button
            onClick={() => void handleDownloadPdf()}
            disabled={pdfLoading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gold-dark bg-gold-pale border border-gold/30 hover:border-gold hover:bg-gold/10 rounded-lg py-1.5 px-3 transition-all disabled:opacity-50"
          >
            {pdfLoading
              ? <i className="fa-solid fa-spinner fa-spin" />
              : <><i className="fa-solid fa-file-pdf text-[10px]" />{t('receiptBtn')}</>}
          </button>
        )}

        {/* Bouton avis — uniquement sur COMPLETED */}
        {status === 'COMPLETED' && (
          alreadyReviewed ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-lg py-1.5 px-3">
              <i className="fa-solid fa-star text-[10px]" />
              {t('reviewGiven')}
            </span>
          ) : (
            <button
              onClick={() => onReview(booking)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-dark bg-gold-pale border border-gold/30 hover:border-gold hover:bg-gold/10 rounded-lg py-1.5 px-3 transition-all"
            >
              <i className="fa-solid fa-star text-[10px]" />
              {t('leaveReviewBtn')}
            </button>
          )
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ─── StatusChip ────────────────────────────────────────────── */
function StatusChip({ status }: { status: BookingStatus }) {
  const t = useTranslations('locataire');
  const styles: Record<BookingStatus, string> = {
    CONFIRMED:  'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400',
    PENDING:    'bg-gold-pale text-gold-dark',
    CANCELLED:  'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400',
    COMPLETED:  'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400',
    // Cycle de vie du bail mensuel (location hybride)
    REQUESTED:  'bg-gold-pale text-gold-dark',
    APPROVED:   'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400',
    REJECTED:   'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400',
    ACTIVE:     'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400',
    TERMINATED: 'bg-gray-100 dark:bg-gray-950/40 text-gray-600 dark:text-gray-400',
  };
  const labels: Record<BookingStatus, string> = {
    CONFIRMED:  t('statusConfirmed'),
    PENDING:    t('statusPending'),
    CANCELLED:  t('statusCancelled'),
    COMPLETED:  t('statusCompleted'),
    REQUESTED:  t('statusRequested'),
    APPROVED:   t('statusApproved'),
    REJECTED:   t('statusRejected'),
    ACTIVE:     t('statusActive'),
    TERMINATED: t('statusTerminated'),
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

/* ─── Modal annulation ──────────────────────────────────────── */
function CancellationModal({
  booking, onClose, onSuccess,
}: {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { getToken } = useAuth();
  const t = useTranslations('locataire');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Calcul de la politique de remboursement (identique au backend)
  const hoursUntilStart =
    (new Date(booking.startDate).getTime() - Date.now()) / (1000 * 60 * 60);
  const fullRefund   = hoursUntilStart > 7 * 24;
  const refundAmount = fullRefund ? Number(booking.totalAmount) : 0;

  const handleConfirm = async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/bookings/${booking.id}/cancel`,
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      ).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as { message?: string };
          throw new Error(body.message ?? t('actionError'));
        }
      });
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('actionError'));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card border border-line shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900/40 p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">{t('cancelModalBadge')}</p>
            <h3 className="text-lg font-bold text-text mt-0.5 leading-tight line-clamp-2">
              {booking.listing?.title ?? t('cancelModalFallback')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors"
          >
            <i className="fa-solid fa-xmark text-sub text-sm" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-5 space-y-4">
          {/* Politique */}
          <div className={`rounded-xl p-4 flex gap-3 ${fullRefund ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/40' : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40'}`}>
            <i className={`fa-solid ${fullRefund ? 'fa-circle-check text-green-600 dark:text-green-400' : 'fa-triangle-exclamation text-amber-500'} mt-0.5 text-sm shrink-0`} />
            <div>
              <p className={`text-sm font-semibold ${fullRefund ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {fullRefund ? t('fullRefundTitle') : t('noRefundTitle')}
              </p>
              <p className="text-xs text-sub mt-0.5">
                {fullRefund
                  ? t('fullRefundDesc', { amount: Number(booking.totalAmount).toLocaleString() })
                  : t('noRefundDesc')}
              </p>
              {fullRefund && refundAmount > 0 && (
                <p className="text-sm font-bold text-green-700 dark:text-green-400 mt-1">
                  {t('refundAmount', { amount: refundAmount.toLocaleString() })}
                </p>
              )}
            </div>
          </div>

          <p className="text-sm text-sub">{t('cancelIrreversible')}</p>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-exclamation" />{error}
            </p>
          )}

          {/* Boutons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-sub hover:bg-bg transition-colors"
            >
              {t('keepBtn')}
            </button>
            <button
              onClick={() => void handleConfirm()}
              disabled={loading}
              className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading
                ? <><i className="fa-solid fa-spinner fa-spin" /> {t('confirmingBtn')}</>
                : <><i className="fa-solid fa-xmark" /> {t('confirmCancelBtn')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal signalement de non-conformité (Article 9 des CGU) ─ */
function DisputeModal({
  booking, onClose, onSuccess,
}: {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { getToken } = useAuth();
  const t = useTranslations('locataire');
  const [reason,     setReason]     = useState('');
  const [evidence,   setEvidence]   = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const hoursSinceStart =
    (Date.now() - new Date(booking.startDate).getTime()) / (1000 * 60 * 60);
  const hoursLeft = Math.max(0, Math.ceil(DISPUTE_WINDOW_HOURS - hoursSinceStart));

  const handleSubmit = async () => {
    if (reason.trim().length < 10) { setError(t('disputeReasonTooShort')); return; }
    if (evidence.length === 0) { setError(t('disputeEvidenceRequired')); return; }
    setSubmitting(true);
    setError(null);
    const token = await getToken();
    if (!token) { setSubmitting(false); return; }
    try {
      await api.patch(`/bookings/${booking.id}/report-dispute`, {
        reason: reason.trim(),
        evidence,
      }, token);
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('disputeSubmitError'));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card border border-line shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/40 p-5 flex items-start justify-between shrink-0">
          <div>
            <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide">{t('disputeModalBadge')}</p>
            <h3 className="text-lg font-bold text-text mt-0.5 leading-tight line-clamp-2">
              {booking.listing?.title ?? t('cancelModalFallback')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors"
          >
            <i className="fa-solid fa-xmark text-sub text-sm" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="rounded-xl p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex gap-3">
            <i className="fa-solid fa-hourglass-half text-amber-500 mt-0.5 text-sm shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t('disputeWindowHint', { hours: hoursLeft })}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-sub mb-1.5">
              {t('disputeReasonLabel')}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder={t('disputeReasonPlaceholder')}
              className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-sub resize-none focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition"
            />
            <p className="text-right text-[11px] text-sub mt-1">{reason.length}/1000</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-sub mb-1.5">
              {t('disputeEvidenceLabel')}
            </label>
            <ImageUploadZone images={evidence} onChange={setEvidence} getToken={getToken} enableCrop={false} />
          </div>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-exclamation" />{error}
            </p>
          )}
        </div>

        {/* Boutons */}
        <div className="p-5 pt-0 flex gap-2 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-sub hover:bg-bg transition-colors"
          >
            {t('keepBtn')}
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting
              ? <><i className="fa-solid fa-spinner fa-spin" /> {t('sendingBtn')}</>
              : <><i className="fa-solid fa-paper-plane" /> {t('disputeSubmitBtn')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal avis ────────────────────────────────────────────── */
function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="text-3xl transition-transform hover:scale-110 focus:outline-none"
        >
          <i className={`fa-star ${(hovered || value) >= n ? 'fa-solid text-gold' : 'fa-regular text-line'}`} />
        </button>
      ))}
    </div>
  );
}

function ReviewModal({
  booking, onClose, onSuccess,
}: {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { getToken } = useAuth();
  const t = useTranslations('locataire');
  const [rating,     setRating]     = useState(0);
  const [comment,    setComment]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const RATING_LABELS = useMemo<Record<number, string>>(() => ({
    1: t('rating1'),
    2: t('rating2'),
    3: t('rating3'),
    4: t('rating4'),
    5: t('rating5'),
  }), [t]);

  const handleSubmit = async () => {
    if (rating === 0) { setError(t('selectRatingError')); return; }
    setSubmitting(true);
    setError(null);
    const token = await getToken();
    if (!token) { setSubmitting(false); return; }
    try {
      await api.post('/reviews', {
        bookingId: booking.id,
        listingId: booking.listingId,
        rating,
        comment: comment.trim() || undefined,
      }, token);
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('reviewSendError'));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card border border-line shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-gold to-gold-light p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-900/70 uppercase tracking-wide">{t('yourReview')}</p>
              <h3 className="text-lg font-bold text-gray-900 mt-0.5 leading-tight line-clamp-2">
                {booking.listing?.title ?? t('reviewModalFallback')}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="ml-3 shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors"
            >
              <i className="fa-solid fa-xmark text-gray-900 text-sm" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="p-5 space-y-5">

          {/* Étoiles */}
          <div className="flex flex-col items-center gap-2 py-2">
            <StarRating value={rating} onChange={setRating} />
            {rating > 0 && (
              <p className="text-sm font-semibold text-gold-dark">{RATING_LABELS[rating]}</p>
            )}
          </div>

          {/* Commentaire */}
          <div>
            <label className="block text-xs font-semibold text-sub mb-1.5">
              {t('commentLabel')} <span className="font-normal">{t('commentOptional')}</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={t('commentPlaceholder')}
              className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-sub resize-none focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition"
            />
            <p className="text-right text-[11px] text-sub mt-1">{comment.length}/2000</p>
          </div>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-exclamation" />{error}
            </p>
          )}

          {/* Boutons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-sub hover:bg-bg transition-colors"
            >
              {t('cancelBtn')}
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting || rating === 0}
              className="flex-1 rounded-xl bg-gold py-2.5 text-sm font-bold text-gray-900 hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting
                ? <><i className="fa-solid fa-spinner fa-spin" /> {t('sendingBtn')}</>
                : <><i className="fa-solid fa-paper-plane" /> {t('publishReviewBtn')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
