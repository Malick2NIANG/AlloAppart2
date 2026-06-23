'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import type { Verification, User, PaginatedResponse } from '@/types';
import { formatDate } from '@/lib/utils';
import { SkeletonListRow } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

type TabMode = 'pending' | 'all';
type StatusFilter = 'ALL' | 'REQUESTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';

interface AssignModal {
  verificationId: string;
  listingTitle: string;
}

const STATUS_STYLES: Record<string, string> = {
  REQUESTED:   'bg-amber-50 text-amber-700',
  SCHEDULED:   'bg-gold-pale text-gold-dark',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  DONE:        'bg-green-100 text-green-700',
  REJECTED:    'bg-red-100 text-red-700',
};
const STATUS_LABELS: Record<string, string> = {
  REQUESTED:   'Demandée',
  SCHEDULED:   'Planifiée',
  IN_PROGRESS: 'En cours',
  DONE:        'Terminée',
  REJECTED:    'Rejetée',
};

export default function AdminVerificationsPage() {
  const { getToken } = useAuth();
  const { toast }    = useToast();

  const [tab, setTab]                   = useState<TabMode>('pending');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const [agents, setAgents]             = useState<User[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [assignModal, setAssignModal]   = useState<AssignModal | null>(null);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal]   = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [limit, setLimit]               = useState(20);
  const LIMIT_OPTIONS = [10, 20, 50] as const;
  const LIMIT = limit;

  const fetchData = useCallback(async (t: TabMode, s: StatusFilter, p: number) => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      if (t === 'pending') {
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
    } catch {
      setError('Impossible de charger les vérifications.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchData(tab, statusFilter, page);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, statusFilter, page]);

  const handleAssign = async () => {
    if (!assignModal || !selectedAgent) return;
    const token = await getToken();
    if (!token) return;
    setActionLoading(assignModal.verificationId + 'assign');
    try {
      await api.patch(`/verifications/${assignModal.verificationId}/assign`, { agentId: selectedAgent }, token);
      await fetchData(tab, statusFilter, page);
      setAssignModal(null);
      setSelectedAgent('');
      toast.success('Agent assigné');
    } catch {
      toast.error('Erreur lors de l\'assignation.');
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
      toast.success('Badge AlloVérifié accordé');
    } catch {
      toast.error('Erreur lors de la validation.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    const token = await getToken();
    if (!token) return;
    setActionLoading(rejectModal.id + 'reject');
    try {
      await api.patch(`/verifications/${rejectModal.id}/reject`, { reason: rejectReason }, token);
      await fetchData(tab, statusFilter, page);
      setRejectModal(null);
      setRejectReason('');
      toast.success('Vérification rejetée');
    } catch {
      toast.error('Erreur lors du rejet.');
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Vérifications AlloVérifié</h1>
        <p className="mt-1 text-sm text-sub">
          {total} vérification{total > 1 ? 's' : ''} · {agents.length} agent{agents.length > 1 ? 's' : ''} terrain
        </p>
      </div>

      {/* Tab switcher */}
      <div className="mb-5 flex gap-1 rounded-xl border border-line bg-card p-1 w-fit">
        <button
          onClick={() => { setTab('pending'); setPage(1); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'pending' ? 'bg-gold text-gray-900' : 'text-sub hover:text-text'
          }`}
        >
          <i className="fa-solid fa-clock text-xs mr-1.5" />En attente
        </button>
        <button
          onClick={() => { setTab('all'); setPage(1); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'all' ? 'bg-gold text-gray-900' : 'text-sub hover:text-text'
          }`}
        >
          <i className="fa-solid fa-list text-xs mr-1.5" />Toutes
        </button>
      </div>

      {tab === 'all' && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
            className="rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-gold"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="REQUESTED">Demandées</option>
            <option value="SCHEDULED">Planifiées</option>
            <option value="IN_PROGRESS">En cours</option>
            <option value="DONE">Terminées</option>
            <option value="REJECTED">Rejetées</option>
          </select>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-sub whitespace-nowrap">Lignes :</span>
            <div className="flex gap-1">
              {LIMIT_OPTIONS.map((l) => (
                <button key={l} onClick={() => { setLimit(l); setPage(1); }}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${limit === l ? 'bg-gold-dark text-white' : 'border border-line bg-bg text-sub hover:text-text'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonListRow key={i} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
          <p className="text-sm text-sub">{error}</p>
          <button onClick={() => fetchData(tab, statusFilter, page)} className="mt-4 btn-gold text-sm">
            <i className="fa-solid fa-rotate-right mr-1.5" />Réessayer
          </button>
        </div>
      ) : verifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-shield-halved text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">Aucune vérification</p>
          <p className="mt-1 text-sm text-sub">
            {tab === 'pending' ? 'Toutes les demandes ont été traitées.' : 'Aucun résultat pour ce filtre.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {verifications.map((v) => (
            <div key={v.id} className="rounded-xl border border-line bg-card p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text truncate">{v.listing?.title ?? v.listingId}</p>
                  <p className="text-sm text-sub mt-0.5">
                    <i className="fa-solid fa-location-dot text-gold-dark text-xs mr-1" />
                    {v.listing?.city}
                    <span className="mx-1.5">·</span>
                    <span className="uppercase text-xs tracking-wide">{v.auditType}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[v.status] ?? 'bg-card text-sub'}`}>
                      {STATUS_LABELS[v.status] ?? v.status}
                    </span>
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
                        <i className="fa-solid fa-triangle-exclamation text-xs mr-1" />Non assigné
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {(v.status !== 'DONE' && v.status !== 'REJECTED') && (
                    <button
                      onClick={() => {
                        setAssignModal({ verificationId: v.id, listingTitle: v.listing?.title ?? v.listingId });
                        setSelectedAgent(v.agentId ?? '');
                      }}
                      className="btn-gold text-xs py-1.5 px-3"
                    >
                      <i className="fa-solid fa-user-plus text-xs mr-1" />
                      {v.agent ? 'Réassigner' : 'Assigner'}
                    </button>
                  )}
                  {(v.status === 'REQUESTED' || v.status === 'SCHEDULED' || v.status === 'IN_PROGRESS' || v.status === 'DONE') && (
                    <button
                      onClick={() => handleValidate(v.id)}
                      disabled={actionLoading !== null}
                      className="text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg py-1.5 px-3 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === v.id + 'validate'
                        ? <i className="fa-solid fa-spinner fa-spin" />
                        : <><i className="fa-solid fa-shield-halved text-xs mr-1" />Valider badge</>}
                    </button>
                  )}
                  {v.status !== 'REJECTED' && v.status !== 'DONE' && (
                    <button
                      onClick={() => setRejectModal({ id: v.id })}
                      className="text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg py-1.5 px-3 transition-colors"
                    >
                      <i className="fa-solid fa-xmark text-xs mr-1" />Rejeter
                    </button>
                  )}
                </div>
              </div>
            </div>
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

      {/* Assign modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-line p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-text mb-1">Assigner un agent terrain</h2>
            <p className="text-sm text-sub mb-5 truncate">{assignModal.listingTitle}</p>
            {agents.length === 0 ? (
              <p className="text-sm text-sub py-4 text-center">
                <i className="fa-solid fa-triangle-exclamation text-gold-dark mr-2" />
                Aucun agent terrain disponible.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {agents.map((agent) => (
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
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => { setAssignModal(null); setSelectedAgent(''); }}
                className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors">
                Annuler
              </button>
              <button onClick={handleAssign} disabled={!selectedAgent || actionLoading !== null}
                className="btn-gold text-sm disabled:opacity-50">
                {actionLoading === assignModal.verificationId + 'assign'
                  ? <i className="fa-solid fa-spinner fa-spin" />
                  : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-line p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-text mb-4">Motif du rejet</h2>
            <textarea
              className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold-dark resize-none"
              rows={3}
              placeholder="Expliquez pourquoi cette demande est rejetée..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors">
                Annuler
              </button>
              <button onClick={handleReject} disabled={!rejectReason.trim() || actionLoading !== null}
                className="text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
                {actionLoading !== null ? <i className="fa-solid fa-spinner fa-spin" /> : 'Confirmer le rejet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
