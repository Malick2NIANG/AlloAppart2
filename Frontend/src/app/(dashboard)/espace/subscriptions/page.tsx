'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { api } from '@/lib/api';
import type { Subscription, PaginatedResponse } from '@/types';
import { formatDate, formatPrice } from '@/lib/utils';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { StatFilterCard } from '@/components/bookings/StatFilterCard';
import { getAgencyColorHex } from '@/lib/agencyColors';

type StatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400',
  SUSPENDED: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40',
  CANCELLED: 'bg-card text-sub border border-line',
};
const PLAN_LABELS: Record<string, string> = { STARTER: 'Starter', PRO: 'Pro' };
const PLAN_COLORS: Record<string, string> = {
  STARTER: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
  PRO:     'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400',
};

const STATUS_ICONS: Record<StatusFilter, string> = {
  ALL:       'fa-layer-group',
  ACTIVE:    'fa-circle-check',
  SUSPENDED: 'fa-ban',
  CANCELLED: 'fa-box-archive',
};

// Couleurs des chips icône des StatFilterCard — mêmes teintes que STATUS_COLORS
// (badges) mais en version "chip clair", même convention que espace/listings.
const STAT_CARD_COLORS: Record<StatusFilter, { color: string; bg: string }> = {
  ALL:       { color: 'text-gold-dark',                     bg: 'bg-gold-pale' },
  ACTIVE:    { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' },
  SUSPENDED: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  CANCELLED: { color: 'text-sub',                           bg: 'bg-card' },
};

const SkeletonFallback = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
    {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} height="280px" />)}
  </div>
);

