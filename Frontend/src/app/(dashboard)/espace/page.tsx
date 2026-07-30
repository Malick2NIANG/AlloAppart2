import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { DismissibleAlerts } from './DismissibleAlerts';

interface AdminStats {
  totalUsers: number;
  totalListings: number;
  publishedListings: number;
  totalBookings: number;
  totalRevenue: number;
  pendingVerifications: number;
  confirmedBookings: number;
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

export default async function AdminDashboardPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect('/sign-in');
  const token = await getToken();
  const t = await getTranslations('admin');

  const [stats, extended, alerts] = await Promise.all([
    api.get<AdminStats>('/analytics/admin', token ?? undefined),
    api.get<AdminExtended>('/analytics/admin/extended', token ?? undefined),
    api.get<AdminAlerts>('/analytics/admin/alerts', token ?? undefined),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text">{t('overviewTitle')}</h1>
        <p className="mt-1 text-sm text-sub">{t('overviewSubtitle')}</p>
      </div>

      {/* Alerts */}
      <DismissibleAlerts
        overdueVerifications={alerts.overdueVerifications}
        expiringSubscriptions={alerts.expiringSubscriptions}
        suspendedListings={alerts.suspendedListings}
      />

      {/* KPIs principaux */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sub">
          {t('kpiGlobal')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Stat icon="fa-solid fa-users"          label={t('kpiUsers')}         value={String(stats.totalUsers)} />
          <Stat icon="fa-solid fa-house"          label={t('kpiListings')}      value={`${stats.publishedListings} / ${stats.totalListings}`} />
          <Stat icon="fa-solid fa-calendar-check" label={t('kpiBookings')}      value={String(stats.totalBookings)} />
          <Stat icon="fa-solid fa-sack-dollar"    label={t('kpiRevenue')}       value={formatPrice(stats.totalRevenue)} />
          <Stat icon="fa-solid fa-shield-halved"  label={t('kpiVerifsPending')} value={String(stats.pendingVerifications)} />
          <Stat icon="fa-solid fa-circle-check"   label={t('kpiVerifsDone')}    value={String(stats.completedVerifications)} />
        </div>
      </div>

      {/* Activité 30 derniers jours */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sub">
          {t('last30Days')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon="fa-solid fa-user-plus"          label={t('newUsers')}     value={String(extended.last30Days.newUsers)}    accent="blue" />
          <Stat icon="fa-solid fa-house-circle-check" label={t('newListings')}  value={String(extended.last30Days.newListings)} accent="blue" />
          <Stat icon="fa-solid fa-file-contract"      label={t('newBookings')}  value={String(extended.last30Days.newBookings)} accent="blue" />
          <Stat icon="fa-solid fa-coins"              label={t('monthRevenue')} value={formatPrice(extended.last30Days.revenue)} accent="blue" />
        </div>
      </div>

      {/* Répartition des rôles */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sub">
          {t('roleBreakdown')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <RoleCard icon="fa-solid fa-person"        label={t('roleLocataires')}  count={extended.roleBreakdown.totalLocataires} />
          <RoleCard icon="fa-solid fa-house-chimney" label={t('roleBailleurs')}   count={extended.roleBreakdown.totalBailleurs} />
          <RoleCard icon="fa-solid fa-building"      label={t('roleProAgences')}  count={extended.roleBreakdown.totalProAgences} />
          <RoleCard icon="fa-solid fa-user-shield"   label={t('roleAgents')}      count={extended.roleBreakdown.totalAgents} />
        </div>
      </div>

      {/* Statuts annonces & réservations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StatusBlock
          title={t('listingsByStatus')}
          icon="fa-solid fa-house"
          items={[
            { key: 'active',    label: t('listingActive'),    value: extended.listingsByStatus.ACTIVE,    color: 'text-emerald-600' },
            { key: 'draft',     label: t('listingDraft'),     value: extended.listingsByStatus.DRAFT,     color: 'text-amber-600'   },
            { key: 'rented',    label: t('listingRented'),    value: extended.listingsByStatus.RENTED,    color: 'text-blue-600'    },
            { key: 'suspended', label: t('listingSuspended'), value: extended.listingsByStatus.SUSPENDED, color: 'text-red-500'     },
          ]}
        />
        <StatusBlock
          title={t('bookingsByStatus')}
          icon="fa-solid fa-calendar-check"
          items={[
            { key: 'pending',   label: t('bookingPending'),   value: extended.bookingsByStatus.PENDING,   color: 'text-amber-600'   },
            { key: 'confirmed', label: t('bookingConfirmed'), value: extended.bookingsByStatus.CONFIRMED, color: 'text-blue-600'    },
            { key: 'completed', label: t('bookingCompleted'), value: extended.bookingsByStatus.COMPLETED, color: 'text-emerald-600' },
            { key: 'cancelled', label: t('bookingCancelled'), value: extended.bookingsByStatus.CANCELLED, color: 'text-red-500'     },
          ]}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  accent = 'gold',
}: {
  label: string;
  value: string;
  icon: string;
  accent?: 'gold' | 'blue';
}) {
  const bg = accent === 'blue' ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-gold-pale';
  const fg = accent === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-gold-dark';
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
        <i className={`${icon} ${fg}`} />
      </div>
      <p className="text-2xl font-bold text-text">{value}</p>
      <p className="mt-1 text-sm text-sub">{label}</p>
    </div>
  );
}

function RoleCard({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 text-center">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gold-pale">
        <i className={`${icon} text-gold-dark`} />
      </div>
      <p className="text-xl font-bold text-text">{count}</p>
      <p className="mt-0.5 text-xs text-sub">{label}</p>
    </div>
  );
}

function StatusBlock({
  title,
  icon,
  items,
}: {
  title: string;
  icon: string;
  items: { key: string; label: string; value: number; color: string }[];
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <i className={`${icon} text-sub text-sm`} />
        <h3 className="text-sm font-semibold text-text">{title}</h3>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <span className="text-sm text-sub">{item.label}</span>
            <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
