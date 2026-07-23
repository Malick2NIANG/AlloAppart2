'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent';

interface ListingStat {
  id: string;
  title: string;
  city: string;
  type: string;
  status: string;
  totalBookings: number;
  favorites: number;
  reviewCount: number;
  revenue: number;
}

interface MonthlyPoint {
  label: string;
  bookings: number;
  revenue: number;
}

interface VitrineStats {
  profileViews: number;
  agencyName: string | null;
  agencySlug: string | null;
  subscription: { plan: string; status: string } | null;
  totalListings: number;
  activeListings: number;
  avgRating: number | null;
  reviewCount: number;
  totalRevenue: number;
  topListings: ListingStat[];
  monthly: MonthlyPoint[];
}

const TYPE_LABEL: Record<string, string> = {
  APPARTEMENT: 'Appt', STUDIO: 'Studio', VILLA: 'Villa',
  BUREAU: 'Bureau', CHAMBRE: 'Chambre', MAISON: 'Maison',
};

export default function VitrineAnalyticsPage() {
  const { getToken } = useAuth();
  const [stats,   setStats]   = useState<VitrineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      const data = await api.get<VitrineStats>('/analytics/vitrine', token);
      setStats(data);
    } catch {
      setError('Impossible de charger les analytiques.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl border border-line bg-card animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-2xl border border-line bg-card animate-pulse" />
        <div className="h-64 rounded-2xl border border-line bg-card animate-pulse" />
      </div>
    );
  }

  if (error || !stats) {
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

  const isPro = stats.subscription?.plan === 'PRO' && stats.subscription?.status === 'ACTIVE';

  return (
    <div className="flex flex-col gap-8">

      {/* En-tête */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Analytiques vitrine</h1>
          <p className="text-sm text-sub mt-0.5">
            {stats.agencyName ?? 'Votre agence'}
            {stats.agencySlug && (
              <Link href={`/agences/${stats.agencySlug}`} className="ml-2 text-gold-dark hover:underline text-xs">
                <i className="fa-solid fa-arrow-up-right-from-square text-[10px] mr-0.5" />
                Voir la vitrine
              </Link>
            )}
          </p>
        </div>
        {isPro && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-gold to-gold-light px-3 py-1 text-xs font-bold text-gray-900">
            <i className="fa-solid fa-crown text-[10px]" /> PRO
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon="fa-eye"
          label="Vues vitrine"
          value={stats.profileViews.toLocaleString('fr-FR')}
          sub="total cumulé"
          accent="text-blue-600"
          bg="bg-blue-50"
        />
        <KpiCard
          icon="fa-house"
          label="Annonces actives"
          value={`${stats.activeListings} / ${stats.totalListings}`}
          sub="publiées"
          accent="text-emerald-600"
          bg="bg-emerald-50"
        />
        <KpiCard
          icon="fa-sack-dollar"
          label="Revenus totaux"
          value={formatPrice(stats.totalRevenue)}
          sub="réservations confirmées"
          accent="text-gold-dark"
          bg="bg-gold-pale"
        />
        <KpiCard
          icon="fa-star"
          label="Note moyenne"
          value={stats.avgRating ? `${stats.avgRating.toFixed(1)} / 5` : '—'}
          sub={`${stats.reviewCount} avis`}
          accent="text-yellow-600"
          bg="bg-yellow-50"
        />
      </div>

      {/* Top annonces */}
      {stats.topListings.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-sm font-semibold text-text mb-4 flex items-center gap-2">
            <i className="fa-solid fa-trophy text-gold-dark text-xs" />
            Top annonces par réservations
          </h2>
          <div className="flex flex-col gap-2">
            {stats.topListings.map((listing, i) => {
              const maxBookings = stats.topListings[0]?.totalBookings ?? 1;
              const pct = maxBookings > 0 ? (listing.totalBookings / maxBookings) * 100 : 0;
              return (
                <div key={listing.id} className="flex items-center gap-3">
                  {/* Rang */}
                  <span className={`shrink-0 w-6 text-center text-sm font-bold ${i === 0 ? 'text-gold-dark' : 'text-sub'}`}>
                    {i + 1}
                  </span>
                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <Link
                        href={`/listings/${listing.id}`}
                        className="text-sm font-medium text-text hover:text-gold-dark truncate transition-colors"
                      >
                        {listing.title}
                      </Link>
                      <div className="flex items-center gap-3 shrink-0 ml-3 text-xs text-sub">
                        <span className="hidden sm:inline">
                          <i className="fa-solid fa-calendar-check text-gold-dark text-[10px] mr-1" />
                          {listing.totalBookings} rés.
                        </span>
                        <span className="hidden sm:inline">
                          <i className="fa-solid fa-heart text-red-400 text-[10px] mr-1" />
                          {listing.favorites}
                        </span>
                        <span className="font-medium text-text">{formatPrice(listing.revenue)}</span>
                      </div>
                    </div>
                    {/* Barre de progression */}
                    <div className="h-1.5 rounded-full bg-bg overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold to-gold-light transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  {/* Badge type */}
                  <span className="shrink-0 text-[10px] text-sub bg-bg border border-line rounded-full px-2 py-0.5 hidden sm:inline">
                    {TYPE_LABEL[listing.type] ?? listing.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Graphique revenus mensuels */}
      {stats.monthly.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-sm font-semibold text-text mb-4">
            <i className="fa-solid fa-sack-dollar text-gold-dark mr-2" />
            Revenus des 6 derniers mois
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line, #e5e7eb)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40}
              />
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
      {stats.monthly.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-sm font-semibold text-text mb-4">
            <i className="fa-solid fa-calendar-check text-gold-dark mr-2" />
            Réservations des 6 derniers mois
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={stats.monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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

      {/* Lien vers la vitrine */}
      {stats.agencySlug && (
        <div className="rounded-2xl border border-gold/30 bg-gold-pale/30 p-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-text">Votre vitrine publique</p>
            <p className="text-xs text-sub mt-0.5">
              alloappart.sn/agences/<span className="text-gold-dark">{stats.agencySlug}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/bailleur/ma-vitrine" className="btn-outline text-sm">
              <i className="fa-solid fa-pen text-xs mr-1.5" />Modifier
            </Link>
            <Link href={`/agences/${stats.agencySlug}`} className="btn-gold text-sm">
              <i className="fa-solid fa-eye text-xs mr-1.5" />Voir
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}

function KpiCard({
  icon, label, value, sub, accent, bg,
}: {
  icon: string; label: string; value: string; sub: string; accent: string; bg: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
        <i className={`fa-solid ${icon} text-sm ${accent}`} />
      </div>
      <p className="text-xl font-bold text-text">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-text">{label}</p>
      <p className="text-[11px] text-sub">{sub}</p>
    </div>
  );
}
