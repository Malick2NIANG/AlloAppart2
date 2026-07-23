'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import type { Booking, PaginatedResponse } from '@/types';
import { formatDate, formatPrice } from '@/lib/utils';
import { SkeletonListRow } from '@/components/ui/Skeleton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';

type StatusFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

const STATUS_LABELS: Record<string, string> = {
  PENDING:   'En attente',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Annulée',
  COMPLETED: 'Terminée',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-amber-50 text-amber-700 border border-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  CANCELLED: 'bg-card text-sub border border-line',
  COMPLETED: 'bg-green-100 text-green-700',
};

const ESCROW_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: 'Paiement attendu',
  HELD:             'Fonds en séquestre',
  RELEASED:         'Libéré au bailleur',
  REFUNDED:         'Remboursé',
};
const ESCROW_COLORS: Record<string, string> = {
  AWAITING_PAYMENT: 'bg-gray-50 text-gray-500 border border-gray-200',
  HELD:             'bg-amber-50 text-amber-700 border border-amber-300',
  RELEASED:         'bg-emerald-50 text-emerald-700 border border-emerald-200',
  REFUNDED:         'bg-blue-50 text-blue-700 border border-blue-200',
};
const ESCROW_ICONS: Record<string, string> = {
  AWAITING_PAYMENT: 'fa-clock',
  HELD:             'fa-lock',
  RELEASED:         'fa-lock-open',
  REFUNDED:         'fa-rotate-left',
};

type PaymentModal = { id: string; action: 'release' | 'refund'; amount: string | number };

