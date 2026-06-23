import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';

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

export default async function AdminAnalyticsPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect('/sign-in');
  const token = await getToken();

  const [stats, extended] = await Promise.all([
    api.get<AdminStats>('/analytics/admin', token ?? undefined),
    api.get<AdminExtended>('/analytics/admin/extended', token ?? undefined),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text">Analytiques globales</h1>
        <p className="mt-1 text-sm text-sub">Statistiques complètes de la plateforme</p>
      </div>

      {/* KPIs globaux */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sub">KPIs globaux</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Stat icon="fa-solid fa-users"           label="Utilisateurs inscrits"    value={String(stats.totalUsers)} />
          <Stat icon="fa-solid fa-house"           label="Annonces publiées"        value={`${stats.publishedListings} / ${stats.totalListings}`} />
          <Stat icon="fa-solid fa-calendar-check"  label="Réservations totales"     value={String(stats.totalBookings)} />
          <Stat icon="fa-solid fa-handshake"       label="Réservations confirmées"  value={String(stats.confirmedBookings)} />
          <Stat icon="fa-solid fa-sack-dollar"     label="Revenus totaux"           value={formatPrice(stats.totalRevenue)} />
          <Stat icon="fa-solid fa-hourglass-half"  label="Vérifications en attente" value={String(stats.pendingVerifications)} />
          <Stat icon="fa-solid fa-shield-halved"   label="Vérifications complétées" value={String(stats.completedVerifications)} />
        </div>
      </div>

      {/* 30 derniers jours */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sub">30 derniers jours</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Stat icon="fa-solid fa-user-plus"           label="Nouveaux inscrits"      value={String(extended.last30Days.newUsers)}    accent="blue" />
          <Stat icon="fa-solid fa-house-circle-check"  label="Nouvelles annonces"     value={String(extended.last30Days.newListings)} accent="blue" />
          <Stat icon="fa-solid fa-file-contract"       label="Nouvelles réservations" value={String(extended.last30Days.newBookings)} accent="blue" />
          <Stat icon="fa-solid fa-coins"               label="Revenus du mois"        value={formatPrice(extended.last30Days.revenue)} accent="blue" />
        </div>
      </div>

      {/* Répartition annonces & réservations */}
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
            { label: 'En attente', value: extended.bookingsByStatus.PENDING,   color: 'text-amber-600'   },
            { label: 'Confirmées', value: extended.bookingsByStatus.CONFIRMED, color: 'text-blue-600'    },
            { label: 'Terminées',  value: extended.bookingsByStatus.COMPLETED, color: 'text-emerald-600' },
            { label: 'Annulées',   value: extended.bookingsByStatus.CANCELLED, color: 'text-red-500'     },
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
