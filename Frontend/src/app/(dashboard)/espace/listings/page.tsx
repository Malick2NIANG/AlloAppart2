'use client';

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { api } from '@/lib/api';
import { getListingPriceAmounts, type Listing, type PaginatedResponse } from '@/types';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import { StatFilterCard } from '@/components/bookings/StatFilterCard';

type StatusFilter = 'ALL' | 'ACTIVE' | 'DRAFT' | 'RENTED' | 'SUSPENDED';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400',
  DRAFT:     'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40',
  RENTED:    'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
  SUSPENDED: 'bg-card text-sub border border-line',
};

const STATUS_ICONS: Record<StatusFilter, string> = {
  ALL:       'fa-layer-group',
  ACTIVE:    'fa-circle-check',
  DRAFT:     'fa-pen-to-square',
  RENTED:    'fa-key',
  SUSPENDED: 'fa-box-archive',
};

// Couleurs des chips icône des StatFilterCard — mêmes teintes que STATUS_COLORS
// (badges) mais en version "chip clair" (bg-*-50/950 + texte 600/400) pour
// rester lisible sur un fond de carte plutôt qu'en overlay sur une photo.
const STAT_CARD_COLORS: Record<StatusFilter, { color: string; bg: string }> = {
  ALL:       { color: 'text-gold-dark',                          bg: 'bg-gold-pale' },
  ACTIVE:    { color: 'text-green-600 dark:text-green-400',      bg: 'bg-green-50 dark:bg-green-950/30' },
  DRAFT:     { color: 'text-amber-600 dark:text-amber-400',      bg: 'bg-amber-50 dark:bg-amber-950/30' },
  RENTED:    { color: 'text-blue-600 dark:text-blue-400',        bg: 'bg-blue-50 dark:bg-blue-950/30' },
  SUSPENDED: { color: 'text-sub',                                bg: 'bg-card' },
};

const FALLBACK_IMG = 'https://via.placeholder.com/600x400?text=AlloAppart';

