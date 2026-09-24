'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { api } from '@/lib/api';
import type { Verification, User, PaginatedResponse } from '@/types';
import { formatDate } from '@/lib/utils';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { StatFilterCard } from '@/components/bookings/StatFilterCard';

type TabMode = 'pending' | 'all';
type StatusFilter = 'ALL' | 'REQUESTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';

interface AssignModal {
  verificationId: string;
  listingTitle: string;
}

const STATUS_STYLES: Record<string, string> = {
  REQUESTED:       'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
  SCHEDULED:       'bg-gold-pale text-gold-dark',
  IN_PROGRESS:     'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
  DONE:            'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400',
  REJECTED:        'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400',
  DECLINE_PENDING: 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400',
};

const STATUS_TAB_ICONS: Record<StatusFilter, string> = {
  ALL:         'fa-layer-group',
  REQUESTED:   'fa-clock',
  SCHEDULED:   'fa-calendar-check',
  IN_PROGRESS: 'fa-person-walking-arrow-right',
  DONE:        'fa-circle-check',
  REJECTED:    'fa-xmark',
};

const FALLBACK_IMG = 'https://via.placeholder.com/600x400?text=AlloAppart';

// Couleurs des chips icône des StatFilterCard (onglet 'all') — mêmes teintes
// sémantiques que STATUS_STYLES (badges), sauf SCHEDULED réassigné au violet
// pour ne pas se confondre visuellement avec le doré réservé à "Tous".
const STAT_CARD_COLORS: Record<StatusFilter, { color: string; bg: string }> = {
  ALL:         { color: 'text-gold-dark',                        bg: 'bg-gold-pale' },
  REQUESTED:   { color: 'text-amber-600 dark:text-amber-400',    bg: 'bg-amber-50 dark:bg-amber-950/30' },
  SCHEDULED:   { color: 'text-purple-600 dark:text-purple-400',  bg: 'bg-purple-50 dark:bg-purple-950/30' },
  IN_PROGRESS: { color: 'text-blue-600 dark:text-blue-400',      bg: 'bg-blue-50 dark:bg-blue-950/30' },
  DONE:        { color: 'text-green-600 dark:text-green-400',    bg: 'bg-green-50 dark:bg-green-950/30' },
  REJECTED:    { color: 'text-red-600 dark:text-red-400',        bg: 'bg-red-50 dark:bg-red-950/30' },
};

