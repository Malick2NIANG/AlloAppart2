'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Booking, BookingStatus, PaginatedResponse } from '@/types';
import { formatDate, formatPrice } from '@/lib/utils';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import { BookingCard } from '@/components/bookings/BookingCard';
import { StatFilterCard } from '@/components/bookings/StatFilterCard';
import { BookingSearchRow } from '@/components/bookings/BookingSearchRow';
import { BookingPagination } from '@/components/bookings/BookingPagination';
import { PENDING_STATUSES, ACTIVE_STATUSES, ARCHIVED_STATUSES } from '@/lib/bookingStatus';

type Group = 'pending' | 'confirmed' | 'archived';

// Même regroupement que les pages locataire/bailleur, envoyé au backend en
// param `status` (liste séparée par des virgules) — la pagination reste
// côté serveur ici (contrairement aux 2 autres rôles) car cette page couvre
// TOUTES les réservations de la plateforme, un volume potentiellement bien
// plus grand qu'un seul locataire ou bailleur.
const GROUP_STATUSES: Record<Group, BookingStatus[]> = {
  pending: PENDING_STATUSES,
  confirmed: ACTIVE_STATUSES,
  archived: ARCHIVED_STATUSES,
};

const ESCROW_COLORS: Record<string, string> = {
  AWAITING_PAYMENT: 'bg-gray-50 dark:bg-gray-950/30 text-gray-500 border border-gray-200 dark:border-gray-900/40',
  HELD:             'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-300',
  DISPUTED:         'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-300',
  RELEASED:         'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40',
  REFUNDED:         'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40',
};
const ESCROW_ICONS: Record<string, string> = {
  AWAITING_PAYMENT: 'fa-clock',
  HELD:             'fa-lock',
  DISPUTED:         'fa-triangle-exclamation',
  RELEASED:         'fa-lock-open',
  REFUNDED:         'fa-rotate-left',
};

const LIMIT_OPTIONS = [10, 20, 50] as const;

type PaymentModal = { id: string; action: 'release' | 'refund'; amount: string | number };
type DisputeModal  = { id: string; decision: 'RELEASE' | 'REFUND'; amount: string | number };