const SkeletonFallback = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
    {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} height="280px" />)}
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
  useEffect(() => { tRef.current = t; });
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
  // Compte par statut (respecte la recherche ville, pas l'onglet actif) —
  // alimente les StatFilterCard, qui doublent de filtre cliquable (même
  // pattern que les pages Signalements/Réservations). Rafraîchi à chaque
  // recherche explicite (Entrée/loupe/croix) et après toute action qui
  // change le statut d'une annonce (activer/suspendre/supprimer).
  const [statusCounts, setStatusCounts] = useState<Record<StatusFilter, number>>({ ALL: 0, ACTIVE: 0, DRAFT: 0, RENTED: 0, SUSPENDED: 0 });
  const LIMIT_OPTIONS = [10, 20, 50] as const;

  const STATUS_TABS: { key: StatusFilter; label: string; icon: string }[] = useMemo(() => [
    { key: 'ALL',       label: t('allStatuses'),      icon: STATUS_ICONS.ALL       },
    { key: 'ACTIVE',    label: t('listingActive'),    icon: STATUS_ICONS.ACTIVE    },
    { key: 'DRAFT',     label: t('listingDraft'),     icon: STATUS_ICONS.DRAFT     },
    { key: 'RENTED',    label: t('listingRented'),    icon: STATUS_ICONS.RENTED    },
    { key: 'SUSPENDED', label: t('listingSuspended'), icon: STATUS_ICONS.SUSPENDED },
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

  const fetchStatusCounts = useCallback(async (c: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      const statuses: StatusFilter[] = ['ALL', 'ACTIVE', 'DRAFT', 'RENTED', 'SUSPENDED'];
      const entries = await Promise.all(statuses.map(async (s) => {
        const params = new URLSearchParams({ page: '1', limit: '1' });
        if (s !== 'ALL') params.set('status', s);
        if (c) params.set('city', c);
        const res = await api.get<PaginatedResponse<Listing>>(`/listings/all?${params}`, token);
        return [s, res.total] as const;
      }));
      setStatusCounts(Object.fromEntries(entries) as Record<StatusFilter, number>);
    } catch {
      // Purement informatif (cartes stats) — une erreur ici ne bloque pas
      // le reste de la page, déjà couvert par fetchListings.
    }
  }, [getToken]);

  useEffect(() => {
    fetchStatusCounts(city);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStatusChange = (s: StatusFilter) => {
    setStatus(s);
    setPage(1);
  };

  const handleCitySearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setPage(1);
      fetchListings(1, status, city);
      fetchStatusCounts(city);
    }
  };

  const handleAction = async (id: string, action: 'activate' | 'suspend') => {
    const token = await getToken();
    if (!token) return;
    setActionId(id + action);
    try {
      await api.patch(`/listings/${id}/${action}`, {}, token);
      await fetchListings(page, status, city);
      await fetchStatusCounts(city);
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
      await fetchStatusCounts(city);
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

      {/* Stats par statut — doublent aussi de filtre cliquable (même pattern
          que les pages Signalements/Réservations). */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {STATUS_TABS.map((tab) => (
          <StatFilterCard
            key={tab.key}
            icon={tab.icon}
            label={tab.label}
            value={statusCounts[tab.key]}
            color={STAT_CARD_COLORS[tab.key].color}
            bg={STAT_CARD_COLORS[tab.key].bg}
            active={status === tab.key}
            onClick={() => handleStatusChange(tab.key)}
            selectedLabel={t('filterSelected')}
          />
        ))}
      </div>

      {/* Recherche + lignes par page */}
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
                onClick={() => { setCity(''); setPage(1); fetchListings(1, status, ''); fetchStatusCounts(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sub hover:text-text transition-colors"
                title={t('listingsClearSearch')}
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            )}
          </div>
          <button
            onClick={() => { setPage(1); fetchListings(1, status, city); fetchStatusCounts(city); }}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-sub hover:text-text hover:border-gold transition-colors shrink-0"
            title={t('listingsSearch')}
          >
            <i className="fa-solid fa-magnifying-glass text-sm" />
          </button>
        </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} height="280px" />)}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {listings.map((listing) => (
            <AdminListingCard
              key={listing.id}
              listing={listing}
              statusLabel={STATUS_LABELS[listing.status] ?? listing.status}
              statusColor={STATUS_COLORS[listing.status] ?? 'bg-card text-sub'}
              actionId={actionId}
              onActivate={() => handleAction(listing.id, 'activate')}
              onSuspend={() => handleAction(listing.id, 'suspend')}
              onDelete={() => setDeleteModal(listing.id)}
            />
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

// ── AdminListingCard ─────────────────────────────────────────────────────────
// Même coquille visuelle que BookingCard (photo + statut en overlay, actions
// dans une zone séparée par un séparateur) — uniformise cette page avec les 3
// pages "réservations" déjà converties en cartes, sans toucher aux actions
// admin propres à cette page (activer/suspendre/supprimer/voir).

function AdminListingCard({
  listing, statusLabel, statusColor, actionId, onActivate, onSuspend, onDelete,
}: {
  listing: Listing;
  statusLabel: string;
  statusColor: string;
  actionId: string | null;
  onActivate: () => void;
  onSuspend: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('admin');
  const img = listing.images?.[0] ?? FALLBACK_IMG;

  return (
    <div className="listing-card group flex flex-col">
      {/* Photo + statut */}
      <div className="relative h-40 overflow-hidden rounded-t-2xl">
        <Image
          src={img}
          alt={listing.title}
          fill
          className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
          sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute top-3 left-3">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
        </div>
      </div>

      {/* Bien + prix + propriétaire */}
      <div className="p-4 flex-1">
        <p className="font-semibold text-text truncate">{listing.title}</p>
        <p className="text-sm text-sub mt-1">
          <i className="fa-solid fa-location-dot text-gold-dark text-xs mr-1" />
          {listing.city} ·{' '}
          {getListingPriceAmounts(listing)
            .map((e) => `${formatPrice(e.amount)}${t(e.unit === 'night' ? 'perNight' : 'perMonth')}`)
            .join(' · ')}
        </p>
        <p className="text-xs text-sub mt-1">
          <i className="fa-solid fa-user text-xs mr-1" />
          {listing.owner?.firstName} {listing.owner?.lastName}
          {listing.isVerified && (
            <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-medium">
              <i className="fa-solid fa-shield-halved text-xs mr-0.5" />{t('alloVerifie')}
            </span>
          )}
        </p>
      </div>

      {/* Actions — même gabarit que BookingCard */}
      <div className="border-t border-line p-4 pt-3 flex items-center gap-2 flex-wrap">
        <Link href={`/listings/${listing.id}`} target="_blank" rel="noopener noreferrer"
          className="text-xs font-medium text-gold-dark hover:underline">
          {t('view')} <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
        </Link>
        {listing.status === 'SUSPENDED' || listing.status === 'DRAFT' ? (
          <button
            onClick={onActivate}
            disabled={actionId !== null}
            className="text-xs font-medium border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 disabled:opacity-50 transition-colors"
          >
            {actionId === listing.id + 'activate'
              ? <i className="fa-solid fa-spinner fa-spin" />
              : <><i className="fa-solid fa-circle-check text-xs mr-1" />{t('activate')}</>}
          </button>
        ) : listing.status === 'ACTIVE' ? (
          <button
            onClick={onSuspend}
            disabled={actionId !== null}
            className="text-xs font-medium border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-lg px-2.5 py-1.5 hover:bg-amber-100 dark:hover:bg-amber-950/40 disabled:opacity-50 transition-colors"
          >
            {actionId === listing.id + 'suspend'
              ? <i className="fa-solid fa-spinner fa-spin" />
              : <><i className="fa-solid fa-ban text-xs mr-1" />{t('suspend')}</>}
          </button>
        ) : null}
        <button
          onClick={onDelete}
          disabled={actionId !== null}
          className="ml-auto text-xs font-medium border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg px-2.5 py-1.5 hover:bg-red-100 dark:hover:bg-red-950/40 disabled:opacity-50 transition-colors"
        >
          {actionId === listing.id + 'delete'
            ? <i className="fa-solid fa-spinner fa-spin" />
            : <i className="fa-solid fa-trash text-xs" />}
        </button>
      </div>
    </div>
  );
}
