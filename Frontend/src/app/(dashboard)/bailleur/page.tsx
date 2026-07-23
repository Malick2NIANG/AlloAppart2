'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import type { Booking, Listing, User, BookingStatus, PaginatedResponse } from '@/types';
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

interface DashboardData {
  me: User;
  isPro: boolean;
  stats: OwnerStats;
  bookings: Booking[];
  listings: Listing[];
  subscription: Subscription | null;
  monthly: MonthlyPoint[];
  reviews: ReviewsData;
}

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING:   'En attente',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Refusée',
  COMPLETED: 'Terminée',
};

const BOOKING_STATUS_BADGE: Record<BookingStatus, string> = {
  PENDING:   'bg-gold-pale text-gold-dark',
  CONFIRMED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
};

export default function BailleurDashboardPage() {
  const { getToken } = useAuth();
  const { toast }     = useToast();
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [reportMonth, setReportMonth]       = useState(defaultMonth);
  const [downloadingReport, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session introuvable');

      const me = await api.get<User>('/auth/me', token);
      const isPro = me.roles.includes('PRO_AGENCE');

      const [stats, bookingsRes, listingsRes, subscription, monthlyRes, reviews] = await Promise.all([
        api.get<OwnerStats>('/analytics/owner', token),
        api.get<PaginatedResponse<Booking>>('/bookings/received?page=1&limit=5', token),
        api.get<PaginatedResponse<Listing>>('/listings/mine', token),
        isPro
          ? api.get<Subscription | null>('/subscriptions/me', token).catch(() => null)
          : Promise.resolve(null),
        api.get<MonthlyPoint[]>('/analytics/owner/monthly', token),
        api.get<ReviewsData>('/reviews/bailleur/me', token).catch(() => ({ data: [], avgRating: null, total: 0 })),
      ]);

      setData({
        me,
        isPro,
        stats,
        bookings: bookingsRes.data,
        listings: listingsRes.data,
        subscription,
        monthly: monthlyRes,
        reviews,
      });
    } catch {
      setError('Impossible de charger le tableau de bord.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

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
      if (!res.ok) throw new Error('Erreur serveur');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `rapport-${reportMonth}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error('Impossible de générer le rapport PDF.');
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
          <i className="fa-solid fa-rotate-right mr-1.5" />Réessayer
        </button>
      </div>
    );
  }

  const { me, isPro, stats, bookings, listings, monthly, reviews } = data;

  const pendingCount    = bookings.filter((b) => b.status === 'PENDING').length;
  const unverifiedCount = listings.filter((l) => l.status === 'ACTIVE' && !l.isVerified).length;

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const shortcuts = [
    { label: 'Mes annonces', icon: 'fa-house',          href: '/bailleur/listings'   },
    { label: 'Réservations', icon: 'fa-calendar-check',  href: '/bailleur/bookings', badge: pendingCount > 0 ? pendingCount : null },
    { label: 'Messages',     icon: 'fa-comment-dots',    href: '/bailleur/messages'   },
    ...(isPro ? [{ label: 'Abonnement', icon: 'fa-id-card', href: '/bailleur/abonnement', badge: null }] : []),
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* En-tête */}
      <div>
        <Greeting firstName={me.firstName ?? 'vous'} />
        <p className="mt-1 text-sm text-sub capitalize">{today}</p>
      </div>

      {/* Alertes contextuelles */}
      <div className="flex flex-col gap-3">
        {pendingCount > 0 && (
          <div className="rounded-2xl border border-gold-dark/30 bg-gold-pale/40 p-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-medium text-text">
              <i className="fa-solid fa-clock text-gold-dark mr-2" />
              {pendingCount} réservation{pendingCount > 1 ? 's' : ''} en attente de votre réponse
            </p>
            <Link href="/bailleur/bookings" className="text-sm font-semibold text-gold-dark hover:underline shrink-0">
              Voir <i className="fa-solid fa-arrow-right text-xs ml-1" />
            </Link>
          </div>
        )}

        {unverifiedCount > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-medium text-amber-800">
              <i className="fa-solid fa-shield-halved mr-2" />
              {unverifiedCount} annonce{unverifiedCount > 1 ? 's' : ''} active{unverifiedCount > 1 ? 's' : ''} sans badge AlloVérifié
            </p>
            <Link href="/bailleur/listings" className="text-sm font-semibold text-amber-800 hover:underline shrink-0">
              Voir mes annonces <i className="fa-solid fa-arrow-right text-xs ml-1" />
            </Link>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon="fa-solid fa-house"          label="Annonces publiées" value={`${stats.publishedListings} / ${stats.totalListings}`} />
        <KpiCard icon="fa-solid fa-calendar-check" label="Réservations totales" value={`${stats.totalBookings}`} />
        <KpiCard icon="fa-solid fa-sack-dollar"    label="Revenus totaux"    value={formatPrice(stats.totalRevenue)} />
        <KpiCard icon="fa-solid fa-star"           label="Note moyenne"      value={stats.avgRating ? `${stats.avgRating.toFixed(1)}/5` : 'N/A'} />
      </div>

      {/* Accès rapide */}
      <div>
        <h2 className="text-sm font-semibold text-sub mb-3">Accès rapide</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-2xl border border-line bg-card hover:border-gold-dark/40 p-4 flex items-center gap-3 transition-colors"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-pale">
                <i className={`fa-solid ${s.icon} text-gold-dark text-sm`} />
              </span>
              <span className="text-sm font-medium text-text">{s.label}</span>
              {s.badge != null && (
                <span className="ml-auto text-xs bg-gold-dark text-white rounded-full px-2 py-0.5">{s.badge}</span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Rapport PDF */}
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
            ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Génération…</>
            : <><i className="fa-solid fa-file-pdf mr-2" />Rapport PDF</>
          }
        </button>
      </div>

      {/* Graphique revenus mensuels */}
      {monthly.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-sm font-semibold text-text mb-4">
            <i className="fa-solid fa-sack-dollar text-gold-dark mr-2" />
            Revenus des 6 derniers mois
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line, #e5e7eb)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                formatter={(v: ValueType | undefined) => [formatPrice(Number(v)), 'Revenus']}
                contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="revenue" fill="#b8972a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Graphique réservations mensuelles */}
      {monthly.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-sm font-semibold text-text mb-4">
            <i className="fa-solid fa-calendar-check text-gold-dark mr-2" />
            Réservations des 6 derniers mois
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line, #e5e7eb)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                formatter={(v: ValueType | undefined) => [Number(v), 'Réservations']}
                contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e5e7eb' }}
              />
              <Line dataKey="bookings" stroke="#b8972a" strokeWidth={2} dot={{ r: 4, fill: '#b8972a' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Avis reçus */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-sub flex items-center gap-2">
            <i className="fa-solid fa-star text-gold-dark text-xs" />
            Avis reçus
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
            <p className="text-sm text-sub">Aucun avis reçu pour l&apos;instant.</p>
            <p className="text-xs text-sub mt-1">Les locataires pourront noter leurs séjours une fois terminés.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.data.slice(0, 4).map((review) => (
              <div key={review.id} className="rounded-xl border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {review.author.avatar ? (
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
                      {new Date(review.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
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

      {/* Activité récente */}
      <div>
        <h2 className="text-sm font-semibold text-sub mb-3">Activité récente</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-sub text-center py-8">Aucune réservation reçue pour l&apos;instant.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {bookings.map((booking) => (
                <div key={booking.id} className="rounded-xl border border-line bg-card p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">{booking.listing?.title ?? booking.listingId}</p>
                    <p className="text-xs text-sub">
                      de {booking.tenant?.firstName} {booking.tenant?.lastName}
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
                Voir toutes les réservations <i className="fa-solid fa-arrow-right text-xs ml-1" />
              </Link>
            </div>
          </>
        )}
      </div>
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

function KpiCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gold-pale">
        <i className={`${icon} text-gold-dark text-sm`} />
      </div>
      <p className="text-xl font-bold text-text">{value}</p>
      <p className="mt-1 text-xs text-sub">{label}</p>
    </div>
  );
}
