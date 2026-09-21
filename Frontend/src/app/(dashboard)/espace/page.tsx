'use client';

/**
 * Vue d'ensemble admin — fusion de l'ancienne page "Vue d'ensemble" (Server
 * Component, alertes + KPIs simples) et de la page "Analytiques" (cockpit
 * futuriste : jauges radiales, graphes de tendance, horloge en direct,
 * bouton Actualiser). Demande explicite du client : une seule page qui
 * regroupe tout, la page Analytiques séparée disparaît de la navigation
 * (voir (dashboard)/layout.tsx). Composant client (l'ancienne Vue d'ensemble
 * était un Server Component) pour permettre l'horloge en direct et le
 * rafraîchissement manuel, comme le faisait déjà l'ancienne page
 * Analytiques.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import { DismissibleAlerts } from './DismissibleAlerts';
import { OverviewAnalytics } from './OverviewAnalytics';
import type { MonthlyTrendPoint } from '@/components/analytics/TrendCharts';

interface AdminStats {
  totalUsers: number;
  totalListings: number;
  publishedListings: number;
  totalBookings: number;
  confirmedBookings: number;
  totalRevenue: number;
  pendingVerifications: number;
  completedVerifications: number;
}

interface AdminExtended {
  roleBreakdown: {
    totalLocataires: number;
    totalBailleurs: number;
    totalProAgences: number;
    totalAgents: number;
  };
  last30Days: {
    newUsers: number;
    newListings: number;
    newBookings: number;
    revenue: number;
  };
  listingsByStatus: { DRAFT: number; ACTIVE: number; RENTED: number; SUSPENDED: number };
  bookingsByStatus: { PENDING: number; CONFIRMED: number; CANCELLED: number; COMPLETED: number };
}

interface AdminAlerts {
  overdueVerifications: number;
  expiringSubscriptions: number;
  suspendedListings: number;
}

export default function AdminDashboardPage() {
  const { getToken } = useAuth();
  const t         = useTranslations('admin');
  const locale    = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';

  const [stats, setStats]       = useState<AdminStats | null>(null);
  const [extended, setExtended] = useState<AdminExtended | null>(null);
  const [monthly, setMonthly]   = useState<MonthlyTrendPoint[]>([]);
  const [alerts, setAlerts]     = useState<AdminAlerts | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  // Horloge en direct — initialisée à null puis fixée dans un effect pour
  // éviter tout mismatch d'hydratation (l'heure du premier rendu serveur
  // différerait sinon de celle du client).
  const [clock, setClock] = useState<Date | null>(null);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    const token = await getToken();
    if (!token) { setLoading(false); setRefreshing(false); return; }
    try {
      const [s, e, m, a] = await Promise.all([
        api.get<AdminStats>('/analytics/admin', token),
        api.get<AdminExtended>('/analytics/admin/extended', token),
        api.get<MonthlyTrendPoint[]>('/analytics/admin/monthly', token),
        api.get<AdminAlerts>('/analytics/admin/alerts', token),
      ]);
      setStats(s);
      setExtended(e);
      setMonthly(m);
      setAlerts(a);
      setLastRefresh(new Date());
    } catch {
      setError(t('analyticsLoadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, t]);

  useEffect(() => { void load(false); }, [load]);

  useEffect(() => {
    setClock(new Date());
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Rafraîchissement automatique discret des données (toutes les 4 minutes) —
  // ne touche ni `loading` ni `refreshing` ni `error` : pas de skeleton, pas
  // de spinner, pas d'écran d'erreur en cas d'échec ponctuel (on retente
  // simplement au cycle suivant). Seuls les chiffres et "Actualisé à" se
  // mettent à jour silencieusement en arrière-plan.
  useEffect(() => {
    const id = setInterval(() => {
      void (async () => {
        const token = await getToken();
        if (!token) return;
        try {
          const [s, e, m, a] = await Promise.all([
            api.get<AdminStats>('/analytics/admin', token),
            api.get<AdminExtended>('/analytics/admin/extended', token),
            api.get<MonthlyTrendPoint[]>('/analytics/admin/monthly', token),
            api.get<AdminAlerts>('/analytics/admin/alerts', token),
          ]);
          setStats(s);
          setExtended(e);
          setMonthly(m);
          setAlerts(a);
          setLastRefresh(new Date());
        } catch {
          // Échec silencieux — nouvelle tentative au prochain cycle.
        }
      })();
    }, 4 * 60 * 1000);
    return () => clearInterval(id);
  }, [getToken]);

  const timeFmt = (d: Date) => d.toLocaleTimeString(numLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-emerald-500/40" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-600/90 dark:text-emerald-400/90">
              {t('analyticsLive')}
            </span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-sub/80">
              · {t('analyticsSystemOnline')}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-text tracking-tight">
            {t('overviewTitle')}
          </h1>
          <p className="mt-1 text-sm text-sub">{t('overviewSubtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          {clock && (
            <div className="hidden sm:block text-right font-mono">
              <p className="text-base font-medium text-sub tabular-nums">
                {timeFmt(clock)}
              </p>
              {lastRefresh && (
                <p className="text-[10px] text-sub/70">{t('analyticsRefreshedAt', { time: timeFmt(lastRefresh) })}</p>
              )}
            </div>
          )}
          <button
            onClick={() => void load(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2 text-sm font-medium text-sub transition-colors hover:text-text hover:border-gold-dark/30 disabled:opacity-50"
          >
            <i className={`fa-solid fa-rotate-right text-xs ${refreshing ? 'fa-spin' : ''}`} />
            {t('analyticsRefresh')}
          </button>
        </div>
      </div>

      {loading ? (
        <CockpitSkeleton />
      ) : error || !stats || !extended || !alerts ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <i className="fa-solid fa-satellite-dish text-3xl text-red-400 mb-3" />
          <p className="text-sm text-sub">{error}</p>
          <button onClick={() => void load(false)} className="mt-4 btn-gold text-sm">
            <i className="fa-solid fa-rotate-right mr-1.5" />{t('retry')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <DismissibleAlerts
            overdueVerifications={alerts.overdueVerifications}
            expiringSubscriptions={alerts.expiringSubscriptions}
            suspendedListings={alerts.suspendedListings}
          />
          <OverviewAnalytics stats={stats} extended={extended} monthly={monthly} />
        </div>
      )}
    </div>
  );
}

function CockpitSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="h-16 rounded-2xl border border-line bg-card animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[150px] rounded-2xl border border-line bg-card animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[68px] rounded-2xl border border-line bg-card animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 h-[280px] rounded-2xl border border-line bg-card animate-pulse" />
        <div className="h-[280px] rounded-2xl border border-line bg-card animate-pulse" />
      </div>
    </div>
  );
}
