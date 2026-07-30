'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

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
  conversionRate: number;
  alloVerifieRate: number;
  performanceScore: number;
  verifiedActiveCount: number;
  totalActiveCount: number;
}

const TYPE_LABEL_EN: Record<string, string> = {
  APPARTEMENT: 'Apt', STUDIO: 'Studio', VILLA: 'Villa',
  BUREAU: 'Office', CHAMBRE: 'Room', MAISON: 'House',
};
const TYPE_LABEL_FR: Record<string, string> = {
  APPARTEMENT: 'Appt', STUDIO: 'Studio', VILLA: 'Villa',
  BUREAU: 'Bureau', CHAMBRE: 'Chambre', MAISON: 'Maison',
};

export default function VitrineAnalyticsPage() {
  const { getToken } = useAuth();
  const t         = useTranslations('bailleur');
  const locale    = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';
  const typeLabel = locale === 'en' ? TYPE_LABEL_EN : TYPE_LABEL_FR;
  const { toast } = useToast();

  const [stats,    setStats]    = useState<VitrineStats | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const defaultMonth = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const [reportMonth,       setReportMonth]       = useState(defaultMonth);
  const [downloadingReport, setDownloadingReport] = useState(false);

  const downloadReport = async () => {
    setDownloadingReport(true);
    const token = await getToken();
    try {
      const res = await fetch(`${API_URL}/analytics/owner/report?month=${reportMonth}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t('analyticsReportError'));
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `rapport-${reportMonth}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('analyticsReportDownloadError'));
    } finally {
      setDownloadingReport(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      const data = await api.get<VitrineStats>('/analytics/vitrine', token);
      setStats(data);
    } catch {
      setError(t('analyticsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [getToken, t]);

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
          <i className="fa-solid fa-rotate-right mr-1.5" />{t('retry')}
        </button>
      </div>
    );
  }

  const isPro = stats.subscription?.plan === 'PRO' && stats.subscription?.status === 'ACTIVE';

  const conversionStatus =
    stats.conversionRate >= 60 ? `🟢 ${t('analyticsConversionExcellent')}`
    : stats.conversionRate >= 35 ? `🟡 ${t('analyticsConversionMedium')}`
    : `🔴 ${t('analyticsConversionWeak')}`;

  return (
    <div className="flex flex-col gap-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">{t('analyticsTitle')}</h1>
          <p className="text-sm text-sub mt-0.5">
            {stats.agencyName ?? t('analyticsAgencyFallback')}
            {stats.agencySlug && (
              <Link href={`/agences/${stats.agencySlug}`} className="ml-2 text-gold-dark hover:underline text-xs">
                <i className="fa-solid fa-arrow-up-right-from-square text-[10px] mr-0.5" />
                {t('analyticsVitrineSeeLink')}
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
          label={t('analyticsVitrineViews')}
          value={stats.profileViews.toLocaleString(numLocale)}
          sub={t('analyticsViewsSub')}
          accent="text-blue-600"
          bg="bg-blue-50"
        />
        <KpiCard
          icon="fa-house"
          label={t('analyticsActiveListings')}
          value={`${stats.activeListings} / ${stats.totalListings}`}
          sub={t('analyticsActiveListingsSub')}
          accent="text-emerald-600"
          bg="bg-emerald-50"
        />
        <KpiCard
          icon="fa-sack-dollar"
          label={t('analyticsTotalRevenue')}
          value={formatPrice(stats.totalRevenue)}
          sub={t('analyticsTotalRevenueSub')}
          accent="text-gold-dark"
          bg="bg-gold-pale"
        />
        <KpiCard
          icon="fa-star"
          label={t('analyticsAvgRating')}
          value={stats.avgRating ? `${stats.avgRating.toFixed(1)} / 5` : '—'}
          sub={t('analyticsReviewCount', { count: stats.reviewCount })}
          accent="text-yellow-600"
          bg="bg-yellow-50"
        />
      </div>

      {/* KPIs enrichis */}
      <div className="rounded-2xl border border-line bg-card p-5">
        <h2 className="text-sm font-semibold text-text mb-5 flex items-center gap-2">
          <i className="fa-solid fa-chart-pie text-gold-dark text-xs" />
          {t('analyticsPerformance')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

          {/* Score global */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--color-line,#e5e7eb)" strokeWidth="8" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke={stats.performanceScore >= 70 ? '#16a34a' : stats.performanceScore >= 40 ? '#b8972a' : '#ef4444'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(stats.performanceScore / 100) * 213.6} 213.6`}
                />
              </svg>
              <span className="text-xl font-extrabold text-text">{stats.performanceScore}</span>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-text">{t('analyticsScoreLabel')}</p>
              <p className="text-[11px] text-sub mt-0.5">{t('analyticsScoreSub')}</p>
            </div>
            <div className="w-full rounded-xl border border-line bg-bg/60 px-3 py-2 text-[10px] text-sub space-y-0.5">
              <div className="flex justify-between"><span>{t('analyticsScoreRating')}</span><span className="font-medium text-text">30 {t('analyticsScoreMax')}</span></div>
              <div className="flex justify-between"><span>{t('analyticsScoreConversion')}</span><span className="font-medium text-text">25 {t('analyticsScoreMax')}</span></div>
              <div className="flex justify-between"><span>{t('analyticsScoreVerified')}</span><span className="font-medium text-text">25 {t('analyticsScoreMax')}</span></div>
              <div className="flex justify-between"><span>{t('analyticsScorePublication')}</span><span className="font-medium text-text">20 {t('analyticsScoreMax')}</span></div>
            </div>
          </div>

          {/* Taux de conversion */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
                <i className="fa-solid fa-arrows-turn-to-dots text-sm text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-text">{t('analyticsConversionTitle')}</p>
                <p className="text-[11px] text-sub">{t('analyticsConversionSub')}</p>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-extrabold text-text">{stats.conversionRate}%</span>
              <span className="mb-1 text-xs text-sub">{conversionStatus}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-bg overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  stats.conversionRate >= 60 ? 'bg-emerald-500' : stats.conversionRate >= 35 ? 'bg-gold' : 'bg-red-400'
                }`}
                style={{ width: `${stats.conversionRate}%` }}
              />
            </div>
            <p className="text-[11px] text-sub">{t('analyticsConversionTip')}</p>
          </div>

          {/* Pression AlloVérifié */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                <i className="fa-solid fa-shield-halved text-sm text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-text">{t('analyticsVerifiedTitle')}</p>
                <p className="text-[11px] text-sub">{t('analyticsVerifiedSub')}</p>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-extrabold text-text">{stats.alloVerifieRate}%</span>
              <span className="mb-1 text-xs text-sub">
                {stats.verifiedActiveCount}/{stats.totalActiveCount}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-bg overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  stats.alloVerifieRate >= 80 ? 'bg-emerald-500' : stats.alloVerifieRate >= 40 ? 'bg-gold' : 'bg-red-400'
                }`}
                style={{ width: `${stats.alloVerifieRate}%` }}
              />
            </div>
            <p className="text-[11px] text-sub">
              {stats.alloVerifieRate < 100
                ? t('analyticsVerifiedListings', { unverified: stats.totalActiveCount - stats.verifiedActiveCount })
                : t('analyticsVerifiedAll')}
            </p>
          </div>

        </div>
      </div>

      {/* Top listings */}
      {stats.topListings.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-sm font-semibold text-text mb-4 flex items-center gap-2">
            <i className="fa-solid fa-trophy text-gold-dark text-xs" />
            {t('analyticsTopListings')}
          </h2>
          <div className="flex flex-col gap-2">
            {stats.topListings.map((listing, i) => {
              const maxBookings = stats.topListings[0]?.totalBookings ?? 1;
              const pct = maxBookings > 0 ? (listing.totalBookings / maxBookings) * 100 : 0;
              return (
                <div key={listing.id} className="flex items-center gap-3">
                  <span className={`shrink-0 w-6 text-center text-sm font-bold ${i === 0 ? 'text-gold-dark' : 'text-sub'}`}>
                    {i + 1}
                  </span>
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
                          {listing.totalBookings} {t('analyticsBookingsAbbr')}
                        </span>
                        <span className="hidden sm:inline">
                          <i className="fa-solid fa-heart text-red-400 text-[10px] mr-1" />
                          {listing.favorites}
                        </span>
                        <span className="font-medium text-text">{formatPrice(listing.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-bg overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold to-gold-light transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] text-sub bg-bg border border-line rounded-full px-2 py-0.5 hidden sm:inline">
                    {typeLabel[listing.type] ?? listing.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revenue chart */}
      {stats.monthly.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-sm font-semibold text-text mb-4">
            <i className="fa-solid fa-sack-dollar text-gold-dark mr-2" />
            {t('analyticsRevenueChart')}
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
                formatter={(v: ValueType | undefined) => [formatPrice(Number(v)), t('chartRevenueLabel')]}
                contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="revenue" fill="#b8972a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bookings chart */}
      {stats.monthly.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-sm font-semibold text-text mb-4">
            <i className="fa-solid fa-calendar-check text-gold-dark mr-2" />
            {t('analyticsBookingsChart')}
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={stats.monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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

      {/* PDF report */}
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
            <i className="fa-solid fa-file-pdf text-red-500 text-sm" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text">{t('analyticsReportTitle')}</p>
            <p className="text-[11px] text-sub">{t('analyticsReportDesc')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="report-month" className="text-[11px] font-medium text-sub">
              {t('analyticsReportMonthLabel')}
            </label>
            <input
              id="report-month"
              type="month"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              max={defaultMonth}
              className="rounded-xl border border-line bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>
          <div className="flex items-end pb-0.5">
            <button
              onClick={() => void downloadReport()}
              disabled={downloadingReport || !reportMonth}
              className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition disabled:opacity-60"
            >
              {downloadingReport
                ? <><i className="fa-solid fa-spinner fa-spin" /> {t('analyticsReportGenerating')}</>
                : <><i className="fa-solid fa-download text-xs" /> {t('analyticsReportDownload')}</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Vitrine link */}
      {stats.agencySlug && (
        <div className="rounded-2xl border border-gold/30 bg-gold-pale/30 p-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-text">{t('analyticsVitrinePublicTitle')}</p>
            <p className="text-xs text-sub mt-0.5">
              alloappart.sn/agences/<span className="text-gold-dark">{stats.agencySlug}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/bailleur/ma-vitrine" className="btn-outline text-sm">
              <i className="fa-solid fa-pen text-xs mr-1.5" />{t('analyticsVitrineEdit')}
            </Link>
            <Link href={`/agences/${stats.agencySlug}`} className="btn-gold text-sm">
              <i className="fa-solid fa-eye text-xs mr-1.5" />{t('analyticsVitrineView')}
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
