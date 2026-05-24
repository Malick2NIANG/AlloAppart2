import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';

interface OwnerStats {
  totalListings: number;
  publishedListings: number;
  totalBookings: number;
  confirmedBookings: number;
  totalRevenue: number;
  avgRating: number;
}

export default async function BailleurAnalyticsPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect('/sign-in');
  const token = await getToken();

  const stats = await api.get<OwnerStats>('/analytics/owner', token ?? undefined);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Statistiques</h1>
        <p className="mt-1 text-sm text-sub">Performance de vos annonces</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <Stat icon="fa-solid fa-house"          label="Annonces publiées"          value={`${stats.publishedListings} / ${stats.totalListings}`} />
        <Stat icon="fa-solid fa-calendar-check" label="Réservations confirmées"    value={`${stats.confirmedBookings} / ${stats.totalBookings}`} />
        <Stat icon="fa-solid fa-sack-dollar"    label="Revenus totaux"             value={formatPrice(stats.totalRevenue)} />
        <Stat icon="fa-solid fa-star"           label="Note moyenne"               value={stats.avgRating ? `${stats.avgRating.toFixed(1)} / 5` : 'N/A'} />
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
