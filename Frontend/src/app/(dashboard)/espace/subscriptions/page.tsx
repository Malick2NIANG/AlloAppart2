'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import type { Subscription, PaginatedResponse } from '@/types';
import { formatDate, formatPrice } from '@/lib/utils';
import { SkeletonListRow } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE:    'Actif',
  SUSPENDED: 'Suspendu',
  CANCELLED: 'Annulé',
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-700',
  SUSPENDED: 'bg-amber-50 text-amber-700 border border-amber-200',
  CANCELLED: 'bg-card text-sub border border-line',
};
const PLAN_LABELS: Record<string, string> = { STARTER: 'Starter', PRO: 'Pro' };
const PLAN_COLORS: Record<string, string> = {
  STARTER: 'bg-blue-50 text-blue-700',
  PRO:     'bg-purple-50 text-purple-700',
};

export default function AdminSubscriptionsPage() {
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [limit, setLimit]       = useState(20);
  const LIMIT_OPTIONS = [10, 20, 50] as const;

  const fetchData = useCallback(async (p: number, lim = limit) => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedResponse<Subscription>>(
        `/subscriptions/all?page=${p}&limit=${lim}`,
        token,
      );
      setSubscriptions(res.data);
      setTotal(res.total);
    } catch {
      setError('Impossible de charger les abonnements.');
    } finally {
      setLoading(false);
    }
  }, [getToken, limit]);

  useEffect(() => { fetchData(page); }, [fetchData, page]);

  const handleSuspend = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    setActionId(id + 'suspend');
    try {
      await api.patch(`/subscriptions/${id}/suspend`, {}, token);
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'SUSPENDED' } : s)),
      );
      toast.success('Abonnement suspendu');
    } catch {
      toast.error('Erreur lors de la suspension.');
    } finally { setActionId(null); }
  };

  const handleActivate = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    setActionId(id + 'activate');
    try {
      await api.patch(`/subscriptions/${id}/activate`, {}, token);
      await fetchData(page);
      toast.success('Abonnement réactivé');
    } catch {
      toast.error('Erreur lors de la réactivation.');
    } finally { setActionId(null); }
  };

  const handleExtend = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    setActionId(id + 'extend');
    try {
      await api.patch(`/subscriptions/${id}/extend`, { days: 30 }, token);
      await fetchData(page);
      toast.success('+30 jours ajoutés');
    } catch {
      toast.error('Erreur lors de l\'extension.');
    } finally { setActionId(null); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Abonnements PRO</h1>
          <p className="mt-1 text-sm text-sub">{total} abonnement{total > 1 ? 's' : ''} au total</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-sub whitespace-nowrap">Lignes :</span>
          <div className="flex gap-1">
            {LIMIT_OPTIONS.map((l) => (
              <button key={l} onClick={() => { setLimit(l); setPage(1); fetchData(1, l); }}
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
          <button onClick={() => fetchData(page)} className="mt-4 btn-gold text-sm">
            <i className="fa-solid fa-rotate-right mr-1.5" />Réessayer
          </button>
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-id-card text-2xl text-gold-dark" />
          </div>
          <p className="text-sub">Aucun abonnement trouvé.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {subscriptions.map((sub) => (
            <div key={sub.id} className="rounded-xl border border-line bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-text">
                    {sub.user?.agencyName ?? `${sub.user?.firstName ?? ''} ${sub.user?.lastName ?? ''}`.trim()}
                  </p>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PLAN_COLORS[sub.plan] ?? 'bg-card text-sub'}`}>
                    {PLAN_LABELS[sub.plan] ?? sub.plan}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[sub.status] ?? 'bg-card text-sub'}`}>
                    {STATUS_LABELS[sub.status] ?? sub.status}
                  </span>
                </div>
                <p className="text-sm text-sub mt-0.5 truncate">{sub.user?.email}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-sub">
                  <span><i className="fa-solid fa-coins mr-1" />{formatPrice(sub.monthlyFee)}/mois</span>
                  {sub.endDate && (
                    <span className={`font-medium ${
                      new Date(sub.endDate) < new Date(Date.now() + 7 * 86400000)
                        ? 'text-amber-600'
                        : 'text-sub'
                    }`}>
                      <i className="fa-regular fa-calendar mr-1" />
                      Expire le {formatDate(sub.endDate)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {sub.status === 'ACTIVE' ? (
                  <>
                    <button onClick={() => handleExtend(sub.id)} disabled={actionId !== null}
                      className="text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700 rounded-lg px-3 py-1.5 hover:bg-blue-100 disabled:opacity-50 transition-colors">
                      {actionId === sub.id + 'extend'
                        ? <i className="fa-solid fa-spinner fa-spin" />
                        : <><i className="fa-solid fa-plus text-xs mr-1" />+30 jours</>}
                    </button>
                    <button onClick={() => handleSuspend(sub.id)} disabled={actionId !== null}
                      className="text-xs font-medium border border-amber-200 bg-amber-50 text-amber-700 rounded-lg px-3 py-1.5 hover:bg-amber-100 disabled:opacity-50 transition-colors">
                      {actionId === sub.id + 'suspend'
                        ? <i className="fa-solid fa-spinner fa-spin" />
                        : <><i className="fa-solid fa-ban text-xs mr-1" />Suspendre</>}
                    </button>
                  </>
                ) : sub.status === 'SUSPENDED' ? (
                  <button onClick={() => handleActivate(sub.id)} disabled={actionId !== null}
                    className="text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg px-3 py-1.5 hover:bg-emerald-100 disabled:opacity-50 transition-colors">
                    {actionId === sub.id + 'activate'
                      ? <i className="fa-solid fa-spinner fa-spin" />
                      : <><i className="fa-solid fa-circle-check text-xs mr-1" />Réactiver</>}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text disabled:pointer-events-none disabled:opacity-40">
            <i className="fa-solid fa-chevron-left text-xs" /> Précédent
          </button>
          <span className="text-sm text-sub">Page {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text disabled:pointer-events-none disabled:opacity-40">
            Suivant <i className="fa-solid fa-chevron-right text-xs" />
          </button>
        </div>
      )}
    </div>
  );
}