export default function AdminBookingsPage() {
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const [bookings, setBookings]         = useState<Booking[]>([]);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [actionId, setActionId]         = useState<string | null>(null);
  const [cancelModal, setCancelModal]   = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<PaymentModal | null>(null);
  const [limit, setLimit]               = useState(20);
  const LIMIT_OPTIONS = [10, 20, 50] as const;

  const fetchData = useCallback(async (p: number, s: StatusFilter, lim = limit) => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(lim) });
      if (s !== 'ALL') params.set('status', s);
      const res = await api.get<PaginatedResponse<Booking>>(`/bookings/all?${params}`, token);
      setBookings(res.data);
      setTotal(res.total);
    } catch {
      setError('Impossible de charger les réservations.');
    } finally {
      setLoading(false);
    }
  }, [getToken, limit]);

  useEffect(() => { fetchData(page, statusFilter); }, [fetchData, page, statusFilter]);

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
      toast.success('Réservation annulée');
    } catch {
      toast.error('Erreur lors de l\'annulation.');
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
      toast.success(action === 'release' ? 'Fonds libérés au bailleur ✓' : 'Remboursement effectué ✓');
    } catch {
      toast.error(action === 'release' ? 'Erreur lors de la libération.' : 'Erreur lors du remboursement.');
    } finally { setActionId(null); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Toutes les réservations</h1>
        <p className="mt-1 text-sm text-sub">{total} réservation{total > 1 ? 's' : ''}</p>
      </div>

      {/* Filtres */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
          className="rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-gold"
        >
          <option value="ALL">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="CONFIRMED">Confirmées</option>
          <option value="COMPLETED">Terminées</option>
          <option value="CANCELLED">Annulées</option>
        </select>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-sub whitespace-nowrap">Lignes :</span>
          <div className="flex gap-1">
            {LIMIT_OPTIONS.map((l) => (
              <button key={l} onClick={() => { setLimit(l); setPage(1); void fetchData(1, statusFilter, l); }}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${limit === l ? 'bg-gold-dark text-white' : 'border border-line bg-bg text-sub hover:text-text'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonListRow key={i} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
          <p className="text-sm text-sub">{error}</p>
          <button onClick={() => void fetchData(page, statusFilter)} className="mt-4 btn-gold text-sm">
            <i className="fa-solid fa-rotate-right mr-1.5" />Réessayer
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-calendar-check text-2xl text-gold-dark" />
          </div>
          <p className="text-sub">Aucune réservation trouvée.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {bookings.map((booking) => {
            const escrow = booking.escrowStatus ?? 'AWAITING_PAYMENT';
            const isHeld = escrow === 'HELD';
            return (
              <div key={booking.id} className="rounded-xl border border-line bg-card p-4 flex flex-col gap-3">
                {/* Ligne principale */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text truncate">
                      {booking.listing?.title ?? booking.listingId}
                    </p>
                    <p className="text-sm text-sub mt-0.5">
                      <i className="fa-solid fa-location-dot text-gold-dark text-xs mr-1" />
                      {booking.listing?.city}
                      <span className="mx-1.5">·</span>
                      <i className="fa-solid fa-user text-xs mr-1" />
                      {booking.tenant?.firstName} {booking.tenant?.lastName}
                    </p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-sub">
                      <span>
                        <i className="fa-regular fa-calendar mr-1" />
                        {formatDate(booking.startDate)}
                        {booking.endDate && <> → {formatDate(booking.endDate)}</>}
                      </span>
                      <span className="font-semibold text-text">{formatPrice(booking.totalAmount)}</span>
                      {booking.paymentRef && (
                        <span className="font-mono text-[10px] text-sub">{booking.paymentRef}</span>
                      )}
                    </div>
                  </div>

                  {/* Badges statuts */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[booking.status] ?? 'bg-card text-sub'}`}>
                      {STATUS_LABELS[booking.status] ?? booking.status}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${ESCROW_COLORS[escrow] ?? 'bg-card text-sub border border-line'}`}>
                      <i className={`fa-solid ${ESCROW_ICONS[escrow] ?? 'fa-circle'} text-[10px]`} />
                      {ESCROW_LABELS[escrow] ?? escrow}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {((booking.status === 'PENDING' || booking.status === 'CONFIRMED') || isHeld) && (
                  <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-line">
                    {/* Annuler réservation */}
                    {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
                      <button
                        onClick={() => setCancelModal(booking.id)}
                        disabled={actionId !== null}
                        className="text-xs font-medium border border-red-200 bg-red-50 text-red-700 rounded-lg px-3 py-1.5 hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        {actionId === booking.id + 'cancel'
                          ? <i className="fa-solid fa-spinner fa-spin" />
                          : <><i className="fa-solid fa-xmark text-xs mr-1" />Annuler réservation</>}
                      </button>
                    )}

                    {/* Libérer les fonds — séquestre HELD */}
                    {isHeld && (
                      <button
                        onClick={() => setPaymentModal({ id: booking.id, action: 'release', amount: booking.totalAmount })}
                        disabled={actionId !== null}
                        className="text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg px-3 py-1.5 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                      >
                        {actionId === booking.id + 'release'
                          ? <i className="fa-solid fa-spinner fa-spin" />
                          : <><i className="fa-solid fa-lock-open text-xs mr-1" />Libérer au bailleur</>}
                      </button>
                    )}

                    {/* Rembourser le locataire — séquestre HELD */}
                    {isHeld && (
                      <button
                        onClick={() => setPaymentModal({ id: booking.id, action: 'refund', amount: booking.totalAmount })}
                        disabled={actionId !== null}
                        className="text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700 rounded-lg px-3 py-1.5 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                      >
                        {actionId === booking.id + 'refund'
                          ? <i className="fa-solid fa-spinner fa-spin" />
                          : <><i className="fa-solid fa-rotate-left text-xs mr-1" />Rembourser locataire</>}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text disabled:pointer-events-none disabled:opacity-40">
            <i className="fa-solid fa-chevron-left text-xs" /> Précédent
          </button>
          <span className="text-sm text-sub">Page {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text disabled:pointer-events-none disabled:opacity-40">
            Suivant <i className="fa-solid fa-chevron-right text-xs" />
          </button>
        </div>
      )}

      {/* Modal annulation réservation */}
      <ConfirmModal
        open={cancelModal !== null}
        onClose={() => setCancelModal(null)}
        onConfirm={() => void handleCancel()}
        title="Annuler cette réservation ?"
        description="Cette action est irréversible. Le statut passera à Annulée."
        confirmLabel="Annuler la réservation"
        variant="danger"
      />

      {/* Modal libération fonds */}
      <ConfirmModal
        open={paymentModal?.action === 'release'}
        onClose={() => setPaymentModal(null)}
        onConfirm={() => void handlePaymentAction()}
        title="Libérer les fonds au bailleur ?"
        description={`Les fonds (${paymentModal ? formatPrice(paymentModal.amount) : ''}) seront transférés au bailleur. Cette action est irréversible.`}
        confirmLabel="Confirmer la libération"
        variant="default"
      />

      {/* Modal remboursement */}
      <ConfirmModal
        open={paymentModal?.action === 'refund'}
        onClose={() => setPaymentModal(null)}
        onConfirm={() => void handlePaymentAction()}
        title="Rembourser le locataire ?"
        description={`Les fonds (${paymentModal ? formatPrice(paymentModal.amount) : ''}) seront remboursés au locataire. Cette action est irréversible.`}
        confirmLabel="Confirmer le remboursement"
        variant="danger"
      />
    </div>
  );
}
