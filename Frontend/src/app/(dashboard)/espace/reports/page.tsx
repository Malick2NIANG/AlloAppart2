'use client';

import { Fragment, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

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
  ACTIVE:    'bg-green-100 text-green-700',
  DRAFT:     'bg-amber-50 text-amber-700 border border-amber-200',
  RENTED:    'bg-blue-50 text-blue-700',
  SUSPENDED: 'bg-card text-sub border border-line',
};

const HIGH_THRESHOLD = 3; // seuil : badge rouge + priorité

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
  const [filter,   setFilter]   = useState<'ALL' | 'HIGH'>('ALL');
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
    : items;

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleAction = async () => {
    if (!confirm) return;
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
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text">{t('reportsTitle')}</h1>
          <p className="mt-1 text-sm text-sub">
            {t('reportsSubtitlePre')}{' '}
            <span className="font-semibold text-red-600">{t('reportsThreshold', { count: HIGH_THRESHOLD })}</span>{' '}
            {t('reportsSubtitlePost')}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {(['ALL', 'HIGH'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                filter === f
                  ? 'bg-red-600 text-white'
                  : 'bg-card border border-line text-sub hover:text-text'
              }`}
            >
              {f === 'ALL' ? t('reportsFilterAll') : t('reportsFilterHigh', { count: HIGH_THRESHOLD })}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          icon="fa-flag"
          label={t('reportsStatReported')}
          value={items.length}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <StatCard
          icon="fa-triangle-exclamation"
          label={t('reportsStatHigh', { count: HIGH_THRESHOLD })}
          value={items.filter((i) => i.reportCount >= HIGH_THRESHOLD).length}
          color="text-red-600"
          bg="bg-red-50"
        />
        <StatCard
          icon="fa-pause-circle"
          label={t('reportsStatSuspended')}
          value={items.filter((i) => i.status === 'SUSPENDED').length}
          color="text-sub"
          bg="bg-card"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <i className="fa-solid fa-spinner fa-spin text-2xl text-sub" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-sub">
          <i className="fa-regular fa-flag text-3xl" />
          <p className="text-sm">{filter === 'HIGH' ? t('reportsEmptyThreshold') : t('reportsEmpty')}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-gold-pale/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-sub uppercase tracking-wide">{t('thListing')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-sub uppercase tracking-wide hidden md:table-cell">{t('thReasons')}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-sub uppercase tracking-wide">{t('thReports')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-sub uppercase tracking-wide hidden lg:table-cell">{t('thLast')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-sub uppercase tracking-wide">{t('thStatus')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-sub uppercase tracking-wide">{t('thActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {displayed.map((item) => {
                const isHigh      = item.reportCount >= HIGH_THRESHOLD;
                const isExpanded  = expanded === item.listingId;
                const isSuspended = item.status === 'SUSPENDED';

                return (
                  <Fragment key={item.listingId}>
                    <tr className={`hover:bg-gold-pale/20 transition ${isHigh ? 'bg-red-50/40' : ''}`}>
                      {/* Annonce */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-text line-clamp-1">{item.title}</div>
                        <div className="text-xs text-sub mt-0.5">
                          {item.city} · {item.ownerName}
                        </div>
                      </td>

                      {/* Motifs */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {item.reasons.map((r) => (
                            <span
                              key={r}
                              className="inline-flex items-center gap-1 rounded-full bg-card border border-line px-2 py-0.5 text-[10px] text-sub"
                            >
                              <i className={`fa-solid ${REASON_ICONS[r] ?? 'fa-flag'} text-[9px]`} />
                              {REASON_LABELS[r] ?? r}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Count */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          isHigh ? 'bg-red-100 text-red-700' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {isHigh && <i className="fa-solid fa-triangle-exclamation text-[9px]" />}
                          {item.reportCount}
                        </span>
                      </td>

                      {/* Dernier */}
                      <td className="px-4 py-3 text-sub hidden lg:table-cell">
                        {item.lastReportAt ? fmtShortDate(item.lastReportAt) : '—'}
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] ?? 'bg-card text-sub'}`}>
                          {STATUS_LABELS[item.status] ?? item.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Voir détail */}
                          <button
                            onClick={() => setExpanded(isExpanded ? null : item.listingId)}
                            className="rounded-lg px-2.5 py-1.5 text-xs text-sub border border-line hover:text-text hover:border-line/80 transition"
                            title={t('titleViewReports')}
                          >
                            <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
                          </button>
                          {/* Voir l'annonce */}
                          <a
                            href={`/listings/${item.listingId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg px-2.5 py-1.5 text-xs text-sub border border-line hover:text-text transition"
                            title={t('titleViewListing')}
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square" />
                          </a>
                          {/* Suspendre / Réactiver */}
                          {isSuspended ? (
                            <button
                              onClick={() => setConfirm({ listingId: item.listingId, title: item.title, action: 'restore' })}
                              className="rounded-lg px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition"
                            >
                              {t('reactivate')}
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirm({ listingId: item.listingId, title: item.title, action: 'suspend' })}
                              className="rounded-lg px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition"
                            >
                              {t('suspend')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Ligne expandée : détail des signalements */}
                    {isExpanded && (
                      <tr className="bg-gold-pale/10">
                        <td colSpan={6} className="px-6 py-4">
                          <p className="text-xs font-semibold text-sub uppercase tracking-wide mb-3">
                            {t('reportsDetailTitle')}
                          </p>
                          <div className="space-y-2">
                            {item.reports.map((r) => (
                              <div
                                key={r.id}
                                className="flex flex-col sm:flex-row sm:items-start gap-2 rounded-xl border border-line bg-card px-4 py-3"
                              >
                                <div className="flex items-center gap-2 shrink-0">
                                  <i className={`fa-solid ${REASON_ICONS[r.reason] ?? 'fa-flag'} text-xs text-sub w-4`} />
                                  <span className="text-xs font-semibold text-text">
                                    {REASON_LABELS[r.reason] ?? r.reason}
                                  </span>
                                </div>
                                {r.description && (
                                  <p className="text-xs text-sub flex-1 italic">&laquo; {r.description} &raquo;</p>
                                )}
                                <div className="text-xs text-sub shrink-0 ml-auto">
                                  <span className="font-medium text-text">{r.reporter.name}</span>
                                  {' · '}
                                  {fmtShortDate(r.createdAt)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
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

// ── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, color, bg,
}: {
  icon: string; label: string; value: number; color: string; bg: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 flex items-center gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
        <i className={`fa-solid ${icon} ${color}`} />
      </div>
      <div>
        <p className="text-lg font-bold text-text">{value}</p>
        <p className="text-xs text-sub">{label}</p>
      </div>
    </div>
  );
}
