'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import type { Verification } from '@/types';
import { formatDate } from '@/lib/utils';
import { SkeletonListRow } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

export default function AgentVerificationsPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal,   setRejectModal]   = useState<{ id: string } | null>(null);
  const [rejectReason,  setRejectReason]  = useState('');
  const [completeModal, setCompleteModal] = useState<{ id: string } | null>(null);
  const [completeNotes,    setCompleteNotes]    = useState('');
  const [completeReportUrl, setCompleteReportUrl] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getToken().then((token) => {
      if (!token) { setLoading(false); return; }
      api.get<Verification[]>('/verifications/pending', token)
        .then(setVerifications)
        .catch(() => setError('Impossible de charger les vérifications.'))
        .finally(() => setLoading(false));
    });
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: 'start' | 'complete' | 'reject', body?: object) => {
    const token = await getToken();
    if (!token) return;
    setActionLoading(id + action);
    try {
      await api.patch(`/verifications/${id}/${action}`, body ?? {}, token);
      const updated = await api.get<Verification[]>('/verifications/pending', token);
      setVerifications(updated);
      const labels: Record<string, string> = { start: 'Vérification démarrée', complete: 'Vérification terminée', reject: 'Vérification rejetée' };
      toast.success(labels[action] ?? 'Action effectuée');
    } catch {
      toast.error('Erreur. Veuillez réessayer.');
    } finally {
      setActionLoading(null);
    }
  };

  const submitReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    await handleAction(rejectModal.id, 'reject', { reason: rejectReason });
    setRejectModal(null);
    setRejectReason('');
  };

  const submitComplete = async () => {
    if (!completeModal) return;
    await handleAction(completeModal.id, 'complete', {
      notes:     completeNotes.trim() || undefined,
      reportUrl: completeReportUrl.trim() || undefined,
    });
    setCompleteModal(null);
    setCompleteNotes('');
    setCompleteReportUrl('');
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonListRow key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
        <p className="text-sm text-sub">{error}</p>
        <button onClick={load} className="mt-4 btn-gold text-sm">
          <i className="fa-solid fa-rotate-right mr-1.5" />Réessayer
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Vérifications en attente</h1>
        <p className="mt-1 text-sm text-sub">
          {verifications.length} mission{verifications.length > 1 ? 's' : ''} assignée{verifications.length > 1 ? 's' : ''}
        </p>
      </div>

      {verifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-shield-halved text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">Aucune mission en attente</p>
          <p className="mt-1 text-sm text-sub">Les vérifications qui vous sont assignées apparaîtront ici.</p>
          <p className="mt-3 text-xs text-sub rounded-xl border border-line bg-bg px-4 py-2">
            <i className="fa-solid fa-circle-info mr-1.5" />Contactez un administrateur si vous attendez des missions.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {verifications.map((v) => (
            <div key={v.id} className="rounded-xl border border-line bg-card p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-text truncate">{v.listing?.title ?? v.listingId}</p>
                  <p className="text-sm text-sub mt-0.5">
                    <i className="fa-solid fa-location-dot text-gold-dark text-xs mr-1" />
                    {v.listing?.city}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <StatusBadge status={v.status} />
                    {v.scheduledAt && (
                      <span className="text-xs text-sub">
                        <i className="fa-regular fa-clock text-xs mr-1" />
                        {formatDate(v.scheduledAt)}
                      </span>
                    )}
                    <span className="text-xs text-sub uppercase tracking-wide">{v.auditType}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {v.status === 'SCHEDULED' && (
                    <button
                      onClick={() => handleAction(v.id, 'start')}
                      disabled={actionLoading === v.id + 'start'}
                      className="btn-gold text-xs py-1.5 px-3"
                    >
                      {actionLoading === v.id + 'start' ? (
                        <i className="fa-solid fa-spinner fa-spin" />
                      ) : (
                        <>
                          <i className="fa-solid fa-play text-xs" /> Démarrer
                        </>
                      )}
                    </button>
                  )}

                  {v.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => setCompleteModal({ id: v.id })}
                      disabled={actionLoading === v.id + 'complete'}
                      className="text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg py-1.5 px-3 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === v.id + 'complete' ? (
                        <i className="fa-solid fa-spinner fa-spin" />
                      ) : (
                        <>
                          <i className="fa-solid fa-check text-xs mr-1" /> Terminer
                        </>
                      )}
                    </button>
                  )}

                  {(v.status === 'SCHEDULED' || v.status === 'IN_PROGRESS') && (
                    <button
                      onClick={() => setRejectModal({ id: v.id })}
                      className="text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg py-1.5 px-3 transition-colors"
                    >
                      <i className="fa-solid fa-xmark text-xs mr-1" /> Rejeter
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
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
              placeholder="Expliquez pourquoi cette vérification est rejetée..."
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
                onClick={submitReject}
                disabled={!rejectReason.trim() || actionLoading !== null}
                className="text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete modal */}
      {completeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-line p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-text mb-4">
              <i className="fa-solid fa-circle-check text-green-600 mr-2" />
              Terminer la vérification
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-sub mb-1">
                  Notes de rapport <span className="text-sub">(optionnel)</span>
                </label>
                <textarea
                  className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold-dark resize-none"
                  rows={3}
                  placeholder="Observations, état du bien, remarques importantes..."
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-sub mb-1">
                  URL du rapport <span className="text-sub">(optionnel)</span>
                </label>
                <input
                  type="url"
                  className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold-dark"
                  placeholder="https://drive.google.com/..."
                  value={completeReportUrl}
                  onChange={(e) => setCompleteReportUrl(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button
                onClick={() => { setCompleteModal(null); setCompleteNotes(''); setCompleteReportUrl(''); }}
                className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={submitComplete}
                disabled={actionLoading !== null}
                className="text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
              >
                {actionLoading ? <i className="fa-solid fa-spinner fa-spin" /> : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    SCHEDULED:   'bg-gold-pale text-gold-dark',
    IN_PROGRESS: 'bg-blue-50 text-blue-700',
    COMPLETED:   'bg-green-100 text-green-700',
    REJECTED:    'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    SCHEDULED:   'Planifiée',
    IN_PROGRESS: 'En cours',
    COMPLETED:   'Terminée',
    REJECTED:    'Rejetée',
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${map[status] ?? 'bg-card text-sub'}`}>
      {labels[status] ?? status}
    </span>
  );
}