export default function AdminVerificationsPage() {
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const t            = useTranslations('admin');
  const tRef         = useRef(t);
  useEffect(() => { tRef.current = t; });

  const [tab, setTab]                     = useState<TabMode>('pending');
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('ALL');
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [agents, setAgents]               = useState<User[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [assignModal, setAssignModal]     = useState<AssignModal | null>(null);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal]     = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason]   = useState('');
  const [agentSearch, setAgentSearch]     = useState('');
  const [agentPage, setAgentPage]         = useState(1);
  const AGENT_PER_PAGE = 5;
  const [limit, setLimit]                 = useState(20);
  const LIMIT_OPTIONS = [10, 20, 50] as const;
  const LIMIT = limit;
  // Compte par statut (onglet 'all' uniquement) — alimente les StatFilterCard,
  // qui doublent de filtre cliquable (même pattern que Signalements/
  // Réservations/Annonces). Rafraîchi avec la liste à chaque fetchData.
  const [statusCounts, setStatusCounts] = useState<Record<StatusFilter, number>>({
    ALL: 0, REQUESTED: 0, SCHEDULED: 0, IN_PROGRESS: 0, DONE: 0, REJECTED: 0,
  });

  const STATUS_LABELS: Record<string, string> = {
    REQUESTED:       t('verifStatusRequested'),
    SCHEDULED:       t('verifStatusScheduled'),
    IN_PROGRESS:     t('verifStatusInProgress'),
    DONE:            t('verifStatusDone'),
    REJECTED:        t('verifStatusRejected'),
    DECLINE_PENDING: t('verifStatusDeclinePending'),
  };

  const STATUS_TABS: { key: StatusFilter; label: string; icon: string }[] = [
    { key: 'ALL',         label: t('allStatuses'),      icon: STATUS_TAB_ICONS.ALL         },
    { key: 'REQUESTED',   label: t('filterRequested'),  icon: STATUS_TAB_ICONS.REQUESTED   },
    { key: 'SCHEDULED',   label: t('filterScheduled'),  icon: STATUS_TAB_ICONS.SCHEDULED   },
    { key: 'IN_PROGRESS', label: t('filterInProgress'), icon: STATUS_TAB_ICONS.IN_PROGRESS },
    { key: 'DONE',        label: t('filterDone'),       icon: STATUS_TAB_ICONS.DONE        },
    { key: 'REJECTED',    label: t('filterRejected'),   icon: STATUS_TAB_ICONS.REJECTED    },
  ];

  const fetchData = useCallback(async (tb: TabMode, s: StatusFilter, p: number) => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      if (tb === 'pending') {
        const [verifs, usersRes] = await Promise.all([
          api.get<Verification[]>('/verifications/pending', token),
          api.get<PaginatedResponse<User>>('/auth/users?page=1&limit=100', token),
        ]);
        setVerifications(verifs);
        setTotal(verifs.length);
        setAgents(usersRes.data.filter((u) => u.roles.includes('AGENT_TERRAIN')));
      } else {
        const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
        if (s !== 'ALL') params.set('status', s);
        const [verifs, usersRes] = await Promise.all([
          api.get<PaginatedResponse<Verification>>(`/verifications/all?${params}`, token),
          api.get<PaginatedResponse<User>>('/auth/users?page=1&limit=100', token),
        ]);
        setVerifications(verifs.data);
        setTotal(verifs.total);
        setAgents(usersRes.data.filter((u) => u.roles.includes('AGENT_TERRAIN')));
      }

      // Comptes par statut — alimentent à la fois les 6 StatFilterCard de
      // l'onglet "Toutes" et les 2 cartes "En attente"/"Toutes" du switcher
      // de tête (dérivées de ces mêmes comptes, voir plus bas). Toujours
      // rafraîchis, quel que soit l'onglet actif, pour rester exacts ;
      // non bloquant pour l'affichage de la liste.
      void (async () => {
        try {
          const statuses: StatusFilter[] = ['ALL', 'REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'DONE', 'REJECTED'];
          const entries = await Promise.all(statuses.map(async (st) => {
            const cParams = new URLSearchParams({ page: '1', limit: '1' });
            if (st !== 'ALL') cParams.set('status', st);
            const res = await api.get<PaginatedResponse<Verification>>(`/verifications/all?${cParams}`, token);
            return [st, res.total] as const;
          }));
          setStatusCounts(Object.fromEntries(entries) as Record<StatusFilter, number>);
        } catch {
          // Purement informatif (cartes stats) — une erreur ici ne bloque
          // pas le reste de la page, déjà couvert par le fetchData principal.
        }
      })();
    } catch {
      setError(tRef.current('verifsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [getToken, LIMIT]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch initial/pagination, setState après résolution async
    fetchData(tab, statusFilter, page);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, statusFilter, page]);

  // Rafraîchit immédiatement le badge sidebar "Vérifications" (DashboardShell)
  // sans attendre un reload — même onglet uniquement, cf. sa doc interne.
  const notifyVerifBadge = () =>
    window.dispatchEvent(new CustomEvent('aa-badges-updated', { detail: { kind: 'VERIFICATIONS' } }));

  const handleAssign = async () => {
    if (!assignModal || !selectedAgent) return;
    const token = await getToken();
    if (!token) return;
    setActionLoading(assignModal.verificationId + 'assign');
    try {
      await api.patch(`/verifications/${assignModal.verificationId}/assign`, { agentId: selectedAgent }, token);
      await fetchData(tab, statusFilter, page);
      notifyVerifBadge();
      setAssignModal(null);
      setSelectedAgent('');
      toast.success(t('toastAgentAssigned'));
    } catch {
      toast.error(t('errAssign'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleValidate = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    setActionLoading(id + 'validate');
    try {
      await api.patch(`/verifications/${id}/validate`, {}, token);
      await fetchData(tab, statusFilter, page);
      toast.success(t('toastBadgeGranted'));
    } catch {
      toast.error(t('errValidate'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveDecline = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    setActionLoading(id + 'approve-decline');
    try {
      await api.patch(`/verifications/${id}/approve-decline`, {}, token);
      toast.success(t('toastDeclineApproved'));
      await fetchData(tab, statusFilter, page);
      notifyVerifBadge();
    } catch { toast.error(t('errApprove')); }
    finally { setActionLoading(null); }
  };

  const handleRefuseDecline = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    setActionLoading(id + 'refuse-decline');
    try {
      await api.patch(`/verifications/${id}/refuse-decline`, {}, token);
      toast.success(t('toastDeclineRefused'));
      await fetchData(tab, statusFilter, page);
      notifyVerifBadge();
    } catch { toast.error(t('errRefuse')); }
    finally { setActionLoading(null); }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    const token = await getToken();
    if (!token) return;
    setActionLoading(rejectModal.id + 'reject');
    try {
      await api.patch(`/verifications/${rejectModal.id}/reject`, { reason: rejectReason }, token);
      await fetchData(tab, statusFilter, page);
      notifyVerifBadge();
      setRejectModal(null);
      setRejectReason('');
      toast.success(t('toastVerifRejected'));
    } catch {
      toast.error(t('errReject'));
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);
  // Dérivés des comptes par statut déjà chargés pour les StatFilterCard du
  // sous-filtre — "En attente" = mêmes 3 statuts que /verifications/pending
  // côté back (REQUESTED+SCHEDULED+IN_PROGRESS), "Toutes" = statusCounts.ALL.
  const pendingCount = statusCounts.REQUESTED + statusCounts.SCHEDULED + statusCounts.IN_PROGRESS;
  const allCount     = statusCounts.ALL;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">{t('verifsTitle')}</h1>
        <p className="mt-1 text-sm text-sub">
          {t('verifsSubtitle', { verifs: total, agents: agents.length })}
        </p>
      </div>

      {/* Tab switcher — même pattern StatFilterCard que les sous-filtres et
          les autres pages admin (cartes cliquables doublant de stats). */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatFilterCard
          icon="fa-clock"
          label={t('tabPending')}
          value={pendingCount}
          color="text-amber-600 dark:text-amber-400"
          bg="bg-amber-50 dark:bg-amber-950/30"
          active={tab === 'pending'}
          onClick={() => { setTab('pending'); setPage(1); }}
          selectedLabel={t('filterSelected')}
        />
        <StatFilterCard
          icon="fa-list"
          label={t('tabAll')}
          value={allCount}
          color="text-gold-dark"
          bg="bg-gold-pale"
          active={tab === 'all'}
          onClick={() => { setTab('all'); setPage(1); }}
          selectedLabel={t('filterSelected')}
        />
      </div>

      {tab === 'all' && (
        <>
          {/* Stats par statut — doublent aussi de filtre cliquable (même
              pattern que Signalements/Réservations/Annonces). */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            {STATUS_TABS.map((tb) => (
              <StatFilterCard
                key={tb.key}
                icon={tb.icon}
                label={tb.label}
                value={statusCounts[tb.key]}
                color={STAT_CARD_COLORS[tb.key].color}
                bg={STAT_CARD_COLORS[tb.key].bg}
                active={statusFilter === tb.key}
                onClick={() => { setStatusFilter(tb.key); setPage(1); }}
                selectedLabel={t('filterSelected')}
              />
            ))}
          </div>
          <div className="mb-4 flex items-center justify-end gap-1.5">
            <span className="text-xs text-sub whitespace-nowrap">{t('rowsLabel')}</span>
            <div className="flex gap-1">
              {LIMIT_OPTIONS.map((l) => (
                <button key={l} onClick={() => { setLimit(l); setPage(1); }}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${limit === l ? 'bg-gold-dark text-white' : 'border border-line bg-bg text-sub hover:text-text'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} height="320px" />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
          <p className="text-sm text-sub">{error}</p>
          <button onClick={() => fetchData(tab, statusFilter, page)} className="mt-4 btn-gold text-sm">
            <i className="fa-solid fa-rotate-right mr-1.5" />{t('retry')}
          </button>
        </div>
      ) : verifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-shield-halved text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">{t('verifsEmpty')}</p>
          <p className="mt-1 text-sm text-sub">
            {tab === 'pending' ? t('verifsEmptyPending') : t('verifsEmptyFiltered')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {verifications.map((v) => (
            <AdminVerificationCard
              key={v.id}
              v={v}
              statusLabel={STATUS_LABELS[v.status] ?? v.status}
              statusColor={STATUS_STYLES[v.status] ?? 'bg-card text-sub'}
              actionLoading={actionLoading}
              onAssign={() => {
                setAssignModal({ verificationId: v.id, listingTitle: v.listing?.title ?? v.listingId });
                setSelectedAgent(v.agentId ?? '');
              }}
              onValidate={() => handleValidate(v.id)}
              onApproveDecline={() => void handleApproveDecline(v.id)}
              onRefuseDecline={() => void handleRefuseDecline(v.id)}
              onReject={() => setRejectModal({ id: v.id })}
            />
          ))}
        </div>
      )}

      {tab === 'all' && totalPages > 1 && (
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

      {/* Assign modal */}
      {assignModal && (() => {
        const filtered = agents.filter((a) => {
          const q = agentSearch.toLowerCase();
          return !q || `${a.firstName} ${a.lastName} ${a.email}`.toLowerCase().includes(q);
        });
        const totalAgentPages = Math.max(1, Math.ceil(filtered.length / AGENT_PER_PAGE));
        const paginated = filtered.slice((agentPage - 1) * AGENT_PER_PAGE, agentPage * AGENT_PER_PAGE);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-2xl bg-card border border-line p-6 shadow-xl">
              {/* Header */}
              <h2 className="text-lg font-semibold text-text mb-1">{t('modalAssignTitle')}</h2>
              <p className="text-sm text-sub mb-4 truncate">{assignModal.listingTitle}</p>

              {/* Barre de recherche */}
              <div className="relative mb-3">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-sub text-xs" />
                <input
                  type="text"
                  value={agentSearch}
                  onChange={(e) => { setAgentSearch(e.target.value); setAgentPage(1); }}
                  placeholder={t('agentSearchPh')}
                  className="w-full rounded-xl border border-line bg-bg py-2 pl-9 pr-4 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition"
                />
                {agentSearch && (
                  <button onClick={() => { setAgentSearch(''); setAgentPage(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sub hover:text-text transition">
                    <i className="fa-solid fa-xmark text-xs" />
                  </button>
                )}
              </div>

              {/* Liste agents */}
              {agents.length === 0 ? (
                <p className="text-sm text-sub py-4 text-center">
                  <i className="fa-solid fa-triangle-exclamation text-gold-dark mr-2" />
                  {t('noAgentsAvailable')}
                </p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-sub py-4 text-center">{t('noAgentResults', { search: agentSearch })}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {paginated.map((agent) => (
                    <button key={agent.id} type="button" onClick={() => setSelectedAgent(agent.id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        selectedAgent === agent.id
                          ? 'border-gold-dark bg-gold-pale'
                          : 'border-line bg-bg hover:border-gold-dark'
                      }`}>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-pale">
                        <i className="fa-solid fa-user-shield text-gold-dark text-xs" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${selectedAgent === agent.id ? 'text-gold-dark' : 'text-text'}`}>
                          {agent.firstName} {agent.lastName}
                        </p>
                        <p className="text-xs text-sub truncate">{agent.email}</p>
                      </div>
                      {selectedAgent === agent.id && <i className="fa-solid fa-circle-check text-gold-dark ml-auto" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Pagination agents */}
              {totalAgentPages > 1 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
                  <button onClick={() => setAgentPage((p) => Math.max(1, p - 1))} disabled={agentPage === 1}
                    className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs text-sub hover:text-text disabled:opacity-40 transition">
                    <i className="fa-solid fa-chevron-left text-[10px]" /> {t('prevShort')}
                  </button>
                  <span className="text-xs text-sub">
                    {t('agentsPageInfo', { page: agentPage, total: totalAgentPages, count: filtered.length })}
                  </span>
                  <button onClick={() => setAgentPage((p) => Math.min(totalAgentPages, p + 1))} disabled={agentPage >= totalAgentPages}
                    className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs text-sub hover:text-text disabled:opacity-40 transition">
                    {t('nextShort')} <i className="fa-solid fa-chevron-right text-[10px]" />
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-5 justify-end">
                <button onClick={() => { setAssignModal(null); setSelectedAgent(''); setAgentSearch(''); setAgentPage(1); }}
                  className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors">
                  {t('cancel')}
                </button>
                <button onClick={handleAssign} disabled={!selectedAgent || actionLoading !== null}
                  className="btn-gold text-sm disabled:opacity-50">
                  {actionLoading === assignModal.verificationId + 'assign'
                    ? <i className="fa-solid fa-spinner fa-spin" />
                    : t('confirm')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-line p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-text mb-4">{t('modalRejectTitle')}</h2>
            <textarea
              className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold-dark resize-none"
              rows={3}
              placeholder={t('rejectReasonPh')}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors">
                {t('cancel')}
              </button>
              <button onClick={handleReject} disabled={!rejectReason.trim() || actionLoading !== null}
                className="text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
                {actionLoading !== null ? <i className="fa-solid fa-spinner fa-spin" /> : t('confirmReject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Carte vérification — même coquille visuelle (photo + statut en overlay)
 * que AdminListingCard/BookingCard, corps + actions repris tels quels du
 * rendu en liste précédent (préserve toute la logique conditionnelle et les
 * casts existants, y compris les eslint-disable qui les accompagnaient).
 */
function AdminVerificationCard({
  v, statusLabel, statusColor, actionLoading,
  onAssign, onValidate, onApproveDecline, onRefuseDecline, onReject,
}: {
  v: Verification;
  statusLabel: string;
  statusColor: string;
  actionLoading: string | null;
  onAssign: () => void;
  onValidate: () => void;
  onApproveDecline: () => void;
  onRefuseDecline: () => void;
  onReject: () => void;
}) {
  const t = useTranslations('admin');
  const img = v.listing?.images?.[0] ?? FALLBACK_IMG;

  return (
    <div className="listing-card group flex flex-col">
      {/* Photo + statut */}
      <div className="relative h-40 overflow-hidden rounded-t-2xl">
        <Image
          src={img}
          alt={v.listing?.title ?? ''}
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
      </div>

      {/* Bien + infos */}
      <div className="p-4 flex-1">
        <p className="font-semibold text-text truncate">{v.listing?.title ?? v.listingId}</p>
        <p className="text-sm text-sub mt-0.5">
          <i className="fa-solid fa-location-dot text-gold-dark text-xs mr-1" />
          {v.listing?.city}
        </p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {v.scheduledAt && (
            <span className="text-xs text-sub">
              <i className="fa-regular fa-clock text-xs mr-1" />
              {formatDate(v.scheduledAt)}
            </span>
          )}
          {v.agent ? (
            <span className="text-xs text-sub">
              <i className="fa-solid fa-user-shield text-xs mr-1 text-gold-dark" />
              {v.agent.firstName} {v.agent.lastName}
            </span>
          ) : (
            <span className="text-xs text-red-500 font-medium">
              <i className="fa-solid fa-triangle-exclamation text-xs mr-1" />{t('verifNotAssigned')}
            </span>
          )}
          {/* Badge agent préféré par le bailleur */}
          {(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const preferred = (v as any).preferredAgent as { firstName: string; lastName: string } | undefined;
            if (!preferred) return null;
            return (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gold-pale text-gold-dark font-medium border border-gold/30">
                <i className="fa-solid fa-star text-[9px] mr-1" />
                {t('verifRequestedAgent', { name: `${preferred.firstName} ${preferred.lastName}` })}
              </span>
            );
          })()}
        </div>
        {/* Contact bailleur */}
        {(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const owner = (v.listing as any)?.owner as { firstName?: string; lastName?: string; phone?: string; email?: string } | undefined;
          if (!owner) return null;
          return (
            <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-sub border-t border-line pt-2">
              <i className="fa-solid fa-user text-[10px] text-gold-dark" />
              <span className="font-medium text-text truncate">{owner.firstName} {owner.lastName}</span>
              {owner.phone && (
                <a href={`tel:${owner.phone}`} onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 hover:text-gold-dark transition-colors">
                  <i className="fa-solid fa-phone text-[10px]" />{owner.phone}
                </a>
              )}
              {owner.email && (
                <a href={`mailto:${owner.email}`} onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 hover:text-gold-dark transition-colors truncate max-w-[160px]">
                  <i className="fa-solid fa-envelope text-[10px]" />{owner.email}
                </a>
              )}
            </div>
          );
        })()}
      </div>

      {/* Actions */}
      <div className="border-t border-line p-4 pt-3 flex flex-wrap items-center gap-2">
        {(v.status !== 'DONE' && v.status !== 'REJECTED') && (
          <button
            onClick={onAssign}
            className="btn-gold text-xs py-1.5 px-3"
          >
            <i className="fa-solid fa-user-plus text-xs mr-1" />
            {v.agent ? t('reassign') : t('assign')}
          </button>
        )}
        {v.status === 'DONE' && (
          <button
            onClick={onValidate}
            disabled={actionLoading !== null}
            className="text-xs font-medium border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg py-1.5 px-3 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors disabled:opacity-50"
          >
            {actionLoading === v.id + 'validate'
              ? <i className="fa-solid fa-spinner fa-spin" />
              : <><i className="fa-solid fa-shield-halved text-xs mr-1" />{t('validateBadge')}</>}
          </button>
        )}
        {/* Déclin en attente — approbation admin */}
        {v.status === 'DECLINE_PENDING' && (() => {
          const declineReason = (v as unknown as { declineReason?: string }).declineReason;
          return (
            <div className="flex flex-col gap-1.5 w-full">
              {declineReason && (
                <div className="rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/40 px-3 py-1.5 text-xs text-orange-700 dark:text-orange-400">
                  <span className="font-semibold">{t('declineReasonPrefix')}</span>{declineReason}
                </div>
              )}
              <div className="flex gap-1.5">
                <button
                  onClick={onApproveDecline}
                  disabled={actionLoading !== null}
                  className="text-xs font-medium border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg py-1.5 px-3 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors disabled:opacity-50"
                >
                  {actionLoading === v.id + 'approve-decline'
                    ? <i className="fa-solid fa-spinner fa-spin" />
                    : <><i className="fa-solid fa-check mr-1" />{t('approveDecline')}</>}
                </button>
                <button
                  onClick={onRefuseDecline}
                  disabled={actionLoading !== null}
                  className="text-xs font-medium border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg py-1.5 px-3 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                >
                  {actionLoading === v.id + 'refuse-decline'
                    ? <i className="fa-solid fa-spinner fa-spin" />
                    : <><i className="fa-solid fa-xmark mr-1" />{t('refuseDecline')}</>}
                </button>
              </div>
            </div>
          );
        })()}
        {v.status !== 'REJECTED' && v.status !== 'DONE' && v.status !== 'DECLINE_PENDING' && (
          <button
            onClick={onReject}
            className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-400 border border-red-200 dark:border-red-900/40 hover:border-red-300 rounded-lg py-1.5 px-3 transition-colors"
          >
            <i className="fa-solid fa-xmark text-xs mr-1" />{t('reject')}
          </button>
        )}
      </div>
    </div>
  );
}
