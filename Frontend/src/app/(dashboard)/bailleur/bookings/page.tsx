'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
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
  const t            = useTranslations('bailleur');

  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal]             = useState(0);

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Booking[]; total: number; page: number; limit: number }>(
        `/bookings/received?page=${currentPage}&limit=20`,
        token
      );
      setBookings(res.data);
      setTotal(res.total);
    } catch {
      setError(t('bookingsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [getToken, currentPage, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Nuitée : PENDING/CONFIRMED/CANCELLED/COMPLETED — Mensuel : REQUESTED/APPROVED/ACTIVE/REJECTED/TERMINATED
  const pending  = bookings.filter((b) => b.status === 'PENDING' || b.status === 'REQUESTED');
  const active   = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'APPROVED' || b.status === 'ACTIVE');
  const archived = bookings.filter((b) =>
    b.status === 'CANCELLED' || b.status === 'COMPLETED' || b.status === 'REJECTED' || b.status === 'TERMINATED');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">{t('bookingsTitle')}</h1>
        {!loading && !error && (
          <p className="mt-1 text-sm text-sub">
            {t('bookingsCount', { count: total })}
            {pending.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-gold-dark font-medium">
                <i className="fa-solid fa-circle text-[8px]" />
                {t('bookingsPending', { count: pending.length })}
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
            <i className="fa-solid fa-rotate-right mr-1.5" />{t('retry')}
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-calendar-check text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">{t('bookingsEmpty')}</p>
          <p className="mt-1 text-sm text-sub">{t('bookingsEmptyHint')}</p>
          <Link href="/publier" className="btn-gold mt-5 inline-flex items-center gap-2 text-sm">
            <i className="fa-solid fa-plus text-xs" />{t('bookingsPublish')}
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <Section title={t('sectionPending')} icon="fa-clock" accent="text-gold-dark"
              bookings={pending} onActionDone={fetchData} toast={toast} getToken={getToken} />
          )}
          {active.length > 0 && (
            <Section title={t('sectionConfirmed')} icon="fa-circle-check" accent="text-green-600"
              bookings={active} onActionDone={fetchData} toast={toast} getToken={getToken} />
          )}
          {archived.length > 0 && (
            <Section title={t('sectionArchived')} icon="fa-archive" accent="text-sub"
              bookings={archived} onActionDone={fetchData} toast={toast} getToken={getToken} />
          )}
        </div>
      )}

      {total > 20 && (
        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm text-sub">
            {t('pageOf', { page: currentPage, total: Math.ceil(total / 20) })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={currentPage === 1}
              className="border border-line bg-card text-sm px-4 py-2 rounded-xl disabled:opacity-50"
            >
              {t('previous')}
            </button>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage * 20 >= total}
              className="border border-line bg-card text-sm px-4 py-2 rounded-xl disabled:opacity-50"
            >
              {t('next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title, icon, accent, bookings, onActionDone, toast, getToken,
}: {
  title: string;
  icon: string;
  accent: string;
  bookings: Booking[];
  onActionDone: () => void;
  toast: ReturnType<typeof useToast>['toast'];
  getToken: () => Promise<string | null>;
}) {
  const router = useRouter();
  const t = useTranslations('bailleur');

  const contactTenant = async (listingId: string, tenantId: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      const room = await api.post<{ id: string }>(
        '/messages/rooms',
        { listingId, tenantId },
        token
      );
      router.push(`/bailleur/messages/${room.id}`);
    } catch {
      toast.error(t('contactError'));
    }
  };

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
              <button
                onClick={() => void contactTenant(booking.listingId, booking.tenantId)}
                className="text-xs font-medium text-gold-dark hover:underline mt-1 inline-flex items-center gap-1"
              >
                <i className="fa-solid fa-comment-dots text-xs" />
                {t('contactTenant')}
              </button>
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
