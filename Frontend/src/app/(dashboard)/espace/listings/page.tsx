'use client';

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Listing, PaginatedResponse } from '@/types';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { SkeletonListRow } from '@/components/ui/Skeleton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';

type StatusFilter = 'ALL' | 'ACTIVE' | 'DRAFT' | 'RENTED' | 'SUSPENDED';

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
  const t              = useTranslations('admin');
  const tRef           = useRef(t);
  tRef.current         = t;
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

  const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = useMemo(() => [
    { value: 'ALL',       label: t('allStatuses')      },
    { value: 'ACTIVE',    label: t('listingActive')    },
    { value: 'DRAFT',     label: t('listingDraft')     },
    { value: 'RENTED',    label: t('listingRented')    },
    { value: 'SUSPENDED', label: t('listingSuspended') },
  ], [t]);

  const STATUS_LABELS: Record<string, string> = {
    ACTIVE:    t('statusActive'),
    DRAFT:     t('statusDraft'),
    RENTED:    t('statusRented'),
    SUSPENDED: t('statusSuspended'),
  };

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
      setError(tRef.current('listingsLoadError'));
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
      toast.success(action === 'activate' ? t('toastListingActivated') : t('toastListingSuspended'));
    } catch {
      toast.error(t('errGeneric'));
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
    setDeleteModal(null);
    try {
      await api.delete(`/listings/${id}`, token);
      setListings((prev) => prev.filter((l) => l.id !== id));
      setTotal((prev) => prev - 1);
      toast.success(t('toastListingDeleted'));
    } catch {
      toast.error(t('errDelete'));
      await fetchListings(page, status, city);
    } finally {
      setActionId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">{t('listingsTitle')}</h1>
        <p className="mt-1 text-sm text-sub">{t('listingsCount', { count: total })}</p>
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
              placeholder={t('listingsCityPh')}
              className="w-full rounded-xl border border-line bg-bg py-2.5 pl-9 pr-8 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40"
            />
            {city && (
              <button
                onClick={() => { setCity(''); setPage(1); fetchListings(1, status, ''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sub hover:text-text transition-colors"
                title={t('listingsClearSearch')}
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            )}
          </div>
          <button
            onClick={() => { setPage(1); fetchListings(1, status, city); }}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-sub hover:text-text hover:border-gold transition-colors shrink-0"
            title={t('listingsSearch')}
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
          <span className="text-xs text-sub whitespace-nowrap">{t('rowsLabel')}</span>
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
            <i className="fa-solid fa-rotate-right mr-1.5" />{t('retry')}
          </button>
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-house text-2xl text-gold-dark" />
          </div>
          <p className="text-sub">{t('listingsEmpty')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {listings.map((listing) => (
            <div key={listing.id} className="rounded-xl border border-line bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-text truncate">{listing.title}</p>
                <p className="text-sm text-sub mt-0.5">
                  <i className="fa-solid fa-location-dot text-gold-dark text-xs mr-1" />
                  {listing.city} · {formatPrice(listing.price)}{t('perMonth')}
                </p>
                <p className="text-xs text-sub mt-0.5">
                  <i className="fa-solid fa-user text-xs mr-1" />
                  {listing.owner?.firstName} {listing.owner?.lastName}
                  {listing.isVerified && (
                    <span className="ml-2 text-emerald-600 font-medium">
                      <i className="fa-solid fa-shield-halved text-xs mr-0.5" />{t('alloVerifie')}
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
                  {t('view')} <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                </Link>
                {listing.status === 'SUSPENDED' || listing.status === 'DRAFT' ? (
                  <button
                    onClick={() => handleAction(listing.id, 'activate')}
                    disabled={actionId !== null}
                    className="text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                  >
                    {actionId === listing.id + 'activate'
                      ? <i className="fa-solid fa-spinner fa-spin" />
                      : <><i className="fa-solid fa-circle-check text-xs mr-1" />{t('activate')}</>}
                  </button>
                ) : listing.status === 'ACTIVE' ? (
                  <button
                    onClick={() => handleAction(listing.id, 'suspend')}
                    disabled={actionId !== null}
                    className="text-xs font-medium border border-amber-200 bg-amber-50 text-amber-700 rounded-lg px-2.5 py-1.5 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                  >
                    {actionId === listing.id + 'suspend'
                      ? <i className="fa-solid fa-spinner fa-spin" />
                      : <><i className="fa-solid fa-ban text-xs mr-1" />{t('suspend')}</>}
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
            <i className="fa-solid fa-chevron-left text-xs" /> {t('previous')}
          </button>
          <span className="text-sm text-sub">{t('pageOf', { page, total: totalPages })}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text disabled:pointer-events-none disabled:opacity-40"
          >
            {t('next')} <i className="fa-solid fa-chevron-right text-xs" />
          </button>
        </div>
      )}

      <ConfirmModal
        open={deleteModal !== null}
        onClose={() => setDeleteModal(null)}
        onConfirm={handleDelete}
        title={t('confirmDeleteListingTitle')}
        description={t('confirmDeleteListingDesc')}
        confirmLabel={t('delete')}
        variant="danger"
      />
    </div>
  );
}
