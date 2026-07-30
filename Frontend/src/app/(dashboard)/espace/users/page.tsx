'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { User, PaginatedResponse } from '@/types';
import { formatDate } from '@/lib/utils';
import { SkeletonListRow } from '@/components/ui/Skeleton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';

type RoleFilter = 'ALL' | 'LOCATAIRE' | 'BAILLEUR' | 'PRO_AGENCE' | 'AGENT_TERRAIN' | 'ADMIN';

const LIMIT_OPTIONS = [10, 20, 50, 100];

const ROLE_COLORS: Record<string, string> = {
  LOCATAIRE: 'bg-blue-50 text-blue-700',
  BAILLEUR: 'bg-gold-pale text-gold-dark',
  PRO_AGENCE: 'bg-purple-50 text-purple-700',
  AGENT_TERRAIN: 'bg-emerald-50 text-emerald-700',
  ADMIN: 'bg-red-50 text-red-700',
};

interface AgentForm { firstName: string; lastName: string; email: string; phone: string }
interface AgenceForm { agencyName: string; firstName: string; lastName: string; email: string; phone: string }
interface EditForm { firstName: string; lastName: string; phone: string; agencyName: string }

const AGENT_INIT: AgentForm = { firstName: '', lastName: '', email: '', phone: '' };
const AGENCE_INIT: AgenceForm = { agencyName: '', firstName: '', lastName: '', email: '', phone: '' };
const editInit = (u: User): EditForm => ({ firstName: u.firstName, lastName: u.lastName, phone: u.phone ?? '', agencyName: u.agencyName ?? '' });

const inputCls = 'w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40';

