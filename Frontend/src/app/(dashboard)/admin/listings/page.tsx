import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import type { Listing, PaginatedResponse } from '@/types';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { userId, getToken } = await auth();
  if (!userId) redirect('/sign-in');
  const token = await getToken();
  const { page = '1' } = await searchParams;

  const { data: listings, total } = await api.get<PaginatedResponse<Listing>>(
    `/listings/all?page=${page}&limit=20`,
    token ?? undefined,
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Toutes les annonces</h1>
        <p className="mt-1 text-sm text-sub">{total} annonce{total > 1 ? 's' : ''} au total</p>
      </div>

      {listings.length === 0 ? (
        <EmptyState icon="fa-solid fa-house" message="Aucune annonce trouvée." />
      ) : (
        <div className="flex flex-col gap-2">
          {listings.map((listing) => (
            <div key={listing.id} className="rounded-xl border border-line bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-text truncate">{listing.title}</p>
                <p className="text-sm text-sub mt-0.5">
                  <i className="fa-solid fa-location-dot text-gold-dark text-xs mr-1" />
                  {listing.city} · {formatPrice(listing.price)}/mois
                </p>
                <p className="text-xs text-sub mt-0.5">
                  <i className="fa-solid fa-user text-xs mr-1" />
                  {listing.owner?.firstName} {listing.owner?.lastName}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={listing.status} />
                <Link
                  href={`/listings/${listing.id}`}
                  className="text-sm font-medium text-gold-dark hover:underline"
                >
                  Voir <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination page={parseInt(page)} total={total} limit={20} />
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE:    'Active',
  DRAFT:     'Brouillon',
  RENTED:    'Louée',
  SUSPENDED: 'Suspendue',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-700',
  DRAFT:     'bg-amber-50 text-amber-700 border border-amber-200',
  RENTED:    'bg-blue-50 text-blue-700',
  SUSPENDED: 'bg-card text-sub border border-line',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[status] ?? 'bg-card text-sub'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Pagination({ page, total, limit }: { page: number; total: number; limit: number }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-6">
      <Link
        href={`?page=${page - 1}`}
        className={`flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}
      >
        <i className="fa-solid fa-chevron-left text-xs" /> Précédent
      </Link>
      <span className="text-sm text-sub">Page {page} / {totalPages}</span>
      <Link
        href={`?page=${page + 1}`}
        className={`flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
      >
        Suivant <i className="fa-solid fa-chevron-right text-xs" />
      </Link>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
        <i className={`${icon} text-2xl text-gold-dark`} />
      </div>
      <p className="text-sub">{message}</p>
    </div>
  );
}
