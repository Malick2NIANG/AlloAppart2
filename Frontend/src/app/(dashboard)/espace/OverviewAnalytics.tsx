'use client';

/**
 * Corps "cockpit" de la Vue d'ensemble admin : jauges radiales, lectures
 * glowing, graphes de tendance 12 mois, barres de répartition, donuts de
 * statut — via les composants partagés KpiWidgets/TrendCharts. Ancienne page
 * "Analytiques" (espace/analytics) fusionnée ici à la demande du client :
 * une seule page admin regroupe désormais alertes + KPIs + graphes. Ce
 * composant reste un simple corps de contenu ; le chargement des données,
 * l'horloge en direct et le bouton Actualiser vivent dans le parent
 * (espace/page.tsx), qui passe stats/extended/monthly ici en props, comme
 * DismissibleAlerts.tsx.
 */

import { useTranslations, useLocale } from 'next-intl';
import { formatPrice } from '@/lib/utils';
import {
  NEON, SectionLabel, ReadoutCard, MiniReadout, GaugeCard, RoleBar, StatusDonut,
} from '@/components/analytics/KpiWidgets';
import { RevenueBookingsChart, NewUsersChart, type MonthlyTrendPoint } from '@/components/analytics/TrendCharts';

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

export function OverviewAnalytics({
  stats, extended, monthly,
}: {
  stats: AdminStats;
  extended: AdminExtended;
  monthly: MonthlyTrendPoint[];
}) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';

  return (
    <div className="flex flex-col gap-8">
      {/* ── KPIs principaux : 2 lectures numériques + 3 jauges ──── */}
      <section>
        <SectionLabel>{t('kpiGlobal')}</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <ReadoutCard
            icon="fa-users" color={NEON.cyan}
            label={t('kpiUsers')} value={stats.totalUsers.toLocaleString(numLocale)}
          />
          <GaugeCard
            icon="fa-house" color={NEON.gold}
            label={t('kpiListings')} sub={t('analyticsListingsGaugeSub')}
            value={stats.publishedListings} max={Math.max(stats.totalListings, 1)}
            centerText={`${stats.publishedListings}/${stats.totalListings}`}
          />
          <GaugeCard
            icon="fa-calendar-check" color={NEON.blue}
            label={t('kpiBookingsTotal')} sub={t('analyticsBookingsGaugeSub')}
            value={stats.confirmedBookings} max={Math.max(stats.totalBookings, 1)}
            centerText={`${stats.confirmedBookings}/${stats.totalBookings}`}
          />
          <ReadoutCard
            icon="fa-sack-dollar" color={NEON.emerald}
            label={t('kpiRevenue')} value={formatPrice(stats.totalRevenue)}
          />
          <GaugeCard
            icon="fa-shield-halved" color={NEON.purple}
            label={t('kpiVerifsDoneLong')} sub={t('analyticsVerifsGaugeSub')}
            value={stats.completedVerifications}
            max={Math.max(stats.completedVerifications + stats.pendingVerifications, 1)}
            centerText={`${stats.completedVerifications}/${stats.completedVerifications + stats.pendingVerifications}`}
          />
        </div>
      </section>

      {/* ── 30 derniers jours ──────────────────────────────────── */}
      <section>
        <SectionLabel>{t('last30Days')}</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MiniReadout icon="fa-user-plus" color={NEON.cyan} label={t('newUsers')} value={extended.last30Days.newUsers.toLocaleString(numLocale)} />
          <MiniReadout icon="fa-house-circle-check" color={NEON.gold} label={t('newListings')} value={extended.last30Days.newListings.toLocaleString(numLocale)} />
          <MiniReadout icon="fa-file-contract" color={NEON.blue} label={t('newBookings')} value={extended.last30Days.newBookings.toLocaleString(numLocale)} />
          <MiniReadout icon="fa-coins" color={NEON.emerald} label={t('monthRevenue')} value={formatPrice(extended.last30Days.revenue)} />
        </div>
      </section>

      {/* ── Tendance 12 mois ───────────────────────────────────── */}
      <section>
        <SectionLabel>{t('analyticsTrendTitle')}</SectionLabel>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <RevenueBookingsChart monthly={monthly} gradientId="revGrad-overview" />
          <NewUsersChart monthly={monthly} gradientId="userGrad-overview" />
        </div>
      </section>

      {/* ── Répartition des rôles ──────────────────────────────── */}
      <section>
        <SectionLabel>{t('roleBreakdown')}</SectionLabel>
        <div className="rounded-2xl border border-line bg-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RoleBar icon="fa-person" color={NEON.cyan}    label={t('roleLocataires')} value={extended.roleBreakdown.totalLocataires} total={stats.totalUsers} />
          <RoleBar icon="fa-house-chimney" color={NEON.gold} label={t('roleBailleurs')} value={extended.roleBreakdown.totalBailleurs} total={stats.totalUsers} />
          <RoleBar icon="fa-building" color={NEON.blue}   label={t('roleProAgences')} value={extended.roleBreakdown.totalProAgences} total={stats.totalUsers} />
          <RoleBar icon="fa-user-shield" color={NEON.purple} label={t('roleAgents')} value={extended.roleBreakdown.totalAgents} total={stats.totalUsers} />
        </div>
      </section>

      {/* ── Statuts annonces & réservations ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatusDonut
          title={t('listingsByStatus')}
          icon="fa-house"
          total={stats.totalListings}
          items={[
            { key: 'active',    label: t('listingActive'),    value: extended.listingsByStatus.ACTIVE,    color: NEON.emerald },
            { key: 'draft',     label: t('listingDraft'),     value: extended.listingsByStatus.DRAFT,     color: NEON.amber   },
            { key: 'rented',    label: t('listingRented'),    value: extended.listingsByStatus.RENTED,    color: NEON.blue    },
            { key: 'suspended', label: t('listingSuspended'), value: extended.listingsByStatus.SUSPENDED, color: NEON.red     },
          ]}
        />
        <StatusDonut
          title={t('bookingsByStatus')}
          icon="fa-calendar-check"
          total={stats.totalBookings}
          items={[
            { key: 'pending',   label: t('bookingPending'),   value: extended.bookingsByStatus.PENDING,   color: NEON.amber   },
            { key: 'confirmed', label: t('bookingConfirmed'), value: extended.bookingsByStatus.CONFIRMED, color: NEON.blue    },
            { key: 'completed', label: t('bookingCompleted'), value: extended.bookingsByStatus.COMPLETED, color: NEON.emerald },
            { key: 'cancelled', label: t('bookingCancelled'), value: extended.bookingsByStatus.CANCELLED, color: NEON.red     },
          ]}
        />
      </div>
    </div>
  );
}