export default function AdminSubscriptionsPage() {
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const t            = useTranslations('admin');
  const tRef         = useRef(t);
  useEffect(() => { tRef.current = t; });

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [limit, setLimit]       = useState(20);
  const [status, setStatus]     = useState<StatusFilter>('ALL');
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  // Compte par statut (respecte la recherche, pas l'onglet actif) — alimente
  // les StatFilterCard, mêmes pattern que Signalements/Annonces/Réservations.
  const [statusCounts, setStatusCounts] = useState<Record<StatusFilter, number>>({ ALL: 0, ACTIVE: 0, SUSPENDED: 0, CANCELLED: 0 });
  const LIMIT_OPTIONS = [10, 20, 50] as const;

  const STATUS_LABELS: Record<string, string> = {
    ACTIVE:    t('subStatusActive'),
    SUSPENDED: t('subStatusSuspended'),
    CANCELLED: t('subStatusCancelled'),
  };

  const STATUS_TABS: { key: StatusFilter; label: string; icon: string }[] = useMemo(() => [
    { key: 'ALL',       label: t('allStatuses'),         icon: STATUS_ICONS.ALL       },
    { key: 'ACTIVE',    label: t('subStatusActive'),     icon: STATUS_ICONS.ACTIVE    },
    { key: 'SUSPENDED', label: t('subStatusSuspended'),  icon: STATUS_ICONS.SUSPENDED },
    { key: 'CANCELLED', label: t('subStatusCancelled'),  icon: STATUS_ICONS.CANCELLED },
  ], [t]);

  const fetchData = useCallback(async (p: number, s: StatusFilter, q: string, lim = limit) => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(lim) });
      if (s !== 'ALL') params.set('status', s);
      if (q) params.set('search', q);
      const res = await api.get<PaginatedResponse<Subscription>>(`/subscriptions/all?${params}`, token);
      setSubscriptions(res.data);
      setTotal(res.total);
    } catch {
      setError(tRef.current('subsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [getToken, limit]);

  useEffect(() => {
    fetchData(page, status, search);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  const fetchStatusCounts = useCallback(async (q: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      const statuses: StatusFilter[] = ['ALL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'];
      const entries = await Promise.all(statuses.map(async (s) => {
        const params = new URLSearchParams({ page: '1', limit: '1' });
        if (s !== 'ALL') params.set('status', s);
        if (q) params.set('search', q);
        const res = await api.get<PaginatedResponse<Subscription>>(`/subscriptions/all?${params}`, token);
        return [s, res.total] as const;
      }));
      setStatusCounts(Object.fromEntries(entries) as Record<StatusFilter, number>);
    } catch {
      // Purement informatif (cartes stats) — une erreur ici ne bloque pas
      // le reste de la page, déjà couvert par fetchData.
    }
  }, [getToken]);

  useEffect(() => {
    fetchStatusCounts('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStatusChange = (s: StatusFilter) => {
    setStatus(s);
    setPage(1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setPage(1);
      fetchData(1, status, search);
      fetchStatusCounts(search);
    }
  };

  const handleSuspend = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    setActionId(id + 'suspend');
    try {
      await api.patch(`/subscriptions/${id}/suspend`, {}, token);
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'SUSPENDED' } : s)),
      );
      await fetchStatusCounts(search);
      toast.success(t('toastSubSuspended'));
    } catch {
      toast.error(t('errSuspend'));
    } finally { setActionId(null); }
  };

  const handleActivate = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    setActionId(id + 'activate');
    try {
      await api.patch(`/subscriptions/${id}/activate`, {}, token);
      await fetchData(page, status, search);
      await fetchStatusCounts(search);
      toast.success(t('toastSubReactivated'));
    } catch {
      toast.error(t('errActivate'));
    } finally { setActionId(null); }
  };

  const handleExtend = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    setActionId(id + 'extend');
    try {
      await api.patch(`/subscriptions/${id}/extend`, { days: 30 }, token);
      await fetchData(page, status, search);
      toast.success(t('toastSubExtended'));
    } catch {
      toast.error(t('errExtend'));
    } finally { setActionId(null); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">{t('subsTitle')}</h1>
        <p className="mt-1 text-sm text-sub">{t('subsCount', { count: total })}</p>
      </div>

      {/* Stats par statut — doublent aussi de filtre cliquable (même pattern
          que les pages Signalements/Annonces/Réservations). */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
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
            <i className="fa-solid fa-building absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-sub" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('subsSearchPh')}
              className="w-full rounded-xl border border-line bg-bg py-2.5 pl-9 pr-8 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setPage(1); fetchData(1, status, ''); fetchStatusCounts(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sub hover:text-text transition-colors"
                title={t('subsClearSearch')}
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            )}
          </div>
          <button
            onClick={() => { setPage(1); fetchData(1, status, search); fetchStatusCounts(search); }}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-sub hover:text-text hover:border-gold transition-colors shrink-0"
            title={t('subsSearch')}
          >
            <i className="fa-solid fa-magnifying-glass text-sm" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-sub whitespace-nowrap">{t('rowsLabel')}</span>
          <div className="flex gap-1">
            {LIMIT_OPTIONS.map((l) => (
              <button key={l} onClick={() => { setLimit(l); setPage(1); fetchData(1, status, search, l); }}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${limit === l ? 'bg-gold-dark text-white' : 'border border-line bg-bg text-sub hover:text-text'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonFallback />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
          <p className="text-sm text-sub">{error}</p>
          <button onClick={() => fetchData(page, status, search)} className="mt-4 btn-gold text-sm">
            <i className="fa-solid fa-rotate-right mr-1.5" />{t('retry')}
          </button>
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-id-card text-2xl text-gold-dark" />
          </div>
          <p className="text-sub">{t('subsEmpty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {subscriptions.map((sub) => (
            <AdminSubscriptionCard
              key={sub.id}
              sub={sub}
              statusLabel={STATUS_LABELS[sub.status] ?? sub.status}
              statusColor={STATUS_COLORS[sub.status] ?? 'bg-card text-sub'}
              actionId={actionId}
              onExtend={() => handleExtend(sub.id)}
              onSuspend={() => handleSuspend(sub.id)}
              onActivate={() => handleActivate(sub.id)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text disabled:pointer-events-none disabled:opacity-40">
            <i className="fa-solid fa-chevron-left text-xs" /> {t('previous')}
          </button>
          <span className="text-sm text-sub">{t('pageOf', { page, total: totalPages })}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text disabled:pointer-events-none disabled:opacity-40">
            {t('next')} <i className="fa-solid fa-chevron-right text-xs" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── AdminSubscriptionCard ────────────────────────────────────────────────────
// Même coquille visuelle que AdminListingCard/AdminReportCard (photo + statut
// en overlay, actions séparées par un trait) — la "photo" est ici l'avatar de
// l'agence (agencyAvatar, repli sur avatar personnel), avec un cercle
// d'initiales thémé par agencyColor quand aucune des deux n'est renseignée.

function AdminSubscriptionCard({
  sub, statusLabel, statusColor, actionId, onExtend, onSuspend, onActivate,
}: {
  sub: Subscription;
  statusLabel: string;
  statusColor: string;
  actionId: string | null;
  onExtend: () => void;
  onSuspend: () => void;
  onActivate: () => void;
}) {
  const t = useTranslations('admin');
  const agencyName = sub.user?.agencyName || `${sub.user?.firstName ?? ''} ${sub.user?.lastName ?? ''}`.trim();
  const photo = sub.user?.agencyAvatar || sub.user?.avatar || null;
  const accentHex = getAgencyColorHex(sub.user?.agencyColor);
  const initials = (agencyName || sub.user?.email || '?').trim().slice(0, 2).toUpperCase();

  return (
    <div className="listing-card group flex flex-col">
      {/* Photo (avatar agence) + statut */}
      <div className="relative h-40 overflow-hidden rounded-t-2xl">
        {photo ? (
          <Image
            src={photo}
            alt={agencyName}
            fill
            className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${accentHex}33, ${accentHex}77)` }}
          >
            <span
              className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white shadow-md"
              style={{ backgroundColor: accentHex }}
            >
              {initials}
            </span>
          </div>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute top-3 left-3">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
        </div>
        <div className="absolute top-3 right-3">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PLAN_COLORS[sub.plan] ?? 'bg-card text-sub'}`}>
            {PLAN_LABELS[sub.plan] ?? sub.plan}
          </span>
        </div>
      </div>

      {/* Agence + tarif + échéance */}
      <div className="p-4 flex-1">
        <p className="font-semibold text-text truncate">{agencyName || sub.user?.email}</p>
        <p className="text-sm text-sub mt-0.5 truncate">{sub.user?.email}</p>
        <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-sub">
          <span><i className="fa-solid fa-coins mr-1" />{formatPrice(sub.monthlyFee)}{t('perMonth')}</span>
          {sub.endDate && (
            <span className={`font-medium ${
              // eslint-disable-next-line react-hooks/purity -- lecture de l'heure courante pour signaler visuellement une échéance à J-7, snapshot voulu au rendu
              new Date(sub.endDate) < new Date(Date.now() + 7 * 86400000)
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-sub'
            }`}>
              <i className="fa-regular fa-calendar mr-1" />
              {t('subExpiresOn', { date: formatDate(sub.endDate) })}
            </span>
          )}
        </div>
      </div>

      {/* Actions — même gabarit que AdminListingCard */}
      <div className="border-t border-line p-4 pt-3 flex items-center gap-2 flex-wrap">
        {sub.status === 'ACTIVE' ? (
          <>
            <button onClick={onExtend} disabled={actionId !== null}
              className="text-xs font-medium border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-lg px-2.5 py-1.5 hover:bg-blue-100 dark:hover:bg-blue-950/40 disabled:opacity-50 transition-colors">
              {actionId === sub.id + 'extend'
                ? <i className="fa-solid fa-spinner fa-spin" />
                : <><i className="fa-solid fa-plus text-xs mr-1" />{t('extend30Days')}</>}
            </button>
            <button onClick={onSuspend} disabled={actionId !== null}
              className="ml-auto text-xs font-medium border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-lg px-2.5 py-1.5 hover:bg-amber-100 dark:hover:bg-amber-950/40 disabled:opacity-50 transition-colors">
              {actionId === sub.id + 'suspend'
                ? <i className="fa-solid fa-spinner fa-spin" />
                : <><i className="fa-solid fa-ban text-xs mr-1" />{t('suspend')}</>}
            </button>
          </>
        ) : sub.status === 'SUSPENDED' ? (
          <button onClick={onActivate} disabled={actionId !== null}
            className="ml-auto text-xs font-medium border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 disabled:opacity-50 transition-colors">
            {actionId === sub.id + 'activate'
              ? <i className="fa-solid fa-spinner fa-spin" />
              : <><i className="fa-solid fa-circle-check text-xs mr-1" />{t('reactivate')}</>}
          </button>
        ) : (
          <span className="text-xs text-sub">{t('subStatusCancelled')}</span>
        )}
      </div>
    </div>
  );
}
