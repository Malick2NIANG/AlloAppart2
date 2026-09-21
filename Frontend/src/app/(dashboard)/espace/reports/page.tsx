'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatFilterCard } from '@/components/bookings/StatFilterCard';

// ── Types ────────────────────────────────────────────────────────────────────

interface ReportEntry {
  id: string;
  reason: string;
  description: string | null;
  createdAt: string;
  reporter: { id: string; name: string; email: string };
}

interface ListingReport {
  listingId: string;
  title: string;
  city: string;
  status: string;
  images: string[];
  ownerName: string;
  reportCount: number;
  reasons: string[];
  lastReportAt: string | null;
  reports: ReportEntry[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const REASON_ICONS: Record<string, string> = {
  FRAUD:          'fa-triangle-exclamation',
  WRONG_PRICE:    'fa-tag',
  WRONG_PHOTOS:   'fa-image',
  ALREADY_RENTED: 'fa-lock',
  WRONG_LOCATION: 'fa-location-dot',
  OFFENSIVE:      'fa-ban',
  OTHER:          'fa-ellipsis',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400',
  DRAFT:     'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40',
  RENTED:    'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
  SUSPENDED: 'bg-card text-sub border border-line',
};

const HIGH_THRESHOLD = 3; // seuil : badge rouge + priorité
const FALLBACK_IMG = 'https://via.placeholder.com/600x400?text=AlloAppart';

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminReportsPage() {
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const t            = useTranslations('admin');
  const locale       = useLocale();
  const numLocale    = locale === 'en' ? 'en-US' : 'fr-FR';
  const tRef         = useRef(t);
  tRef.current       = t;

  const [items,    setItems]    = useState<ListingReport[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<'ALL' | 'HIGH' | 'SUSPENDED'>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirm,  setConfirm]  = useState<{ listingId: string; title: string; action: 'suspend' | 'restore' } | null>(null);

  const REASON_LABELS: Record<string, string> = {
    FRAUD:          t('reasonFraud'),
    WRONG_PRICE:    t('reasonWrongPrice'),
    WRONG_PHOTOS:   t('reasonWrongPhotos'),
    ALREADY_RENTED: t('reasonAlreadyRented'),
    WRONG_LOCATION: t('reasonWrongLocation'),
    OFFENSIVE:      t('reasonOffensive'),
    OTHER:          t('reasonOther'),
  };
  const STATUS_LABELS: Record<string, string> = {
    ACTIVE:    t('statusActive'),
    DRAFT:     t('statusDraft'),
    RENTED:    t('statusRented'),
    SUSPENDED: t('statusSuspended'),
  };

  const fmtShortDate = (d: string) =>
    new Date(d).toLocaleDateString(numLocale, { day: '2-digit', month: 'short', year: 'numeric' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const data = await api.get<ListingReport[]>('/listings/reports', token ?? undefined);
      setItems(data);
    } catch {
      toast.error(tRef.current('reportsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [getToken, toast]);

  useEffect(() => { void load(); }, [load]);

  const displayed = filter === 'HIGH'
    ? items.filter((i) => i.reportCount >= HIGH_THRESHOLD)
    : filter === 'SUSPENDED'
      ? items.filter((i) => i.status === 'SUSPENDED')
      : items;

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleAction = async () => {
    if (!confirm) return;
    try {
      const token = await getToken();
      if (confirm.action === 'suspend') {
        await api.patch(`/listings/${confirm.listingId}/suspend`, {}, token ?? undefined);
        toast.success(t('toastListingSuspendedShort'));
      } else {
        await api.patch(`/listings/${confirm.listingId}/restore`, { status: 'ACTIVE' }, token ?? undefined);
        toast.success(t('toastListingRestored'));
      }
      setConfirm(null);
      await load();
      // Rafraîchit immédiatement le badge sidebar "Signalements" (suspendre
      // sort l'annonce du compteur ; restaurer peut l'y remettre si elle a
      // encore des signalements) — cf. doc interne de DashboardShell.
      window.dispatchEvent(new CustomEvent('aa-badges-updated', { detail: { kind: 'REPORTS' } }));
    } catch {
      // Contrairement à load(), cet appel n'avait aucune gestion d'erreur : un
      // échec réseau/serveur laissait la modale ouverte sans aucun retour visible
      // pour l'admin, qui pouvait croire l'action passée alors que rien n'avait
      // changé côté backend.
      toast.error(confirm.action === 'suspend' ? t('errSuspendListing') : t('errRestoreListing'));
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">{t('reportsTitle')}</h1>
        <p className="mt-1 text-sm text-sub">
          {t('reportsSubtitlePre')}{' '}
          <span className="font-semibold text-red-600 dark:text-red-400">{t('reportsThreshold', { count: HIGH_THRESHOLD })}</span>{' '}
          {t('reportsSubtitlePost')}
        </p>
      </div>

      {/* Stats — doublent aussi de filtre cliquable, même logique que les
          cartes de filtre de bailleur/listings (une seule source de vérité
          pour le filtre actif, plus besoin des boutons Tous/≥N séparés). */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatFilterCard
          icon="fa-flag"
          label={t('reportsStatReported')}
          value={items.length}
          color="text-amber-600 dark:text-amber-400"
          bg="bg-amber-50 dark:bg-amber-950/30"
          active={filter === 'ALL'}
          onClick={() => setFilter('ALL')}
          selectedLabel={t('filterSelected')}
        />
        <StatFilterCard
          icon="fa-triangle-exclamation"
          label={t('reportsStatHigh', { count: HIGH_THRESHOLD })}
          value={items.filter((i) => i.reportCount >= HIGH_THRESHOLD).length}
          color="text-red-600 dark:text-red-400"
          bg="bg-red-50 dark:bg-red-950/30"
          active={filter === 'HIGH'}
          onClick={() => setFilter('HIGH')}
          selectedLabel={t('filterSelected')}
        />
        <StatFilterCard
          icon="fa-pause-circle"
          label={t('reportsStatSuspended')}
          value={items.filter((i) => i.status === 'SUSPENDED').length}
          color="text-sub"
          bg="bg-card"
          active={filter === 'SUSPENDED'}
          onClick={() => setFilter('SUSPENDED')}
          selectedLabel={t('filterSelected')}
        />
      </div>

      {/* Annonces signalées */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} height="320px" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-sub">
          <i className="fa-regular fa-flag text-3xl" />
          <p className="text-sm">
            {filter === 'HIGH'
              ? t('reportsEmptyThreshold')
              : filter === 'SUSPENDED'
                ? t('reportsEmptySuspended')
                : t('reportsEmpty')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayed.map((item) => (
            <AdminReportCard
              key={item.listingId}
              item={item}
              isExpanded={expanded === item.listingId}
              onToggleExpand={() => setExpanded(expanded === item.listingId ? null : item.listingId)}
              statusLabel={STATUS_LABELS[item.status] ?? item.status}
              statusColor={STATUS_COLORS[item.status] ?? 'bg-card text-sub'}
              reasonLabels={REASON_LABELS}
              fmtShortDate={fmtShortDate}
              onSuspend={() => setConfirm({ listingId: item.listingId, title: item.title, action: 'suspend' })}
              onRestore={() => setConfirm({ listingId: item.listingId, title: item.title, action: 'restore' })}
            />
          ))}
        </div>
      )}

      {/* Confirm modal */}
      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleAction}
        title={confirm?.action === 'suspend' ? t('confirmSuspendListingTitle') : t('confirmRestoreListingTitle')}
        description={
          confirm?.action === 'suspend'
            ? t('confirmSuspendListingDesc', { title: confirm?.title ?? '' })
            : t('confirmRestoreListingDesc', { title: confirm?.title ?? '' })
        }
        confirmLabel={confirm?.action === 'suspend' ? t('suspend') : t('reactivate')}
        variant={confirm?.action === 'suspend' ? 'danger' : 'default'}
      />
    </div>
  );
}

// ── AdminReportCard ──────────────────────────────────────────────────────────

function AdminReportCard({
  item, isExpanded, onToggleExpand, statusLabel, statusColor, reasonLabels, fmtShortDate, onSuspend, onRestore,
}: {
  item: ListingReport;
  isExpanded: boolean;
  onToggleExpand: () => void;
  statusLabel: string;
  statusColor: string;
  reasonLabels: Record<string, string>;
  fmtShortDate: (d: string) => string;
  onSuspend: () => void;
  onRestore: () => void;
}) {
  const t = useTranslations('admin');
  const img = item.images?.[0] ?? FALLBACK_IMG;
  const isHigh = item.reportCount >= HIGH_THRESHOLD;
  const isSuspended = item.status === 'SUSPENDED';

  return (
    <div className="flex flex-col gap-3">
      <div className={`listing-card group flex flex-col ${isHigh ? 'border-red-300 dark:border-red-900/60' : ''}`}>
        {/* Photo + statut */}
        <div className="relative h-40 overflow-hidden rounded-t-2xl">
          <Image
            src={img}
            alt={item.title}
            fill
            className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw"
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute top-3 left-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <div className="absolute top-3 right-3">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
              isHigh ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40'
            }`}>
              {isHigh && <i className="fa-solid fa-triangle-exclamation text-[9px]" />}
              <i className="fa-solid fa-flag text-[9px]" />
              {item.reportCount}
            </span>
          </div>
        </div>

        {/* Annonce + motifs */}
        <div className="p-4 flex-1">
          <p className="font-semibold text-text truncate">{item.title}</p>
          <p className="text-sm text-sub mt-0.5">
            <i className="fa-solid fa-location-dot text-gold-dark text-xs mr-1" />
            {item.city}
            <span className="mx-1.5">·</span>
            {item.ownerName}
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {item.reasons.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 rounded-full bg-card border border-line px-2 py-0.5 text-[10px] text-sub"
              >
                <i className={`fa-solid ${REASON_ICONS[r] ?? 'fa-flag'} text-[9px]`} />
                {reasonLabels[r] ?? r}
              </span>
            ))}
          </div>
          {item.lastReportAt && (
            <p className="text-xs text-sub mt-2">
              <i className="fa-regular fa-clock text-xs mr-1" />
              {fmtShortDate(item.lastReportAt)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-line p-4 pt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={onToggleExpand}
            className="rounded-lg px-2.5 py-1.5 text-xs text-sub border border-line hover:text-text hover:border-line/80 transition"
            title={t('titleViewReports')}
          >
            <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} mr-1`} />
            {t('titleViewReports')}
          </button>
          <a
            href={`/listings/${item.listingId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-2.5 py-1.5 text-xs text-sub border border-line hover:text-text transition"
            title={t('titleViewListing')}
          >
            <i className="fa-solid fa-arrow-up-right-from-square" />
          </a>
          {isSuspended ? (
            <button
              onClick={onRestore}
              className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition"
            >
              {t('reactivate')}
            </button>
          ) : (
            <button
              onClick={onSuspend}
              className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition"
            >
              {t('suspend')}
            </button>
          )}
        </div>
      </div>

      {/* Détail des signalements (dépliable) */}
      {isExpanded && (
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-xs font-semibold text-sub uppercase tracking-wide mb-3">
            {t('reportsDetailTitle')}
          </p>
          <div className="space-y-2">
            {item.reports.map((r) => (
              <div
                key={r.id}
                className="flex flex-col sm:flex-row sm:items-start gap-2 rounded-xl border border-line bg-bg px-4 py-3"
              >
                <div className="flex items-center gap-2 shrink-0">
                  <i className={`fa-solid ${REASON_ICONS[r.reason] ?? 'fa-flag'} text-xs text-sub w-4`} />
                  <span className="text-xs font-semibold text-text">
                    {reasonLabels[r.reason] ?? r.reason}
                  </span>
                </div>
                {r.description && (
                  <p className="text-xs text-sub flex-1 italic">&laquo; {r.description} &raquo;</p>
                )}
                <div className="text-xs text-sub shrink-0 sm:ml-auto">
                  <span className="font-medium text-text">{r.reporter.name}</span>
                  {' · '}
                  {fmtShortDate(r.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
