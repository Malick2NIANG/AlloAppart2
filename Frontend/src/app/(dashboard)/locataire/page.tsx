'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Booking {
  id: string;
  status: string;
  startDate: string;
  endDate?: string | null;
  totalAmount: string | number;
  listing: { title: string; city: string };
}

interface Stats {
  totalBookings: number;
  activeBookings: number;
  favorites: number;
  unreadMessages: number;
}

export default function LocataireDashboardPage() {
  const { getToken } = useAuth();
  const t = useTranslations('locataire');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [loading, setLoading]   = useState(true);

  const BOOKING_STATUS_LABEL = useMemo<Record<string, { label: string; color: string }>>(() => ({
    PENDING:   { label: t('statusPending'),   color: 'text-amber-600 bg-amber-50 border-amber-200'       },
    CONFIRMED: { label: t('statusConfirmed'), color: 'text-blue-600 bg-blue-50 border-blue-200'          },
    COMPLETED: { label: t('statusCompleted'), color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    CANCELLED: { label: t('statusCancelled'), color: 'text-red-600 bg-red-50 border-red-200'             },
  }), [t]);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const [bkRes, stRes] = await Promise.allSettled([
          api.get<Booking[]>('/bookings/mine', token),
          api.get<Stats>('/analytics/locataire', token),
        ]);
        if (bkRes.status === 'fulfilled') setBookings((bkRes.value ?? []).slice(0, 3));
        if (stRes.status === 'fulfilled') setStats(stRes.value);
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  return (
    <div className="space-y-8">

      {/* En-tête */}
      <div>
        <p className="mb-0.5 text-xs font-semibold uppercase tracking-widest text-gold-dark">
          {t('spaceLabel')}
        </p>
        <h1 className="text-2xl font-extrabold text-text sm:text-3xl">
          {t('welcomeTitle')}
        </h1>
        <p className="mt-1 text-sm text-sub">
          {t('welcomeDesc')}
        </p>
      </div>


      {/* Cartes navigation + stats */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-line bg-card p-5 h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NavStatCard
            icon="fa-calendar-check"
            label={t('statBookings')}
            sub={t('statBookingsSub')}
            value={String(stats?.totalBookings ?? 0)}
            href="/locataire/bookings"
          />
          <NavStatCard
            icon="fa-clock"
            label={t('statActive')}
            sub={t('statActiveSub')}
            value={String(stats?.activeBookings ?? 0)}
            href="/locataire/bookings"
          />
          <NavStatCard
            icon="fa-heart"
            label={t('statFavorites')}
            sub={t('statFavoritesSub')}
            value={String(stats?.favorites ?? 0)}
            href="/locataire/favorites"
          />
          <NavStatCard
            icon="fa-comment-dots"
            label={t('statMessages')}
            sub={t('statMessagesSub')}
            value={String(stats?.unreadMessages ?? 0)}
            href="/locataire/messages"
          />
        </div>
      )}

      {/* Dernières réservations */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-text">{t('recentBookings')}</h2>
          <Link href="/locataire/bookings" className="text-xs font-medium text-gold-dark hover:underline">
            {t('seeAllLink')}
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-line bg-card h-20" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-card py-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gold-pale">
              <i className="fa-solid fa-calendar-xmark text-xl text-gold-dark" />
            </div>
            <p className="text-sm font-medium text-text">{t('noBookingsYet')}</p>
            <p className="mt-1 text-xs text-sub">{t('exploreHint')}</p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold-pale px-4 py-2 text-xs font-medium text-gold-dark transition hover:bg-gold/20"
            >
              <i className="fa-solid fa-magnifying-glass text-xs" />
              {t('browseBtn')}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const s = BOOKING_STATUS_LABEL[b.status] ?? { label: b.status, color: 'text-sub bg-bg border-line' };
              return (
                <Link
                  key={b.id}
                  href="/locataire/bookings"
                  className="flex items-center gap-4 rounded-xl border border-line bg-card p-4 transition hover:border-gold/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-pale">
                    <i className="fa-solid fa-house text-gold-dark text-sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{b.listing.title}</p>
                    <p className="text-xs text-sub">
                      <i className="fa-solid fa-location-dot text-xs mr-1" />{b.listing.city} ·{' '}
                      {formatDate(b.startDate)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${s.color}`}>
                    {s.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>


    </div>
  );
}

function NavStatCard({ icon, label, sub, value, href }: {
  icon: string; label: string; sub: string; value: string; href: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between rounded-2xl border border-blue-100 bg-blue-50 p-5 transition hover:border-blue-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 shadow-sm">
          <i className={`fa-solid ${icon} text-sm text-blue-600`} />
        </div>
        <i className="fa-solid fa-arrow-right text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-blue-700">{value}</p>
        <p className="mt-0.5 text-xs font-semibold text-blue-600">{label}</p>
        <p className="text-[10px] text-blue-400 mt-0.5">{sub}</p>
      </div>
    </Link>
  );
}
