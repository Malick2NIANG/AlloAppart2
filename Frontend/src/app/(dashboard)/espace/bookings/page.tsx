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

export default function AdminBookingsPage() {
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [actionId, setActionId]   = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<string | null>(null);
  const [limit, setLimit]         = useState(20);
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
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: 'CANCELLED' } : b)),
      );
      setCancelModal(null);
      toast.success('Réservation annulée');
    } catch {
      toast.error('Erreur lors de l\'annulation.');
    } finally { setActionId(null); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Toutes les réservations</h1>
        <p className="mt-1 text-sm text-sub">{total} réservation{total > 1 ? 's' : ''}</p>
      </div>

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
              <button key={l} onClick={() => { setLimit(l); setPage(1); fetchData(1, statusFilter, l); }}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${limit === l ? 'bg-gold-dark text-white' : 'border border-line bg-bg text-sub hover:text-text'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonListRow key={i} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
          <p className="text-sm text-sub">{error}</p>
          <button onClick={() => fetchData(page, statusFilter)} className="mt-4 btn-gold text-sm">
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
          {bookings.map((booking) => (
            <div key={booking.id} className="rounded-xl border border-line bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                  <span className="font-medium text-text">{formatPrice(booking.totalAmount)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[booking.status] ?? 'bg-card text-sub'}`}>
                  {STATUS_LABELS[booking.status] ?? booking.status}
                </span>
                {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
                  <button
                    onClick={() => setCancelModal(booking.id)}
                    disabled={actionId !== null}
                    className="text-xs font-medium border border-red-200 bg-red-50 text-red-700 rounded-lg px-3 py-1.5 hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    {actionId === booking.id + 'cancel'
                      ? <i className="fa-solid fa-spinner fa-spin" />
                      : <><i className="fa-solid fa-xmark text-xs mr-1" />Annuler</>}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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

      <ConfirmModal
        open={cancelModal !== null}
        onClose={() => setCancelModal(null)}
        onConfirm={handleCancel}
        title="Annuler cette réservation ?"
        description="Cette action est irréversible."
        confirmLabel="Annuler la réservation"
        variant="danger"
      />
    </div>
  );
}
