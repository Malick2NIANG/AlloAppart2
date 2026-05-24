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

export default async function AdminAnalyticsPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect('/sign-in');
  const token = await getToken();

  const stats = await api.get<AdminStats>('/analytics/admin', token ?? undefined);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Analytiques globales</h1>
        <p className="mt-1 text-sm text-sub">Statistiques complètes de la plateforme</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <Stat icon="fa-solid fa-users"           label="Utilisateurs inscrits"      value={String(stats.totalUsers)} />
        <Stat icon="fa-solid fa-house"           label="Annonces totales"           value={String(stats.totalListings)} />
        <Stat icon="fa-solid fa-circle-check"    label="Annonces publiées"          value={String(stats.publishedListings)} />
        <Stat icon="fa-solid fa-calendar-check"  label="Réservations totales"       value={String(stats.totalBookings)} />
        <Stat icon="fa-solid fa-handshake"       label="Réservations confirmées"    value={String(stats.confirmedBookings)} />
        <Stat icon="fa-solid fa-sack-dollar"     label="Revenus totaux"             value={formatPrice(stats.totalRevenue)} />
        <Stat icon="fa-solid fa-hourglass-half"  label="Vérifications en attente"   value={String(stats.pendingVerifications)} />
        <Stat icon="fa-solid fa-shield-halved"   label="Vérifications complétées"   value={String(stats.completedVerifications)} />
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gold-pale">
        <i className={`${icon} text-gold-dark`} />
      </div>
      <p className="text-2xl font-bold text-text">{value}</p>
      <p className="mt-1 text-sm text-sub">{label}</p>
    </div>
  );
}
