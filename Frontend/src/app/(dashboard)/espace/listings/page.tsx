'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Listing, PaginatedResponse } from '@/types';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { SkeletonListRow } from '@/components/ui/Skeleton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';

type StatusFilter = 'ALL' | 'ACTIVE' | 'DRAFT' | 'RENTED' | 'SUSPENDED';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL',       label: 'Tous les statuts' },
  { value: 'ACTIVE',    label: 'Actives'           },
  { value: 'DRAFT',     label: 'Brouillons'        },
  { value: 'RENTED',    label: 'Louées'            },
  { value: 'SUSPENDED', label: 'Suspendues'        },
];

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active', DRAFT: 'Brouillon', RENTED: 'Louée', SUSPENDED: 'Suspendue',
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-700',
  DRAFT:     'bg-amber-50 text-amber-700 border border-amber-200',
  RENTED:    'bg-blue-50 text-blue-700',
  SUSPENDED: 'bg-card text-sub border border-line',
};

const SkeletonFallback = () => (
  <div className="flex flex-col gap-2">
    {Array.from({ length: 8 }).map((_, i) => <SkeletonListRow key={i} />)}
  </div>
);

export default function AdminListingsPage() {
  return (
    <Suspense fallback={<SkeletonFallback />}>
      <AdminListingsContent />
    </Suspense>
  );
}

