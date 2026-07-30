'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import type { Booking, Listing, User, BookingStatus, PaginatedResponse, MessageRoom } from '@/types';
import Greeting from '@/components/ui/Greeting';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent';

interface OwnerStats {
  totalListings: number;
  publishedListings: number;
  totalBookings: number;
  confirmedBookings: number;
  totalRevenue: number;
  avgRating: number | null;
}

interface Subscription {
  plan: 'STARTER' | 'PRO';
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  endDate: string | null;
}

interface MonthlyPoint {
  label: string;
  bookings: number;
  revenue: number;
}

interface ReviewItem {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string; avatar?: string | null };
  listing: { id: string; title: string; city: string };
}

interface ReviewsData {
  data: ReviewItem[];
  avgRating: number | null;
  total: number;
}

interface LocataireBooking {
  id: string;
  status: string;
  startDate: string;
  listing: { title: string; city: string };
}

interface LocataireStats {
  totalBookings: number;
  activeBookings: number;
  favorites: number;
  unreadMessages: number;
}

interface DashboardData {
  me: User;
  isPro: boolean;
  isDual: boolean;
  stats: OwnerStats;
  bookings: Booking[];
  listings: Listing[];
  subscription: Subscription | null;
  monthly: MonthlyPoint[];
  reviews: ReviewsData;
  locataireBookings: LocataireBooking[];
  locataireStats: LocataireStats | null;
  unreadMessages: number;
}

const BOOKING_STATUS_BADGE: Record<BookingStatus, string> = {
  PENDING:   'bg-gold-pale text-gold-dark',
  CONFIRMED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
};

