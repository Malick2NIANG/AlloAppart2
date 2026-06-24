'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
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

interface MonthlyPoint {
  label: string;
  bookings: number;
  revenue: number;
}

export default function BailleurAnalyticsPage() {
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const [stats, setStats]               = useState<OwnerStats | null>(null);
  const [monthly, setMonthly]           = useState<MonthlyPoint[]>([]);
  const [unverifiedCount, setUnverifiedCount] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [reportMonth, setReportMonth]       = useState(defaultMonth);
  const [downloadingReport, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const [s, m, listings] = await Promise.all([
        api.get<OwnerStats>('/analytics/owner', token ?? undefined),
        api.get<MonthlyPoint[]>('/analytics/owner/monthly', token ?? undefined),
        api.get<{ data: Array<{ isVerified: boolean; status: string }>; total: number }>(
          '/listings/mine',
          token ?? undefined
        ),
      ]);
      setStats(s);
      setMonthly(m);
      const unverifiedActive = listings.data.filter(
        (l) => l.status === 'ACTIVE' && !l.isVerified
      ).length;
      setUnverifiedCount(unverifiedActive);
    } catch {
      setError('Impossible de charger les statistiques.');
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
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erreur lors du téléchargement du rapport.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
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

  const conversionRate = stats.totalBookings > 0
    ? Math.round((stats.confirmedBookings / stats.totalBookings) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text">Statistiques</h1>
        <p className="mt-1 text-sm text-sub">Performance de vos annonces</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon="fa-solid fa-house"          label="Annonces publiées"       value={`${stats.publishedListings} / ${stats.totalListings}`} />
        <KpiCard icon="fa-solid fa-calendar-check" label="Taux de conversion"      value={`${conversionRate}%`} />
        <KpiCard icon="fa-solid fa-sack-dollar"    label="Revenus totaux"          value={formatPrice(stats.totalRevenue)} />
        <KpiCard icon="fa-solid fa-star"           label="Note moyenne"            value={stats.avgRating ? `${stats.avgRating.toFixed(1)} / 5` : 'N/A'} />
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

      {unverifiedCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <i className="fa-solid fa-shield-halved text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {unverifiedCount} annonce{unverifiedCount > 1 ? 's' : ''} sans badge AlloVérifié
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Les annonces vérifiées apparaissent en priorité dans les recherches.
              Demandez le badge depuis vos annonces.
            </p>
            <Link
              href="/bailleur/listings"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-800 underline hover:no-underline"
            >
              Voir mes annonces <i className="fa-solid fa-arrow-right text-[10px]" />
            </Link>
          </div>
        </div>
      )}

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
