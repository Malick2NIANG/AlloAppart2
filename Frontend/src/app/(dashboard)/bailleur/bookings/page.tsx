'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import type { Booking } from '@/types';
import { formatDate, formatPrice } from '@/lib/utils';
import Link from 'next/link';
import { SkeletonListRow } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import BookingActions from './BookingActions';

export default function BailleurBookingsPage() {
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Booking[]>('/bookings/received', token);
      setBookings(data);
    } catch {
      setError('Impossible de charger les réservations.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pending  = bookings.filter((b) => b.status === 'PENDING');
  const active   = bookings.filter((b) => b.status === 'CONFIRMED');
  const archived = bookings.filter((b) => b.status === 'CANCELLED' || b.status === 'COMPLETED');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Réservations reçues</h1>
        {!loading && !error && (
          <p className="mt-1 text-sm text-sub">
            {bookings.length} réservation{bookings.length > 1 ? 's' : ''}
            {pending.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-gold-dark font-medium">
                <i className="fa-solid fa-circle text-[8px]" />
                {pending.length} en attente
              </span>
            )}
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonListRow key={i} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
          <p className="text-sm text-sub">{error}</p>
          <button onClick={fetchData} className="mt-4 btn-gold text-sm">
            <i className="fa-solid fa-rotate-right mr-1.5" />Réessayer
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-calendar-check text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">Aucune réservation reçue</p>
          <p className="mt-1 text-sm text-sub">Les demandes de vos locataires apparaîtront ici.</p>
          <Link href="/publier" className="btn-gold mt-5 inline-flex items-center gap-2 text-sm">
            <i className="fa-solid fa-plus text-xs" />Publier une annonce
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <Section title="En attente" icon="fa-clock" accent="text-gold-dark"
              bookings={pending} onActionDone={fetchData} toast={toast} />
          )}
          {active.length > 0 && (
            <Section title="Confirmées" icon="fa-circle-check" accent="text-green-600"
              bookings={active} onActionDone={fetchData} toast={toast} />
          )}
          {archived.length > 0 && (
            <Section title="Archivées" icon="fa-archive" accent="text-sub"
              bookings={archived} onActionDone={fetchData} toast={toast} />
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title, icon, accent, bookings, onActionDone, toast,
}: {
  title: string;
  icon: string;
  accent: string;
  bookings: Booking[];
  onActionDone: () => void;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  return (
    <div>
      <h2 className={`flex items-center gap-2 text-sm font-semibold mb-3 ${accent}`}>
        <i className={`fa-solid ${icon} text-xs`} />
        {title} ({bookings.length})
      </h2>
      <div className="flex flex-col gap-3">
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className="rounded-xl border border-line bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="font-semibold text-text truncate">
                {booking.listing?.title ?? booking.listingId}
              </p>
              <p className="text-sm text-sub mt-0.5">
                <i className="fa-regular fa-calendar text-gold-dark text-xs mr-1" />
                {formatDate(booking.startDate)}
                {booking.endDate ? ` → ${formatDate(booking.endDate)}` : ''}
                {' · '}
                <span className="font-medium text-text">{formatPrice(booking.totalAmount)}</span>
              </p>
              <p className="text-sm text-sub mt-0.5">
                <i className="fa-solid fa-user text-xs text-gold-dark mr-1" />
                {booking.tenant?.firstName} {booking.tenant?.lastName}
              </p>
            </div>
            <BookingActions
              bookingId={booking.id}
              status={booking.status}
              onActionDone={onActionDone}
              toast={toast}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