export default function BailleurDashboardPage() {
  const { getToken } = useAuth();
  const { toast }     = useToast();
  const t             = useTranslations('bailleur');
  const locale        = useLocale();
  const numLocale     = locale === 'en' ? 'en-US' : 'fr-FR';

  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [reportMonth, setReportMonth]       = useState(defaultMonth);
  const [downloadingReport, setDownloading] = useState(false);

  const BOOKING_STATUS_LABELS = useMemo<Record<BookingStatus, string>>(() => ({
    PENDING:   t('bookingStatusPending'),
    CONFIRMED: t('bookingStatusConfirmed'),
    CANCELLED: t('bookingStatusCancelled'),
    COMPLETED: t('bookingStatusCompleted'),
  }), [t]);

  const LOCATAIRE_STATUS = useMemo<Record<string, { label: string; color: string }>>(() => ({
    PENDING:   { label: t('bookingStatusPending'),   color: 'text-amber-600 bg-amber-50 border-amber-200'       },
    CONFIRMED: { label: t('bookingStatusConfirmed'), color: 'text-blue-600 bg-blue-50 border-blue-200'          },
    COMPLETED: { label: t('bookingStatusCompleted'), color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    CANCELLED: { label: t('bookingStatusCancelled'), color: 'text-red-600 bg-red-50 border-red-200'             },
  }), [t]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error();

      const me = await api.get<User>('/auth/me', token);
      const isPro  = me.roles.includes('PRO_AGENCE');
      const isDual = me.roles.includes('LOCATAIRE');

      const [stats, bookingsRes, listingsRes, subscription, monthlyRes, reviews,
             locataireBkRes, locataireStRes, roomsRes] = await Promise.all([
        api.get<OwnerStats>('/analytics/owner', token),
        api.get<PaginatedResponse<Booking>>('/bookings/received?page=1&limit=5', token),
        api.get<PaginatedResponse<Listing>>('/listings/mine', token),
        isPro
          ? api.get<Subscription | null>('/subscriptions/me', token).catch(() => null)
          : Promise.resolve(null),
        api.get<MonthlyPoint[]>('/analytics/owner/monthly', token),
        api.get<ReviewsData>('/reviews/bailleur/me', token).catch(() => ({ data: [], avgRating: null, total: 0 })),
        isDual
          ? api.get<LocataireBooking[]>('/bookings/mine', token).catch(() => [])
          : Promise.resolve([]),
        isDual
          ? api.get<LocataireStats>('/analytics/locataire', token).catch(() => null)
          : Promise.resolve(null),
        api.get<MessageRoom[]>('/messages/rooms', token).catch(() => []),
      ]);

      const rooms = roomsRes as MessageRoom[];
      const unreadMessages = rooms.filter(
        (r) => r.messages?.[0] && !r.messages[0].readAt && r.messages[0].senderId !== me.id,
      ).length;

      setData({
        me,
        isPro,
        isDual,
        stats,
        bookings: bookingsRes.data,
        listings: listingsRes.data,
        subscription,
        monthly: monthlyRes,
        reviews,
        locataireBookings: (locataireBkRes as LocataireBooking[]).slice(0, 3),
        locataireStats: locataireStRes as LocataireStats | null,
        unreadMessages,
      });
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [getToken, t]);

  useEffect(() => { void load(); }, [load]);

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const token = await getToken();
      const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
      const res = await fetch(
        `${API}/analytics/owner/report?month=${reportMonth}`,
        { headers: { Authorization: `Bearer ${token ?? ''}` } }
      );
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `rapport-${reportMonth}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error(t('reportError'));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl border border-line bg-card animate-pulse" />
          ))}
        </div>
        <div className="h-40 rounded-2xl border border-line bg-card animate-pulse" />
        <div className="h-40 rounded-2xl border border-line bg-card animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
        <p className="text-sm text-sub">{error}</p>
        <button onClick={() => void load()} className="mt-4 btn-gold text-sm">
          <i className="fa-solid fa-rotate-right mr-1.5" />{t('retry')}
        </button>
      </div>
    );
  }

  const { me, isDual, stats, bookings, listings, monthly, reviews,
          locataireBookings, locataireStats, unreadMessages } = data;

  const pendingCount    = bookings.filter((b) => b.status === 'PENDING').length;
  const unverifiedCount = listings.filter((l) => l.status === 'ACTIVE' && !l.isVerified).length;
  const verifiedCount   = listings.filter((l) => l.isVerified).length;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <Greeting firstName={me.firstName ?? t('you')} />
      </div>

      {/* Bailleur section divider — dual mode only */}
      {isDual && (
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-line" />
          <span className="text-xs font-semibold uppercase tracking-widest text-gold-dark px-2">
            <i className="fa-solid fa-house-chimney-user mr-1.5" />{t('spaceBailleurLabel')}
          </span>
          <div className="flex-1 border-t border-line" />
        </div>
      )}

      {/* Contextual alerts */}
      <div className="flex flex-col gap-3">
        {pendingCount > 0 && (
          <div className="rounded-2xl border border-gold-dark/30 bg-gold-pale/40 p-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-medium text-text">
              <i className="fa-solid fa-clock text-gold-dark mr-2" />
              {t('alertPending', { count: pendingCount })}
            </p>
            <Link href="/bailleur/bookings" className="text-sm font-semibold text-gold-dark hover:underline shrink-0">
              {t('alertPendingSee')} <i className="fa-solid fa-arrow-right text-xs ml-1" />
            </Link>
          </div>
        )}

        {unverifiedCount > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-medium text-amber-800">
              <i className="fa-solid fa-shield-halved mr-2" />
              {t('alertUnverified', { count: unverifiedCount })}
            </p>
            <Link href="/bailleur/listings" className="text-sm font-semibold text-amber-800 hover:underline shrink-0">
              {t('alertUnverifiedSee')} <i className="fa-solid fa-arrow-right text-xs ml-1" />
            </Link>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon="fa-solid fa-house"          label={t('kpiListings')}    sub={t('kpiListingsSub')}    value={`${stats.publishedListings} / ${stats.totalListings}`} href="/bailleur/listings" />
        <KpiCard icon="fa-solid fa-calendar-check" label={t('kpiBookings')}    sub={t('kpiBookingsSub')}    value={`${stats.totalBookings}`}                               href="/bailleur/bookings" badge={pendingCount > 0 ? pendingCount : null} />
        <KpiCard icon="fa-solid fa-comment-dots"   label={t('kpiMessages')}    sub={t('kpiMessagesSub')}    value={String(unreadMessages)}                                  href="/bailleur/messages" />
        <KpiCard icon="fa-solid fa-shield-halved"  label={t('kpiAlloVerifie')} sub={t('kpiAlloVerifieSub')} value={String(verifiedCount)}                                  href="/bailleur/verifications" />
      </div>

      {/* PDF Report */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="month"
          value={reportMonth}
          onChange={(e) => setReportMonth(e.target.value)}
          className="rounded-xl border border-line bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-gold-dark"
        />
        <button
          onClick={() => void downloadReport()}
          disabled={downloadingReport}
          className="btn-gold text-sm disabled:opacity-50"
        >
          {downloadingReport
            ? <><i className="fa-solid fa-spinner fa-spin mr-2" />{t('reportGenerating')}</>
            : <><i className="fa-solid fa-file-pdf mr-2" />{t('reportPdf')}</>
          }
        </button>
      </div>

      {/* Revenue chart */}
      {monthly.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-sm font-semibold text-text mb-4">
            <i className="fa-solid fa-sack-dollar text-gold-dark mr-2" />
            {t('chartRevenue6m')}
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line, #e5e7eb)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                formatter={(v: ValueType | undefined) => [formatPrice(Number(v)), t('chartRevenueLabel')]}
                contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="revenue" fill="#b8972a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bookings chart */}
      {monthly.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-sm font-semibold text-text mb-4">
            <i className="fa-solid fa-calendar-check text-gold-dark mr-2" />
            {t('chartBookings6m')}
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line, #e5e7eb)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                formatter={(v: ValueType | undefined) => [Number(v), t('chartBookingsLabel')]}
                contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e5e7eb' }}
              />
              <Line dataKey="bookings" stroke="#b8972a" strokeWidth={2} dot={{ r: 4, fill: '#b8972a' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Reviews */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-sub flex items-center gap-2">
            <i className="fa-solid fa-star text-gold-dark text-xs" />
            {t('reviewsTitle')}
            {reviews.total > 0 && (
              <span className="text-xs font-normal text-sub">({reviews.total})</span>
            )}
          </h2>
          {reviews.avgRating !== null && (
            <div className="flex items-center gap-1.5">
              <StarDisplay rating={reviews.avgRating} />
              <span className="text-sm font-bold text-text">{reviews.avgRating.toFixed(1)}</span>
              <span className="text-xs text-sub">/ 5</span>
            </div>
          )}
        </div>

        {reviews.data.length === 0 ? (
          <div className="rounded-2xl border border-line bg-card p-6 text-center">
            <i className="fa-regular fa-star text-2xl text-line mb-2 block" />
            <p className="text-sm text-sub">{t('reviewsEmpty')}</p>
            <p className="text-xs text-sub mt-1">{t('reviewsEmptyHint')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.data.slice(0, 4).map((review) => (
              <div key={review.id} className="rounded-xl border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {review.author.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={review.author.avatar} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gold-pale flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-gold-dark">
                          {review.author.firstName[0]}{review.author.lastName[0]}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text truncate">
                        {review.author.firstName} {review.author.lastName}
                      </p>
                      <p className="text-xs text-sub truncate">{review.listing.title} · {review.listing.city}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 gap-1">
                    <StarDisplay rating={review.rating} />
                    <span className="text-[11px] text-sub">
                      {new Date(review.createdAt).toLocaleDateString(numLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                {review.comment && (
                  <p className="text-sm text-text line-clamp-2 mt-1 pl-10">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent activity (bailleur) */}
      <div>
        <h2 className="text-sm font-semibold text-sub mb-3">{t('activityTitle')}</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-sub text-center py-8">{t('activityEmpty')}</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {bookings.map((booking) => (
                <div key={booking.id} className="rounded-xl border border-line bg-card p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">{booking.listing?.title ?? booking.listingId}</p>
                    <p className="text-xs text-sub">
                      {t('activityFrom')} {booking.tenant?.firstName} {booking.tenant?.lastName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${BOOKING_STATUS_BADGE[booking.status]}`}>
                      {BOOKING_STATUS_LABELS[booking.status]}
                    </span>
                    <span className="text-xs text-sub">{formatDate(booking.startDate)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-4">
              <Link href="/bailleur/bookings" className="text-sm font-medium text-gold-dark hover:underline">
                {t('activitySeeAll')} <i className="fa-solid fa-arrow-right text-xs ml-1" />
              </Link>
            </div>
          </>
        )}
      </div>

      {/* ══════════════ LOCATAIRE SECTION ══════════════ */}
      {isDual && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-line" />
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600 px-2">
              <i className="fa-solid fa-user mr-1.5" />{t('spaceLocataireLabel')}
            </span>
            <div className="flex-1 border-t border-line" />
          </div>

          {/* Locataire stats */}
          {locataireStats && (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <LocStatCard icon="fa-calendar-check" label={t('locStatBookings')}  sub={t('locStatBookingsSub')}  value={String(locataireStats.totalBookings)}  href="/locataire/bookings"  />
              <LocStatCard icon="fa-clock"          label={t('locStatActive')}    sub={t('locStatActiveSub')}    value={String(locataireStats.activeBookings)} href="/locataire/bookings"  />
              <LocStatCard icon="fa-heart"          label={t('locStatFavorites')} sub={t('locStatFavoritesSub')} value={String(locataireStats.favorites)}       href="/locataire/favorites" />
              <LocStatCard icon="fa-comment-dots"   label={t('locStatMessages')}  sub={t('locStatMessagesSub')}  value={String(locataireStats.unreadMessages)}  href="/locataire/messages"  />
            </div>
          )}

          {/* Last locataire bookings */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-sub">{t('locLastBookings')}</h2>
              <Link href="/locataire/bookings" className="text-xs font-medium text-blue-600 hover:underline">
                {t('locataireSeeAll')}
              </Link>
            </div>
            {locataireBookings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-card py-10 text-center">
                <i className="fa-solid fa-calendar-xmark text-xl text-line mb-2 block" />
                <p className="text-sm text-sub">{t('locataireNoBookings')}</p>
                <Link href="/" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline">
                  <i className="fa-solid fa-magnifying-glass text-xs" /> {t('locataireBrowse')}
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {locataireBookings.map((b) => {
                  const s = LOCATAIRE_STATUS[b.status] ?? { label: b.status, color: 'text-sub bg-bg border-line' };
                  return (
                    <Link key={b.id} href="/locataire/bookings"
                      className="flex items-center gap-4 rounded-xl border border-line bg-card p-4 transition hover:border-blue-200">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                        <i className="fa-solid fa-house text-blue-600 text-sm" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">{b.listing.title}</p>
                        <p className="text-xs text-sub">
                          <i className="fa-solid fa-location-dot text-xs mr-1" />{b.listing.city} · {formatDate(b.startDate)}
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
        </>
      )}
    </div>
  );
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          className={`fa-star text-xs ${
            n <= Math.round(rating) ? 'fa-solid text-gold' : 'fa-regular text-line'
          }`}
        />
      ))}
    </div>
  );
}

function LocStatCard({ icon, label, sub, value, href }: {
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

function KpiCard({ label, sub, value, icon, href, badge }: {
  label: string; sub: string; value?: string; icon: string; href: string; badge?: number | null;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between rounded-2xl border border-gold/30 bg-gold-pale p-5 transition hover:border-gold hover:shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 shadow-sm">
          <i className={`${icon} text-gold-dark text-sm`} />
        </div>
        <div className="flex items-center gap-1.5">
          {badge != null && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-dark px-1.5 text-[10px] font-bold text-white">
              {badge}
            </span>
          )}
          <i className="fa-solid fa-arrow-right text-[10px] text-gold-dark opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-xl font-bold text-gold-dark">{value ?? '—'}</p>
        <p className="mt-0.5 text-xs font-semibold text-text">{label}</p>
        <p className="text-[10px] text-sub mt-0.5">{sub}</p>
      </div>
    </Link>
  );
}
