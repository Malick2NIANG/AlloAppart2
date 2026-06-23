'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Booking, BookingStatus } from '@/types';
import { formatDate, formatPrice } from '@/lib/utils';
import { SkeletonListRow } from '@/components/ui/Skeleton';

export default function LocataireBookingsPage() {
  const { getToken } = useAuth();
  const [bookings,    setBookings]    = useState<Booking[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [hasBailleur, setHasBailleur] = useState(true); // optimistic — hide banner until confirmed

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      const [data, me] = await Promise.all([
        api.get<Booking[]>('/bookings/mine', token),
        api.get<{ roles: string[] }>('/auth/me', token),
      ]);
      setBookings(data);
      setHasBailleur(me.roles.some((r) => ['BAILLEUR', 'PRO_AGENCE', 'ADMIN'].includes(r)));
    } catch {
      setError('Impossible de charger vos réservations.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- triggers async data fetch, not direct setState
  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const pending   = bookings.filter((b) => b.status === 'PENDING');
  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED');
  const archived  = bookings.filter((b) => b.status === 'CANCELLED' || b.status === 'COMPLETED');

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonListRow key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
        <p className="text-sm text-sub">{error}</p>
        <button onClick={() => void fetchBookings()} className="mt-4 btn-gold text-sm">
          <i className="fa-solid fa-rotate-right mr-1.5" />Réessayer
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
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

      {!hasBailleur && (
        <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-gold/30 bg-gold-pale p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/20">
              <i className="fa-solid fa-house text-gold-dark" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Vous avez un bien à louer ?</p>
              <p className="text-xs text-sub">Publiez gratuitement — commission uniquement à la signature du bail</p>
            </div>
          </div>
          <Link href="/become-bailleur"
            className="btn-gold shrink-0 justify-center rounded-full px-5 py-2 text-xs font-bold sm:w-auto">
            Devenir bailleur
          </Link>
        </div>
      )}

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
  const [payLoading,    setPayLoading]    = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [pdfLoading,    setPdfLoading]    = useState(false);
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
      if (!res.ok) throw new Error('Erreur');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `recu-${bookingId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Impossible de télécharger le reçu.');
    } finally {
      setPdfLoading(false);
    }
  };

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
        {(status === 'CONFIRMED' || status === 'COMPLETED') && (
          <button
            onClick={() => void handleDownloadPdf()}
            disabled={pdfLoading}
            className="text-xs font-medium text-sub hover:text-gold-dark border border-line hover:border-gold/40 rounded-lg py-1.5 px-3 transition-colors disabled:opacity-50"
            title="Telecharger le recu PDF"
          >
            {pdfLoading
              ? <i className="fa-solid fa-spinner fa-spin" />
              : <><i className="fa-solid fa-file-pdf mr-1" />Recu</>}
          </button>
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
    CONFIRMED: 'Confirmee',
    PENDING:   'En attente',
    CANCELLED: 'Annulee',
    COMPLETED: 'Terminee',
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
