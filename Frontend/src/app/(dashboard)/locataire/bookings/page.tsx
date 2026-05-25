'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import type { Booking, BookingStatus } from '@/types';
import { formatDate, formatPrice } from '@/lib/utils';

export default function LocataireBookingsPage() {
  const { getToken } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const data = await api.get<Booking[]>('/bookings/mine', token);
    setBookings(data);
    setLoading(false);
  }, [getToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- triggers async data fetch, not direct setState
  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const pending   = bookings.filter((b) => b.status === 'PENDING');
  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED');
  const archived  = bookings.filter((b) => b.status === 'CANCELLED' || b.status === 'COMPLETED');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Mes réservations</h1>
        <p className="mt-1 text-sm text-sub">
          {bookings.length} réservation{bookings.length > 1 ? 's' : ''}
          {pending.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-gold-dark font-medium">
              <i className="fa-solid fa-circle text-[8px]" />
              {pending.length} en attente de paiement
            </span>
          )}
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-calendar-check text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">Aucune réservation</p>
          <p className="mt-1 text-sm text-sub">Vos réservations apparaîtront ici.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <Section
              title="En attente de paiement"
              icon="fa-clock"
              accent="text-gold-dark"
              bookings={pending}
              onRefresh={fetchBookings}
            />
          )}
          {confirmed.length > 0 && (
            <Section
              title="Confirmées"
              icon="fa-circle-check"
              accent="text-green-600"
              bookings={confirmed}
              onRefresh={fetchBookings}
            />
          )}
          {archived.length > 0 && (
            <Section
              title="Archivées"
              icon="fa-archive"
              accent="text-sub"
              bookings={archived}
              onRefresh={fetchBookings}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title, icon, accent, bookings, onRefresh,
}: {
  title: string;
  icon: string;
  accent: string;
  bookings: Booking[];
  onRefresh: () => void;
}) {
  return (
    <div>
      <h2 className={`flex items-center gap-2 text-sm font-semibold mb-3 ${accent}`}>
        <i className={`fa-solid ${icon} text-xs`} />
        {title} ({bookings.length})
      </h2>
      <div className="flex flex-col gap-3">
        {bookings.map((booking) => (
          <BookingCard key={booking.id} booking={booking} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  );
}

function BookingCard({ booking, onRefresh }: { booking: Booking; onRefresh: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-text truncate">
          {booking.listing?.title ?? booking.listingId}
        </p>
        <p className="text-sm text-sub mt-0.5">
          <i className="fa-regular fa-calendar text-gold-dark text-xs mr-1" />
          {formatDate(booking.startDate)}
          {booking.endDate ? ` → ${formatDate(booking.endDate)}` : ''}
          <span className="mx-1.5">·</span>
          <span className="font-medium text-text">{formatPrice(booking.totalAmount)}</span>
        </p>
      </div>
      <LocataireBookingActions bookingId={booking.id} status={booking.status} onRefresh={onRefresh} />
    </div>
  );
}

function LocataireBookingActions({
  bookingId,
  status,
  onRefresh,
}: {
  bookingId: string;
  status: BookingStatus;
  onRefresh: () => void;
}) {
  const { getToken } = useAuth();
  const [payLoading, setPayLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    const token = await getToken();
    if (!token) return;
    setPayLoading(true);
    setError(null);
    try {
      const { payment_url } = await api.post<{ payment_url: string }>(
        '/payments/initiate',
        { bookingId },
        token,
      );
      window.location.href = payment_url;
    } catch {
      setError('Erreur de paiement. Réessayez.');
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
      setError('Erreur. Réessayez.');
      setCancelLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      <div className="flex items-center gap-2">
        {status === 'PENDING' && (
          <>
            <button
              onClick={handlePay}
              disabled={payLoading}
              className="btn-gold text-xs py-1.5 px-3 disabled:opacity-50"
            >
              {payLoading ? (
                <i className="fa-solid fa-spinner fa-spin" />
              ) : (
                <><i className="fa-solid fa-credit-card text-xs" /> Payer</>
              )}
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelLoading}
              className="text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg py-1.5 px-3 transition-colors disabled:opacity-50"
            >
              {cancelLoading ? <i className="fa-solid fa-spinner fa-spin" /> : 'Annuler'}
            </button>
          </>
        )}
        {(status === 'CONFIRMED' || status === 'CANCELLED' || status === 'COMPLETED') && (
          <StatusChip status={status} />
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function StatusChip({ status }: { status: BookingStatus }) {
  const styles: Record<BookingStatus, string> = {
    CONFIRMED: 'bg-green-100 text-green-700',
    PENDING:   'bg-gold-pale text-gold-dark',
    CANCELLED: 'bg-red-100 text-red-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
  };
  const labels: Record<BookingStatus, string> = {
    CONFIRMED: 'Confirmée',
    PENDING:   'En attente',
    CANCELLED: 'Annulée',
    COMPLETED: 'Terminée',
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