function AdminListingsContent() {
  const { getToken }   = useAuth();
  const { toast }      = useToast();
  const searchParams   = useSearchParams();
  const defaultStatus  = (searchParams.get('status') ?? 'ALL') as StatusFilter;

  const [listings, setListings]   = useState<Listing[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [limit, setLimit]         = useState(20);
  const [status, setStatus]       = useState<StatusFilter>(defaultStatus);
  const [city, setCity]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [actionId, setActionId]   = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const LIMIT_OPTIONS = [10, 20, 50] as const;

  const fetchListings = useCallback(async (p: number, s: StatusFilter, c: string, lim = limit) => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(lim) });
      if (s !== 'ALL') params.set('status', s);
      if (c) params.set('city', c);
      const res = await api.get<PaginatedResponse<Listing>>(`/listings/all?${params}`, token);
      setListings(res.data);
      setTotal(res.total);
    } catch {
      setError('Impossible de charger les annonces.');
    } finally {
      setLoading(false);
    }
  }, [getToken, limit]);

  useEffect(() => {
    fetchListings(page, status, city);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  const handleStatusChange = (s: StatusFilter) => {
    setStatus(s);
    setPage(1);
  };

  const handleCitySearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setPage(1);
      fetchListings(1, status, city);
    }
  };

  const handleAction = async (id: string, action: 'activate' | 'suspend') => {
    const token = await getToken();
    if (!token) return;
    setActionId(id + action);
    try {
      await api.patch(`/listings/${id}/${action}`, {}, token);
      await fetchListings(page, status, city);
      toast.success(action === 'activate' ? 'Annonce activée' : 'Annonce suspendue');
    } catch {
      toast.error('Erreur. Veuillez réessayer.');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    const id = deleteModal;
    const token = await getToken();
    if (!token) return;
    setActionId(id + 'delete');
    try {
      await api.delete(`/listings/${id}`, token);
      setDeleteModal(null);
      await fetchListings(page, status, city);
      toast.success('Annonce supprimée');
    } catch {
      toast.error('Erreur lors de la suppression.');
    } finally {
      setActionId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Toutes les annonces</h1>
        <p className="mt-1 text-sm text-sub">{total} annonce{total > 1 ? 's' : ''}</p>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex flex-1 gap-2">
          <div className="relative flex-1">
            <i className="fa-solid fa-city absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-sub" />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={handleCitySearch}
              placeholder="Filtrer par ville…"
              className="w-full rounded-xl border border-line bg-bg py-2.5 pl-9 pr-4 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40"
            />
          </div>
          <button
            onClick={() => { setPage(1); fetchListings(1, status, city); }}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-sub hover:text-text hover:border-gold transition-colors shrink-0"
            title="Rechercher"
          >
            <i className="fa-solid fa-magnifying-glass text-sm" />
          </button>
        </div>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value as StatusFilter)}
          className="rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-gold"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-sub whitespace-nowrap">Lignes :</span>
          <div className="flex gap-1">
            {LIMIT_OPTIONS.map((l) => (
              <button key={l} onClick={() => { setLimit(l); setPage(1); fetchListings(1, status, city, l); }}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${limit === l ? 'bg-gold-dark text-white' : 'border border-line bg-bg text-sub hover:text-text'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonListRow key={i} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
          <p className="text-sm text-sub">{error}</p>
          <button onClick={() => fetchListings(page, status, city)} className="mt-4 btn-gold text-sm">
            <i className="fa-solid fa-rotate-right mr-1.5" />Réessayer
          </button>
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-house text-2xl text-gold-dark" />
          </div>
          <p className="text-sub">Aucune annonce trouvée.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {listings.map((listing) => (
            <div key={listing.id} className="rounded-xl border border-line bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-text truncate">{listing.title}</p>
                <p className="text-sm text-sub mt-0.5">
                  <i className="fa-solid fa-location-dot text-gold-dark text-xs mr-1" />
                  {listing.city} · {formatPrice(listing.price)}/mois
                </p>
                <p className="text-xs text-sub mt-0.5">
                  <i className="fa-solid fa-user text-xs mr-1" />
                  {listing.owner?.firstName} {listing.owner?.lastName}
                  {listing.isVerified && (
                    <span className="ml-2 text-emerald-600 font-medium">
                      <i className="fa-solid fa-shield-halved text-xs mr-0.5" />AlloVérifié
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[listing.status] ?? 'bg-card text-sub'}`}>
                  {STATUS_LABELS[listing.status] ?? listing.status}
                </span>
                <Link href={`/listings/${listing.id}`} target="_blank"
                  className="text-xs font-medium text-gold-dark hover:underline">
                  Voir <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                </Link>
                {listing.status === 'SUSPENDED' || listing.status === 'DRAFT' ? (
                  <button
                    onClick={() => handleAction(listing.id, 'activate')}
                    disabled={actionId !== null}
                    className="text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                  >
                    {actionId === listing.id + 'activate'
                      ? <i className="fa-solid fa-spinner fa-spin" />
                      : <><i className="fa-solid fa-circle-check text-xs mr-1" />Activer</>}
                  </button>
                ) : listing.status === 'ACTIVE' ? (
                  <button
                    onClick={() => handleAction(listing.id, 'suspend')}
                    disabled={actionId !== null}
                    className="text-xs font-medium border border-amber-200 bg-amber-50 text-amber-700 rounded-lg px-2.5 py-1.5 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                  >
                    {actionId === listing.id + 'suspend'
                      ? <i className="fa-solid fa-spinner fa-spin" />
                      : <><i className="fa-solid fa-ban text-xs mr-1" />Suspendre</>}
                  </button>
                ) : null}
                <button
                  onClick={() => setDeleteModal(listing.id)}
                  disabled={actionId !== null}
                  className="text-xs font-medium border border-red-200 bg-red-50 text-red-700 rounded-lg px-2.5 py-1.5 hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  {actionId === listing.id + 'delete'
                    ? <i className="fa-solid fa-spinner fa-spin" />
                    : <i className="fa-solid fa-trash text-xs" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text disabled:pointer-events-none disabled:opacity-40"
          >
            <i className="fa-solid fa-chevron-left text-xs" /> Précédent
          </button>
          <span className="text-sm text-sub">Page {page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text disabled:pointer-events-none disabled:opacity-40"
          >
            Suivant <i className="fa-solid fa-chevron-right text-xs" />
          </button>
        </div>
      )}

      <ConfirmModal
        open={deleteModal !== null}
        onClose={() => setDeleteModal(null)}
        onConfirm={handleDelete}
        title="Supprimer cette annonce ?"
        description="Cette action est irréversible. L'annonce sera définitivement supprimée."
        confirmLabel="Supprimer"
        variant="danger"
      />
    </div>
  );
}