export default function AdminBookingsPage() {
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const t            = useTranslations('admin');

  const [bookings, setBookings]         = useState<Booking[]>([]);
  const [total, setTotal]               = useState(0);
  // Compte par groupe (respecte la recherche, pas l'onglet actif) — alimente
  // à la fois le total de l'en-tête et la valeur affichée sur chaque
  // StatFilterCard, qui sert aussi de bouton de filtre (pattern introduit
  // sur la page Signalements, repris ici pour les 3 groupes de statuts).
  const [groupCounts, setGroupCounts]   = useState<Record<Group, number>>({ pending: 0, confirmed: 0, archived: 0 });
  const [page, setPage]                 = useState(1);
  const [group, setGroup]               = useState<Group>('pending');
  const [search, setSearch]             = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [actionId, setActionId]         = useState<string | null>(null);
  const [cancelModal, setCancelModal]   = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<PaymentModal | null>(null);
  const [disputeModal, setDisputeModal] = useState<DisputeModal | null>(null);
  const [limit, setLimit]               = useState<typeof LIMIT_OPTIONS[number]>(20);

  // Débounce de la recherche — évite une requête serveur à chaque frappe.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const fetchData = useCallback(async (p: number, g: Group, s: string, lim: number) => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(lim),
        status: GROUP_STATUSES[g].join(','),
      });
      if (s) params.set('search', s);
      const res = await api.get<PaginatedResponse<Booking>>(`/bookings/all?${params}`, token);
      setBookings(res.data);
      setTotal(res.total);
    } catch {
      setError(t('bookingsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [getToken, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch initial/pagination, setState après résolution async
  useEffect(() => { fetchData(page, group, debouncedSearch, limit); }, [fetchData, page, group, debouncedSearch, limit]);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const groups = Object.keys(GROUP_STATUSES) as Group[];
        const entries = await Promise.all(groups.map(async (g) => {
          const params = new URLSearchParams({ page: '1', limit: '1', status: GROUP_STATUSES[g].join(',') });
          if (debouncedSearch) params.set('search', debouncedSearch);
          const res = await api.get<PaginatedResponse<Booking>>(`/bookings/all?${params}`, token);
          return [g, res.total] as const;
        }));
        setGroupCounts(Object.fromEntries(entries) as Record<Group, number>);
      } catch {
        // Purement informatif (cartes stats + en-tête) — une erreur ici ne
        // doit pas bloquer le reste de la page, déjà couvert par fetchData.
      }
    })();
  }, [getToken, debouncedSearch]);

  const switchGroup = (g: Group) => {
    setGroup(g);
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    const id = cancelModal;
    const token = await getToken();
    if (!token) return;
    setActionId(id + 'cancel');
    try {
      await api.patch(`/bookings/${id}/cancel`, {}, token);
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: 'CANCELLED' } : b));
      setCancelModal(null);
      toast.success(t('toastBookingCancelled'));
    } catch {
      toast.error(t('errCancel'));
    } finally { setActionId(null); }
  };

  const handlePaymentAction = async () => {
    if (!paymentModal) return;
    const { id, action } = paymentModal;
    const token = await getToken();
    if (!token) return;
    setActionId(id + action);
    try {
      await api.post(`/payments/${action}/${id}`, {}, token);
      const newStatus = action === 'release' ? 'RELEASED' : 'REFUNDED';
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, escrowStatus: newStatus } : b));
      setPaymentModal(null);
      toast.success(action === 'release' ? t('toastFundsReleased') : t('toastRefunded'));
    } catch {
      toast.error(action === 'release' ? t('errRelease') : t('errRefund'));
    } finally { setActionId(null); }
  };

  const handleResolveDispute = async () => {
    if (!disputeModal) return;
    const { id, decision } = disputeModal;
    const token = await getToken();
    if (!token) return;
    setActionId(id + 'dispute');
    try {
      await api.patch(`/bookings/${id}/resolve-dispute`, { decision }, token);
      setBookings((prev) => prev.map((b) => b.id === id
        ? {
            ...b,
            escrowStatus: decision === 'RELEASE' ? 'RELEASED' : 'REFUNDED',
            status: decision === 'RELEASE' ? 'COMPLETED' : 'CANCELLED',
          }
        : b));
      setDisputeModal(null);
      toast.success(t('toastDisputeResolved'));
      // Rafraîchit immédiatement le badge sidebar "Réservations / Litiges"
      // (DashboardShell) sans attendre un reload — même onglet uniquement.
      window.dispatchEvent(new CustomEvent('aa-badges-updated', { detail: { kind: 'DISPUTES' } }));
    } catch {
      toast.error(t('errResolveDispute'));
    } finally { setActionId(null); }
  };

  const totalPages = Math.ceil(total / limit);
  const grandTotal = groupCounts.pending + groupCounts.confirmed + groupCounts.archived;
  const GROUP_CARDS: { key: Group; label: string; icon: string; color: string; bg: string }[] = [
    { key: 'pending',   label: t('sectionPending'),   icon: 'fa-clock',         color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/30' },
    { key: 'confirmed', label: t('sectionConfirmed'), icon: 'fa-circle-check', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { key: 'archived',  label: t('sectionArchived'),  icon: 'fa-box-archive',  color: 'text-sub',                              bg: 'bg-card' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">{t('bookingsTitle')}</h1>
        <p className="mt-1 text-sm text-sub">{t('bookingsCount', { count: grandTotal })}</p>
      </div>

      {/* Stats par statut — doublent aussi de filtre cliquable (même pattern
          que les 3 cartes de la page Signalements). */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {GROUP_CARDS.map((card) => (
          <StatFilterCard
            key={card.key}
            icon={card.icon}
            label={card.label}
            value={groupCounts[card.key]}
            color={card.color}
            bg={card.bg}
            active={group === card.key}
            onClick={() => switchGroup(card.key)}
            selectedLabel={t('filterSelected')}
          />
        ))}
      </div>

      {/* Recherche + lignes par page */}
      <BookingSearchRow
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t('searchPlaceholder')}
        perPage={limit}
        onPerPageChange={(n) => { setLimit(n as typeof LIMIT_OPTIONS[number]); setPage(1); }}
        perPageOptions={LIMIT_OPTIONS}
        rowsLabel={t('rowsLabel')}
      />

      {/* Liste */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} height="280px" />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
          <p className="text-sm text-sub">{error}</p>
          <button onClick={() => void fetchData(page, group, debouncedSearch, limit)} className="mt-4 btn-gold text-sm">
            <i className="fa-solid fa-rotate-right mr-1.5" />{t('retry')}
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-calendar-check text-2xl text-gold-dark" />
          </div>
          <p className="text-sub">{debouncedSearch ? t('noSearchResults') : t('bookingsEmpty')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {bookings.map((booking) => (
              <AdminBookingCard
                key={booking.id}
                booking={booking}
                actionId={actionId}
                onCancel={() => setCancelModal(booking.id)}
                onRelease={() => setPaymentModal({ id: booking.id, action: 'release', amount: booking.totalAmount })}
                onRefund={() => setPaymentModal({ id: booking.id, action: 'refund', amount: booking.totalAmount })}
                onResolveRelease={() => setDisputeModal({ id: booking.id, decision: 'RELEASE', amount: booking.totalAmount })}
                onResolveRefund={() => setDisputeModal({ id: booking.id, decision: 'REFUND', amount: booking.totalAmount })}
              />
            ))}
          </div>

          {/* Pagination */}
          <BookingPagination
            page={page}
            pageCount={totalPages}
            onPageChange={setPage}
            previousLabel={t('previous')}
            nextLabel={t('next')}
            pageOfLabel={t('pageOf', { page, total: totalPages })}
          />
        </>
      )}

      {/* Modal annulation réservation */}
      <ConfirmModal
        open={cancelModal !== null}
        onClose={() => setCancelModal(null)}
        onConfirm={() => void handleCancel()}
        title={t('confirmCancelBookingTitle')}
        description={t('confirmCancelBookingDesc')}
        confirmLabel={t('confirmCancelBookingLabel')}
        variant="danger"
      />

      {/* Modal libération fonds */}
      <ConfirmModal
        open={paymentModal?.action === 'release'}
        onClose={() => setPaymentModal(null)}
        onConfirm={() => void handlePaymentAction()}
        title={t('confirmReleaseTitle')}
        description={t('confirmReleaseDesc', { amount: paymentModal ? formatPrice(paymentModal.amount) : '' })}
        confirmLabel={t('confirmReleaseLabel')}
        variant="default"
      />

      {/* Modal remboursement */}
      <ConfirmModal
        open={paymentModal?.action === 'refund'}
        onClose={() => setPaymentModal(null)}
        onConfirm={() => void handlePaymentAction()}
        title={t('confirmRefundTitle')}
        description={t('confirmRefundDesc', { amount: paymentModal ? formatPrice(paymentModal.amount) : '' })}
        confirmLabel={t('confirmRefundLabel')}
        variant="danger"
      />

      {/* Modal résolution litige — libération */}
      <ConfirmModal
        open={disputeModal?.decision === 'RELEASE'}
        onClose={() => setDisputeModal(null)}
        onConfirm={() => void handleResolveDispute()}
        title={t('confirmResolveReleaseTitle')}
        description={t('confirmResolveReleaseDesc', { amount: disputeModal ? formatPrice(disputeModal.amount) : '' })}
        confirmLabel={t('confirmResolveReleaseLabel')}
        variant="default"
      />

      {/* Modal résolution litige — remboursement */}
      <ConfirmModal
        open={disputeModal?.decision === 'REFUND'}
        onClose={() => setDisputeModal(null)}
        onConfirm={() => void handleResolveDispute()}
        title={t('confirmResolveRefundTitle')}
        description={t('confirmResolveRefundDesc', { amount: disputeModal ? formatPrice(disputeModal.amount) : '' })}
        confirmLabel={t('confirmResolveRefundLabel')}
        variant="danger"
      />
    </div>
  );
}

/* ─── Carte réservation admin (coquille partagée + slots admin) ── */
function AdminBookingCard({
  booking, actionId, onCancel, onRelease, onRefund, onResolveRelease, onResolveRefund,
}: {
  booking: Booking;
  actionId: string | null;
  onCancel: () => void;
  onRelease: () => void;
  onRefund: () => void;
  onResolveRelease: () => void;
  onResolveRefund: () => void;
}) {
  const t = useTranslations('admin');
  const escrow = booking.escrowStatus ?? 'AWAITING_PAYMENT';
  const isHeld = escrow === 'HELD';
  const isDisputed = escrow === 'DISPUTED';

  const ESCROW_LABELS: Record<string, string> = {
    AWAITING_PAYMENT: t('escrowAwaiting'),
    HELD:             t('escrowHeld'),
    DISPUTED:         t('escrowDisputed'),
    RELEASED:         t('escrowReleased'),
    REFUNDED:         t('escrowRefunded'),
  };

  return (
    <BookingCard
      booking={booking}
      subtitle={
        <>
          <p className="text-sm text-sub mt-1">
            <i className="fa-solid fa-location-dot text-gold-dark text-xs mr-1" />
            {booking.listing?.city}
            <span className="mx-1.5">·</span>
            <i className="fa-solid fa-user text-xs mr-1" />
            {booking.tenant?.firstName} {booking.tenant?.lastName}
          </p>
          {booking.paymentRef && (
            <p className="font-mono text-[10px] text-sub mt-1">{booking.paymentRef}</p>
          )}
          <div className="mt-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 ${ESCROW_COLORS[escrow] ?? 'bg-card text-sub border border-line'}`}>
              <i className={`fa-solid ${ESCROW_ICONS[escrow] ?? 'fa-circle'} text-[10px]`} />
              {ESCROW_LABELS[escrow] ?? escrow}
            </span>
          </div>
        </>
      }
      actions={
        ((booking.status === 'PENDING' || booking.status === 'CONFIRMED') || isHeld || isDisputed) && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Annuler réservation */}
            {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && !isDisputed && (
              <button
                onClick={onCancel}
                disabled={actionId !== null}
                className="text-xs font-medium border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg px-3 py-1.5 hover:bg-red-100 dark:hover:bg-red-950/40 disabled:opacity-50 transition-colors"
              >
                {actionId === booking.id + 'cancel'
                  ? <i className="fa-solid fa-spinner fa-spin" />
                  : <><i className="fa-solid fa-xmark text-xs mr-1" />{t('cancelBooking')}</>}
              </button>
            )}

            {/* Résoudre le litige — séquestre DISPUTED */}
            {isDisputed && (
              <>
                <button
                  onClick={onResolveRelease}
                  disabled={actionId !== null}
                  className="text-xs font-medium border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg px-3 py-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 disabled:opacity-50 transition-colors"
                >
                  {actionId === booking.id + 'dispute'
                    ? <i className="fa-solid fa-spinner fa-spin" />
                    : <><i className="fa-solid fa-lock-open text-xs mr-1" />{t('resolveDisputeRelease')}</>}
                </button>
                <button
                  onClick={onResolveRefund}
                  disabled={actionId !== null}
                  className="text-xs font-medium border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-lg px-3 py-1.5 hover:bg-blue-100 dark:hover:bg-blue-950/40 disabled:opacity-50 transition-colors"
                >
                  {actionId === booking.id + 'dispute'
                    ? <i className="fa-solid fa-spinner fa-spin" />
                    : <><i className="fa-solid fa-rotate-left text-xs mr-1" />{t('resolveDisputeRefund')}</>}
                </button>
              </>
            )}

            {/* Libérer les fonds / rembourser — séquestre HELD */}
            {isHeld && (
              <>
                <button
                  onClick={onRelease}
                  disabled={actionId !== null}
                  className="text-xs font-medium border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg px-3 py-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 disabled:opacity-50 transition-colors"
                >
                  {actionId === booking.id + 'release'
                    ? <i className="fa-solid fa-spinner fa-spin" />
                    : <><i className="fa-solid fa-lock-open text-xs mr-1" />{t('releaseFunds')}</>}
                </button>
                <button
                  onClick={onRefund}
                  disabled={actionId !== null}
                  className="text-xs font-medium border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-lg px-3 py-1.5 hover:bg-blue-100 dark:hover:bg-blue-950/40 disabled:opacity-50 transition-colors"
                >
                  {actionId === booking.id + 'refund'
                    ? <i className="fa-solid fa-spinner fa-spin" />
                    : <><i className="fa-solid fa-rotate-left text-xs mr-1" />{t('refundTenant')}</>}
                </button>
              </>
            )}
          </div>
        )
      }
      footer={
        isDisputed && (
          <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-3 flex flex-col gap-2">
            {booking.disputedAt && (
              <p className="text-xs text-red-700 dark:text-red-400 font-medium">
                <i className="fa-solid fa-triangle-exclamation mr-1" />
                {t('disputedSince', { date: formatDate(booking.disputedAt) })}
              </p>
            )}
            {booking.disputeReason && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
                  {t('disputeReasonLabel')}
                </p>
                <p className="text-sm text-text mt-0.5 whitespace-pre-wrap">{booking.disputeReason}</p>
              </div>
            )}
            {booking.disputeEvidence && booking.disputeEvidence.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-400 mb-1">
                  {t('disputeEvidenceLabel')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {booking.disputeEvidence.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="block h-16 w-16 overflow-hidden rounded-lg border border-line bg-bg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      }
    />
  );
}