export default function AdminUsersPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const t = useTranslations('admin');
  const tRef = useRef(t);
  tRef.current = t;

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteModal, setDeleteModal] = useState<User | null>(null);
  const [removeBailleurModal, setRemoveBailleurModal] = useState<User | null>(null);
  const [viewModal, setViewModal] = useState<User | null>(null);
  const [editModal, setEditModal] = useState<User | null>(null);
  const [agentModal, setAgentModal] = useState(false);
  const [agenceModal, setAgenceModal] = useState(false);
  const [agentForm, setAgentForm] = useState<AgentForm>(AGENT_INIT);
  const [agenceForm, setAgenceForm] = useState<AgenceForm>(AGENCE_INIT);
  const [editForm, setEditForm] = useState<EditForm>({ firstName: '', lastName: '', phone: '', agencyName: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const ROLE_OPTIONS: { value: RoleFilter; label: string }[] = useMemo(() => [
    { value: 'ALL',           label: t('roleAll')           },
    { value: 'LOCATAIRE',     label: t('roleLocataire')     },
    { value: 'BAILLEUR',      label: t('roleBailleur')      },
    { value: 'PRO_AGENCE',    label: t('roleProAgence')     },
    { value: 'AGENT_TERRAIN', label: t('roleAgentTerrain')  },
    { value: 'ADMIN',         label: t('roleAdmin')         },
  ], [t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setDeleteModal(null); setViewModal(null); setEditModal(null);
      setAgentModal(false); setAgenceModal(false); setRemoveBailleurModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fetchUsers = useCallback(async (p: number, lim: number, search: string, roleFilter: RoleFilter) => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(lim) });
      if (search) params.set('q', search);
      if (roleFilter !== 'ALL') params.set('role', roleFilter);
      const res = await api.get<PaginatedResponse<User>>(`/auth/users?${params}`, token);
      setUsers(res.data);
      setTotal(res.total);
    } catch {
      setError(tRef.current('usersLoadError'));
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void fetchUsers(page, limit, q, role); }, [page, limit, role]);

  const handleSearchChange = (v: string) => {
    setQ(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); void fetchUsers(1, limit, v, role); }, 400);
  };

  const handleSuspend = async (user: User) => {
    const token = await getToken(); if (!token) return;
    setActionId(user.id + 'suspend');
    try {
      await api.patch<{ isSuspended: boolean }>(`/auth/users/${user.id}/suspend`, {}, token);
      const next = { ...user, isSuspended: !user.isSuspended };
      setUsers(prev => prev.map(u => u.id === user.id ? next : u));
      if (viewModal?.id === user.id) setViewModal(next);
      toast.success(user.isSuspended ? t('toastAccountReactivated') : t('toastAccountSuspended'));
    } catch {
      toast.error(t('errGeneric'));
    } finally { setActionId(null); }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    const token = await getToken(); if (!token) return;
    setActionId(deleteModal.id + 'delete');
    try {
      await api.delete(`/auth/users/${deleteModal.id}`, token);
      setDeleteModal(null);
      toast.success(t('toastUserDeleted'));
      await fetchUsers(page, limit, q, role);
    } catch {
      toast.error(t('errDelete'));
    } finally { setActionId(null); }
  };

  const handleResetPassword = async (userId: string) => {
    const token = await getToken(); if (!token) return;
    setActionId(userId + 'reset');
    try {
      await api.post(`/auth/users/${userId}/reset-password`, {}, token);
      toast.success(t('toastPasswordReset'));
    } catch {
      toast.error(t('errReset'));
    } finally { setActionId(null); }
  };

  const handleConfirmRemoveBailleur = async () => {
    if (!removeBailleurModal) return;
    const user = removeBailleurModal;
    const token = await getToken(); if (!token) return;
    setActionId(user.id + 'bailleur');
    try {
      await api.delete(`/auth/users/${user.id}/bailleur`, token);
      const updatedRoles = user.roles.filter(r => r !== 'BAILLEUR');
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, roles: updatedRoles } : u));
      if (viewModal?.id === user.id) setViewModal(v => v ? { ...v, roles: updatedRoles } : v);
      toast.success(t('toastBailleurRemoved'));
      setRemoveBailleurModal(null);
    } catch {
      toast.error(t('errRemoveRole'));
    } finally { setActionId(null); }
  };

  const openEdit = (user: User) => { setEditForm(editInit(user)); setFormError(null); setEditModal(user); };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    const token = await getToken(); if (!token) return;
    setFormLoading(true); setFormError(null);
    try {
      const updated = await api.patch<User>(`/auth/users/${editModal.id}`, {
        firstName: editForm.firstName || undefined,
        lastName: editForm.lastName || undefined,
        phone: editForm.phone || null,
        agencyName: editForm.agencyName || null,
      }, token);
      setUsers(prev => prev.map(u => u.id === editModal.id ? { ...u, ...updated } : u));
      if (viewModal?.id === editModal.id) setViewModal(v => v ? { ...v, ...updated } : v);
      setEditModal(null);
      toast.success(t('toastUserUpdated'));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('errUpdate'));
    } finally { setFormLoading(false); }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getToken(); if (!token) return;
    setFormLoading(true); setFormError(null);
    try {
      await api.post('/auth/agents', {
        firstName: agentForm.firstName,
        lastName:  agentForm.lastName,
        email:     agentForm.email,
        ...(agentForm.phone ? { phone: agentForm.phone } : {}),
      }, token);
      setAgentModal(false);
      toast.success(t('toastAgentCreated'));
      setPage(1); await fetchUsers(1, limit, q, role);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('errCreate'));
    } finally { setFormLoading(false); }
  };

  const handleCreateAgence = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getToken(); if (!token) return;
    setFormLoading(true); setFormError(null);
    try {
      await api.post('/auth/agences', {
        agencyName: agenceForm.agencyName,
        firstName:  agenceForm.firstName,
        lastName:   agenceForm.lastName,
        email:      agenceForm.email,
        ...(agenceForm.phone ? { phone: agenceForm.phone } : {}),
      }, token);
      setAgenceModal(false);
      toast.success(t('toastAgenceCreated'));
      setPage(1); await fetchUsers(1, limit, q, role);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('errCreate'));
    } finally { setFormLoading(false); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{t('usersTitle')}</h1>
          <p className="mt-1 text-sm text-sub">{t('usersCount', { count: total })}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { setAgentForm(AGENT_INIT); setFormError(null); setAgentModal(true); }}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors">
            <i className="fa-solid fa-user-shield text-xs" />{t('createAgentBtn')}
          </button>
          <button onClick={() => { setAgenceForm(AGENCE_INIT); setFormError(null); setAgenceModal(true); }}
            className="flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors">
            <i className="fa-solid fa-building text-xs" />{t('createAgenceBtn')}
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-sub" />
          <input value={q} onChange={e => handleSearchChange(e.target.value)} placeholder={t('usersSearchPh')}
            className="w-full rounded-xl border border-line bg-bg py-2.5 pl-9 pr-4 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40" />
        </div>
        <select value={role} onChange={e => { setRole(e.target.value as RoleFilter); setPage(1); }}
          className="rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-gold">
          {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-sub whitespace-nowrap">{t('rowsLabel')}</span>
          <div className="flex gap-1">
            {LIMIT_OPTIONS.map(l => (
              <button key={l} onClick={() => { setLimit(l); setPage(1); }}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${limit === l ? 'bg-gold-dark text-white' : 'border border-line bg-bg text-sub hover:text-text'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonListRow key={i} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
          <p className="text-sm text-sub">{error}</p>
          <button onClick={() => void fetchUsers(page, limit, q, role)} className="mt-4 btn-gold text-sm">
            <i className="fa-solid fa-rotate-right mr-1.5" />{t('retry')}
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-users text-2xl text-gold-dark" />
          </div>
          <p className="text-sub">{t('usersEmpty')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map(user => (
            <div key={user.id}
              className={`rounded-xl border bg-card p-4 ${user.isSuspended ? 'border-red-200 opacity-70' : 'border-line'}`}>
              {/* Ligne 1 : infos + boutons */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-pale">
                    <i className="fa-solid fa-user text-gold-dark text-sm" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-text truncate">{user.firstName} {user.lastName}</p>
                      {user.isSuspended && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium shrink-0">{t('badgeSuspended')}</span>}
                    </div>
                    <p className="text-sm text-sub truncate">{user.email}</p>
                    {user.agencyName && <p className="text-xs text-sub truncate"><i className="fa-solid fa-building text-xs mr-1" />{user.agencyName}</p>}
                  </div>
                </div>
                {/* Boutons — toujours visibles à droite */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setViewModal(user)} title={t('titleViewDetails')}
                    className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs text-sub hover:text-text transition-colors">
                    <i className="fa-solid fa-eye text-xs" />
                  </button>
                  {!user.roles.includes('ADMIN') && (
                    <>
                      <button onClick={() => openEdit(user)} title={t('titleEdit')}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors">
                        <i className="fa-solid fa-pen text-xs" />
                      </button>
                      <button onClick={() => void handleResetPassword(user.id)} disabled={actionId !== null} title={t('titleResetPassword')}
                        className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors">
                        {actionId === user.id + 'reset' ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-key text-xs" />}
                      </button>
                      {user.roles.includes('BAILLEUR') && (
                        <button onClick={() => setRemoveBailleurModal(user)} disabled={actionId !== null} title={t('titleRemoveBailleur')}
                          className="rounded-lg border border-gold/30 bg-gold-pale px-2.5 py-1.5 text-xs font-medium text-gold-dark hover:bg-gold/20 disabled:opacity-50 transition-colors">
                          {actionId === user.id + 'bailleur' ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-user-minus text-xs mr-1" />BAI</>}
                        </button>
                      )}
                      <button onClick={() => void handleSuspend(user)} disabled={actionId !== null}
                        title={user.isSuspended ? t('reactivate') : t('suspend')}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${user.isSuspended ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>
                        {actionId === user.id + 'suspend' ? <i className="fa-solid fa-spinner fa-spin" /> : <i className={`fa-solid ${user.isSuspended ? 'fa-circle-check' : 'fa-ban'} text-xs`} />}
                      </button>
                      <button onClick={() => setDeleteModal(user)} disabled={actionId !== null} title={t('titleDelete')}
                        className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors">
                        <i className="fa-solid fa-trash text-xs" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {/* Ligne 2 : rôles + date */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {user.roles.map(r => (
                  <span key={r} className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[r] ?? 'bg-card text-sub border border-line'}`}>{r}</span>
                ))}
                <span className="ml-auto text-xs text-sub shrink-0"><i className="fa-regular fa-calendar text-xs mr-1" />{formatDate(user.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination numérotée */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub hover:text-text disabled:pointer-events-none disabled:opacity-40 transition">
            <i className="fa-solid fa-chevron-left text-xs" /> {t('previous')}
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) p = i + 1;
              else if (page <= 4) p = i + 1;
              else if (page >= totalPages - 3) p = totalPages - 6 + i;
              else p = page - 3 + i;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`h-8 w-8 rounded-lg text-sm font-medium transition ${p === page ? 'bg-gold-dark text-white' : 'border border-line text-sub hover:text-text'}`}>
                  {p}
                </button>
              );
            })}
          </div>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub hover:text-text disabled:pointer-events-none disabled:opacity-40 transition">
            {t('next')} <i className="fa-solid fa-chevron-right text-xs" />
          </button>
        </div>
      )}

      {/* MODAL — Voir plus */}
      {viewModal && (
        <Modal onClose={() => setViewModal(null)} title={t('modalUserDetails')}>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold-pale">
                <i className="fa-solid fa-user text-xl text-gold-dark" />
              </div>
              <div>
                <p className="text-lg font-bold text-text">{viewModal.firstName} {viewModal.lastName}</p>
                <p className="text-sm text-sub">{viewModal.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Detail label={t('detailPhone')}        value={viewModal.phone ?? '—'} />
              <Detail label={t('detailAgency')}       value={viewModal.agencyName ?? '—'} />
              <Detail label={t('detailRegisteredOn')} value={formatDate(viewModal.createdAt)} />
              <Detail label={t('detailVerified')}     value={viewModal.isVerified ? t('yes') : t('no')} />
              <Detail label={t('detailSuspended')}    value={viewModal.isSuspended ? t('yes') : t('no')} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-sub uppercase tracking-wider">{t('detailRoles')}</p>
              <div className="flex flex-wrap gap-2">
                {viewModal.roles.map(r => (
                  <span key={r} className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[r] ?? 'bg-card text-sub border border-line'}`}>{r}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-sub uppercase tracking-wider">{t('detailClerkId')}</p>
              <code className="block truncate rounded-lg bg-bg px-3 py-2 text-xs text-sub font-mono">{viewModal.clerkId}</code>
            </div>
            {!viewModal.roles.includes('ADMIN') && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
                <button onClick={() => { setViewModal(null); openEdit(viewModal); }}
                  className="flex-1 rounded-xl border border-blue-200 bg-blue-50 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors">
                  <i className="fa-solid fa-pen text-xs mr-1.5" />{t('edit')}
                </button>
                <button onClick={() => void handleResetPassword(viewModal.id)} disabled={actionId !== null}
                  className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors"
                  title={t('titleResetPassword')}>
                  {actionId === viewModal.id + 'reset' ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-key text-xs" />}
                </button>
                <button onClick={() => void handleSuspend(viewModal)} disabled={actionId !== null}
                  className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors disabled:opacity-50 ${viewModal.isSuspended ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>
                  {viewModal.isSuspended ? t('reactivate') : t('suspend')}
                </button>
                <button onClick={() => { setViewModal(null); setDeleteModal(viewModal); }}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors">
                  <i className="fa-solid fa-trash text-xs" />
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL — Éditer */}
      {editModal && (
        <Modal onClose={() => setEditModal(null)} title={t('modalEditUser', { name: `${editModal.firstName} ${editModal.lastName}` })}>
          <form onSubmit={e => void handleEdit(e)} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-sub">{t('fieldFirstName')}</label>
                <input value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} required className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-sub">{t('fieldLastName')}</label>
                <input value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} required className={inputCls} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-sub">{t('fieldPhone')}</label>
              <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder={t('fieldPhonePh')} className={inputCls} />
            </div>
            {editModal.roles.includes('PRO_AGENCE') && (
              <div>
                <label className="mb-1 block text-xs font-medium text-sub">{t('fieldAgencyName')}</label>
                <input value={editForm.agencyName} onChange={e => setEditForm(f => ({ ...f, agencyName: e.target.value }))} className={inputCls} />
              </div>
            )}
            {formError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}
            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={() => setEditModal(null)} className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors">{t('cancel')}</button>
              <button type="submit" disabled={formLoading}
                className="flex items-center gap-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
                {formLoading ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-check text-xs" />{t('save')}</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL — Supprimer */}
      {deleteModal && (
        <Modal onClose={() => setDeleteModal(null)} title={t('modalDeleteUser')}>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <i className="fa-solid fa-triangle-exclamation text-red-600" />
          </div>
          <p className="text-sm text-sub mb-1"><span className="font-medium text-text">{deleteModal.firstName} {deleteModal.lastName}</span></p>
          <p className="text-xs text-sub mb-6">{t('deleteUserWarning')}</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setDeleteModal(null)} className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors">{t('cancel')}</button>
            <button onClick={() => void handleDelete()} disabled={actionId !== null}
              className="text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
              {actionId === deleteModal.id + 'delete' ? <i className="fa-solid fa-spinner fa-spin" /> : t('deletePermanently')}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL — Créer agent */}
      {agentModal && (
        <Modal onClose={() => setAgentModal(false)} title={t('modalCreateAgent')}>
          <form onSubmit={e => void handleCreateAgent(e)} className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <i className="fa-solid fa-circle-info text-emerald-600 mt-0.5 shrink-0 text-sm" />
              <p className="text-xs text-emerald-700">{t('randomPasswordNote')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-sub">{t('fieldFirstNameReq')}</label>
                <input value={agentForm.firstName} onChange={e => setAgentForm(f => ({ ...f, firstName: e.target.value }))} required className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-sub">{t('fieldLastNameReq')}</label>
                <input value={agentForm.lastName} onChange={e => setAgentForm(f => ({ ...f, lastName: e.target.value }))} required className={inputCls} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-sub">{t('fieldEmailReq')}</label>
              <input type="email" value={agentForm.email} onChange={e => setAgentForm(f => ({ ...f, email: e.target.value }))} required className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-sub">{t('fieldPhone')}</label>
              <input value={agentForm.phone} onChange={e => setAgentForm(f => ({ ...f, phone: e.target.value }))} placeholder={t('fieldPhonePh')} className={inputCls} />
            </div>
            {formError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}
            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={() => setAgentModal(false)} className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors">{t('cancel')}</button>
              <button type="submit" disabled={formLoading}
                className="flex items-center gap-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
                {formLoading ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-user-plus text-xs" />{t('createAgentSubmit')}</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* CONFIRM — Retirer BAILLEUR */}
      <ConfirmModal
        open={removeBailleurModal !== null}
        onClose={() => setRemoveBailleurModal(null)}
        onConfirm={handleConfirmRemoveBailleur}
        title={t('confirmRemoveBailleurTitle', {
          name: `${removeBailleurModal?.firstName ?? ''} ${removeBailleurModal?.lastName ?? ''}`.trim(),
        })}
        description={t('confirmRemoveBailleurDesc')}
        confirmLabel={t('confirmRemoveBailleurLabel')}
        variant="danger"
      />

      {/* MODAL — Créer agence */}
      {agenceModal && (
        <Modal onClose={() => setAgenceModal(false)} title={t('modalCreateAgence')}>
          <form onSubmit={e => void handleCreateAgence(e)} className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5">
              <i className="fa-solid fa-circle-info text-purple-600 mt-0.5 shrink-0 text-sm" />
              <p className="text-xs text-purple-700">{t('randomPasswordNote')}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-sub">{t('fieldAgencyNameReq')}</label>
              <input value={agenceForm.agencyName} onChange={e => setAgenceForm(f => ({ ...f, agencyName: e.target.value }))} placeholder={t('agencyNamePh')} required className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-sub">{t('fieldContactFirstNameReq')}</label>
                <input value={agenceForm.firstName} onChange={e => setAgenceForm(f => ({ ...f, firstName: e.target.value }))} required className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-sub">{t('fieldContactLastNameReq')}</label>
                <input value={agenceForm.lastName} onChange={e => setAgenceForm(f => ({ ...f, lastName: e.target.value }))} required className={inputCls} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-sub">{t('fieldEmailReq')}</label>
              <input type="email" value={agenceForm.email} onChange={e => setAgenceForm(f => ({ ...f, email: e.target.value }))} required className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-sub">{t('fieldPhone')}</label>
              <input value={agenceForm.phone} onChange={e => setAgenceForm(f => ({ ...f, phone: e.target.value }))} placeholder={t('fieldPhonePh')} className={inputCls} />
            </div>
            {formError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}
            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={() => setAgenceModal(false)} className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors">{t('cancel')}</button>
              <button type="submit" disabled={formLoading}
                className="flex items-center gap-1.5 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
                {formLoading ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-building text-xs" />{t('createAgenceSubmit')}</>}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-card border border-line p-6 shadow-xl my-auto">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <button onClick={onClose} className="text-sub hover:text-text transition-colors">
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg px-3 py-2.5">
      <p className="text-xs text-sub mb-0.5">{label}</p>
      <p className="text-sm font-medium text-text truncate">{value}</p>
    </div>
  );
}
