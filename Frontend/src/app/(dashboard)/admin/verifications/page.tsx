'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import type { Verification, User, PaginatedResponse } from '@/types';
import { formatDate } from '@/lib/utils';

interface AssignModal {
  verificationId: string;
  listingTitle: string;
}

export default function AdminVerificationsPage() {
  const { getToken } = useAuth();
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignModal, setAssignModal] = useState<AssignModal | null>(null);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    const [verifs, usersRes] = await Promise.all([
      api.get<Verification[]>('/verifications/pending', token),
      api.get<PaginatedResponse<User>>('/auth/users?page=1&limit=100', token),
    ]);

    setVerifications(verifs);
    setAgents(usersRes.data.filter((u) => u.roles.includes('AGENT_TERRAIN')));
    setLoading(false);
  }, [getToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- triggers async data fetch, not direct setState
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAssign = async () => {
    if (!assignModal || !selectedAgent) return;
    const token = await getToken();
    if (!token) return;
    setActionLoading(assignModal.verificationId + 'assign');
    try {
      await api.patch(`/verifications/${assignModal.verificationId}/assign`, { agentId: selectedAgent }, token);
      await fetchData();
      setAssignModal(null);
      setSelectedAgent('');
    } catch {
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
      await fetchData();
      setRejectModal(null);
      setRejectReason('');
    } catch {
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Vérifications AlloVérifié</h1>
        <p className="mt-1 text-sm text-sub">
          {verifications.length} vérification{verifications.length > 1 ? 's' : ''} en cours · {agents.length} agent{agents.length > 1 ? 's' : ''} disponible{agents.length > 1 ? 's' : ''}
        </p>
      </div>

      {verifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-shield-halved text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">Aucune vérification en attente</p>
          <p className="mt-1 text-sm text-sub">Toutes les demandes AlloVérifié ont été traitées.</p>
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
                    <StatusBadge status={v.status} />
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
                        <i className="fa-solid fa-triangle-exclamation text-xs mr-1" />
                        Non assigné
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setAssignModal({ verificationId: v.id, listingTitle: v.listing?.title ?? v.listingId });
                      setSelectedAgent(v.agentId ?? '');
                    }}
                    className="btn-gold text-xs py-1.5 px-3"
                  >
                    <i className="fa-solid fa-user-plus text-xs" />
                    {v.agent ? 'Réassigner' : 'Assigner'}
                  </button>
                  <button
                    onClick={() => setRejectModal({ id: v.id })}
                    className="text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg py-1.5 px-3 transition-colors"
                  >
                    <i className="fa-solid fa-xmark text-xs mr-1" />
                    Rejeter
                  </button>
                </div>
              </div>
            </div>
          ))}
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
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setSelectedAgent(agent.id)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                      selectedAgent === agent.id
                        ? 'border-gold-dark bg-gold-pale'
                        : 'border-line bg-bg hover:border-gold-dark'
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-pale">
                      <i className="fa-solid fa-user-shield text-gold-dark text-xs" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${selectedAgent === agent.id ? 'text-gold-dark' : 'text-text'}`}>
                        {agent.firstName} {agent.lastName}
                      </p>
                      <p className="text-xs text-sub truncate">{agent.email}</p>
                    </div>
                    {selectedAgent === agent.id && (
                      <i className="fa-solid fa-circle-check text-gold-dark ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => { setAssignModal(null); setSelectedAgent(''); }}
                className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleAssign}
                disabled={!selectedAgent || actionLoading !== null}
                className="btn-gold text-sm disabled:opacity-50"
              >
                {actionLoading === assignModal.verificationId + 'assign' ? (
                  <i className="fa-solid fa-spinner fa-spin" />
                ) : (
                  'Confirmer'
                )}
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
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading !== null}
                className="text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
              >
                {actionLoading !== null ? (
                  <i className="fa-solid fa-spinner fa-spin" />
                ) : (
                  'Confirmer le rejet'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    SCHEDULED:   'bg-gold-pale text-gold-dark',
    IN_PROGRESS: 'bg-blue-50 text-blue-700',
    DONE:        'bg-green-100 text-green-700',
    REJECTED:    'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    SCHEDULED:   'Planifiée',
    IN_PROGRESS: 'En cours',
    DONE:        'Terminée',
    REJECTED:    'Rejetée',
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles[status] ?? 'bg-card text-sub'}`}>
      {labels[status] ?? status}
    </span>
  );
}
