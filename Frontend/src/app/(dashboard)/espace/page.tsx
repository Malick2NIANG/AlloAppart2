import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import Link from 'next/link';

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

  const [stats, extended, alerts] = await Promise.all([
    api.get<AdminStats>('/analytics/admin', token ?? undefined),
    api.get<AdminExtended>('/analytics/admin/extended', token ?? undefined),
    api.get<AdminAlerts>('/analytics/admin/alerts', token ?? undefined),
  ]);

  const hasAlerts =
    alerts.overdueVerifications > 0 ||
    alerts.expiringSubscriptions > 0 ||
    alerts.suspendedListings > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text">Vue d&apos;ensemble</h1>
        <p className="mt-1 text-sm text-sub">Tableau de bord administrateur</p>
      </div>

      {/* Alerts */}
      {hasAlerts && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="mb-3 flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation text-amber-600" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
              Points d&apos;attention
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {alerts.overdueVerifications > 0 && (
              <Link href="/espace/verifications" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-700 hover:border-amber-400 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                <i className="fa-solid fa-shield-halved" />
                {alerts.overdueVerifications} vérif{alerts.overdueVerifications > 1 ? 's' : ''} &gt;24h sans traitement
              </Link>
            )}
            {alerts.expiringSubscriptions > 0 && (
              <Link href="/espace/subscriptions" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-700 hover:border-amber-400 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                <i className="fa-solid fa-id-card" />
                {alerts.expiringSubscriptions} abonnement{alerts.expiringSubscriptions > 1 ? 's' : ''} expirant dans 7 j
              </Link>
            )}
            {alerts.suspendedListings > 0 && (
              <Link href="/espace/listings?status=SUSPENDED" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-700 hover:border-amber-400 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                <i className="fa-solid fa-house-circle-xmark" />
                {alerts.suspendedListings} annonce{alerts.suspendedListings > 1 ? 's' : ''} suspendue{alerts.suspendedListings > 1 ? 's' : ''}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* KPIs principaux */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sub">
          KPIs globaux
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Stat icon="fa-solid fa-users"          label="Utilisateurs inscrits"    value={String(stats.totalUsers)} />
          <Stat icon="fa-solid fa-house"          label="Annonces publiées"        value={`${stats.publishedListings} / ${stats.totalListings}`} />
          <Stat icon="fa-solid fa-calendar-check" label="Réservations"             value={String(stats.totalBookings)} />
          <Stat icon="fa-solid fa-sack-dollar"    label="Revenus totaux"           value={formatPrice(stats.totalRevenue)} />
          <Stat icon="fa-solid fa-shield-halved"  label="Vérifs en attente"        value={String(stats.pendingVerifications)} />
          <Stat icon="fa-solid fa-circle-check"   label="Vérifs complétées"        value={String(stats.completedVerifications)} />
        </div>
      </div>

      {/* Activité 30 derniers jours */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sub">
          30 derniers jours
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon="fa-solid fa-user-plus"      label="Nouveaux inscrits"     value={String(extended.last30Days.newUsers)} accent="blue" />
          <Stat icon="fa-solid fa-house-circle-check" label="Nouvelles annonces" value={String(extended.last30Days.newListings)} accent="blue" />
          <Stat icon="fa-solid fa-file-contract"  label="Nouvelles réservations" value={String(extended.last30Days.newBookings)} accent="blue" />
          <Stat icon="fa-solid fa-coins"          label="Revenus du mois"        value={formatPrice(extended.last30Days.revenue)} accent="blue" />
        </div>
      </div>

      {/* Répartition des rôles */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sub">
          Répartition des utilisateurs
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <RoleCard icon="fa-solid fa-person" label="Locataires" count={extended.roleBreakdown.totalLocataires} />
          <RoleCard icon="fa-solid fa-house-chimney" label="Bailleurs" count={extended.roleBreakdown.totalBailleurs} />
          <RoleCard icon="fa-solid fa-building" label="Agences PRO" count={extended.roleBreakdown.totalProAgences} />
          <RoleCard icon="fa-solid fa-user-shield" label="Agents terrain" count={extended.roleBreakdown.totalAgents} />
        </div>
      </div>

      {/* Statuts annonces & réservations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StatusBlock
          title="Annonces par statut"
          icon="fa-solid fa-house"
          items={[
            { label: 'Actives',    value: extended.listingsByStatus.ACTIVE,    color: 'text-emerald-600' },
            { label: 'Brouillons', value: extended.listingsByStatus.DRAFT,     color: 'text-amber-600'   },
            { label: 'Louées',     value: extended.listingsByStatus.RENTED,    color: 'text-blue-600'    },
            { label: 'Suspendues', value: extended.listingsByStatus.SUSPENDED, color: 'text-red-500'     },
          ]}
        />
        <StatusBlock
          title="Réservations par statut"
          icon="fa-solid fa-calendar-check"
          items={[
            { label: 'En attente',  value: extended.bookingsByStatus.PENDING,   color: 'text-amber-600'   },
            { label: 'Confirmées',  value: extended.bookingsByStatus.CONFIRMED,  color: 'text-blue-600'    },
            { label: 'Terminées',   value: extended.bookingsByStatus.COMPLETED,  color: 'text-emerald-600' },
            { label: 'Annulées',    value: extended.bookingsByStatus.CANCELLED,  color: 'text-red-500'     },
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
  items: { label: string; value: number; color: string }[];
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <i className={`${icon} text-sub text-sm`} />
        <h3 className="text-sm font-semibold text-text">{title}</h3>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-sm text-sub">{item.label}</span>
            <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
