import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import type { Booking } from '@/types';
import { formatDate, formatPrice } from '@/lib/utils';
import BookingActions from './BookingActions';

export default async function BailleurBookingsPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect('/sign-in');
  const token = await getToken();

  const bookings = await api.get<Booking[]>('/bookings/received', token ?? undefined);

  const pending   = bookings.filter((b) => b.status === 'PENDING');
  const active    = bookings.filter((b) => b.status === 'CONFIRMED');
  const archived  = bookings.filter((b) => b.status === 'CANCELLED' || b.status === 'COMPLETED');

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Réservations reçues</h1>
        <p className="mt-1 text-sm text-sub">
          {bookings.length} réservation{bookings.length > 1 ? 's' : ''}
          {pending.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-gold-dark font-medium">
              <i className="fa-solid fa-circle text-[8px]" />
              {pending.length} en attente
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
          <p className="mt-1 text-sm text-sub">Les demandes de vos locataires apparaîtront ici.</p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* En attente */}
          {pending.length > 0 && (
            <Section title="En attente" icon="fa-clock" accent="text-gold-dark" bookings={pending} />
          )}

          {/* Confirmées */}
          {active.length > 0 && (
            <Section title="Confirmées" icon="fa-circle-check" accent="text-green-600" bookings={active} />
          )}

          {/* Archivées */}
          {archived.length > 0 && (
            <Section title="Archivées" icon="fa-archive" accent="text-sub" bookings={archived} />
          )}

        </div>
      )}
    </div>
  );
}

function Section({
  title, icon, accent, bookings,
}: {
  title: string;
  icon: string;
  accent: string;
  bookings: Booking[];
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
            {/* Infos */}
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

            {/* Actions */}
            <BookingActions bookingId={booking.id} status={booking.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
