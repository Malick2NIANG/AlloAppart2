'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Listing, PaginatedResponse, ListingStatus } from '@/types';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import AlloVerifieBadge from '@/components/ui/AlloVerifieBadge';

interface VerifModal { listingId: string; title: string; }
interface AgentOption { id: string; firstName: string; lastName: string; completedMissions: number; }

const ITEMS_PER_PAGE = 6;

const FILTERS: { key: ListingStatus; label: string; icon: string; iconColor: string; bgColor: string }[] = [
  { key: 'ACTIVE',    label: 'Actives',    icon: 'fa-circle-check',  iconColor: 'text-green-600', bgColor: 'bg-green-50' },
  { key: 'DRAFT',     label: 'Brouillons', icon: 'fa-pen-to-square', iconColor: 'text-amber-500', bgColor: 'bg-amber-50' },
  { key: 'RENTED',    label: 'Louées',     icon: 'fa-key',           iconColor: 'text-blue-500',  bgColor: 'bg-blue-50'  },
  { key: 'SUSPENDED', label: 'Archivées',  icon: 'fa-box-archive',   iconColor: 'text-red-400',   bgColor: 'bg-red-50'   },
];

const EMPTY_MESSAGES: Record<ListingStatus, string> = {
  ACTIVE:    'Aucune annonce active — publiez un brouillon pour démarrer',
  DRAFT:     'Aucun brouillon',
  RENTED:    'Aucune annonce louée',
  SUSPENDED: 'Aucune annonce archivée',
};

const STATUS_LABELS: Record<ListingStatus, string> = {
  ACTIVE: 'Active', DRAFT: 'Brouillon', RENTED: 'Louée', SUSPENDED: 'Archivée',
};

const STATUS_BADGE: Record<ListingStatus, string> = {
  ACTIVE:    'bg-green-100 text-green-700',
  DRAFT:     'bg-amber-50 text-amber-700 border border-amber-200',
  RENTED:    'bg-blue-50 text-blue-700',
  SUSPENDED: 'bg-card border border-line text-sub',
};

function BailleurListingsContent() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);
  const searchParams = useSearchParams();

  const [listings,    setListings]    = useState<Listing[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [filter,      setFilter]      = useState<ListingStatus>('ACTIVE');
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(1);
  const [verifModal,  setVerifModal]  = useState<VerifModal | null>(null);
  const [verifForm,   setVerifForm]   = useState({ auditType: 'BASIC', scheduledAt: '', preferredAgentId: '' });
  const [verifLoading,setVerifLoading]= useState(false);
  const [agents,      setAgents]      = useState<AgentOption[]>([]);
  const [agentsLoaded,setAgentsLoaded]= useState(false);
  const [archiveModal, setArchiveModal] = useState<{ listingId: string; title: string } | null>(null);
  const [deleteModal,  setDeleteModal]  = useState<{ listingId: string; title: string } | null>(null);
  const [boostModal,   setBoostModal]   = useState<{ listingId: string; title: string } | null>(null);
  const [boosting,     setBoosting]     = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getToken().then((token) => {
      if (!token) { setLoading(false); return; }
      api.get<PaginatedResponse<Listing>>('/listings/mine', token)
        .then((res) => setListings(res.data))
        .catch(() => setError('Impossible de charger vos annonces.'))
        .finally(() => setLoading(false));
    });
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'boost_success') toastRef.current.success('Boost activé ! Votre annonce est mise en avant.');
    if (status === 'boost_cancel')  toastRef.current.error('Paiement du boost annulé.');
  }, [searchParams]);

  // Reset page quand filtre ou recherche change
  useEffect(() => { setPage(1); }, [filter, search]);

  const triggerRevalidation = () => {
    fetch('/api/revalidate', {
      method: 'POST',
      headers: { 'x-revalidate-secret': process.env.NEXT_PUBLIC_REVALIDATE_SECRET ?? '' },
    }).catch(() => {});
  };

  // Charge la liste des agents une seule fois
  const loadAgents = useCallback(async () => {
    if (agentsLoaded) return;
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.get<AgentOption[]>('/auth/agents', token);
      setAgents(data);
    } catch { /* non bloquant */ } finally {
      setAgentsLoaded(true);
    }
  }, [agentsLoaded, getToken]);

  const openVerifModal = (modal: VerifModal) => {
    setVerifModal(modal);
    loadAgents();
  };

  const requestVerif = async () => {
    if (!verifModal || !verifForm.scheduledAt) return;
    const token = await getToken();
    if (!token) return;
    setVerifLoading(true);
    try {
      await api.post('/verifications', {
        listingId: verifModal.listingId,
        auditType: verifForm.auditType,
        scheduledAt: new Date(verifForm.scheduledAt).toISOString(),
        ...(verifForm.preferredAgentId ? { preferredAgentId: verifForm.preferredAgentId } : {}),
      }, token);
      toast.success(`Demande AlloVérifié envoyée pour "${verifModal.title}"`);
      setVerifModal(null);
      setVerifForm({ auditType: 'BASIC', scheduledAt: '', preferredAgentId: '' });
    } catch {
      toast.error('Erreur lors de la demande. Veuillez réessayer.');
    } finally {
      setVerifLoading(false);
    }
  };

  /** Met à jour le statut d'un listing dans le state local sans re-fetch */
  const patchLocal = (listingId: string, patch: Partial<Listing>) =>
    setListings((prev) => prev.map((l) => l.id === listingId ? { ...l, ...patch } : l));

  /** Archive : DRAFT/ACTIVE → SUSPENDED (corbeille) */
  const archiveListing = async () => {
    if (!archiveModal) return;
    const token = await getToken();
    if (!token) return;
    try {
      await api.patch(`/listings/${archiveModal.listingId}/archive`, {}, token);
      toast.success(`"${archiveModal.title}" déplacée dans les archives`);
      patchLocal(archiveModal.listingId, { status: 'SUSPENDED' });
      setArchiveModal(null);
      triggerRevalidation();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible d\'archiver cette annonce.');
      setArchiveModal(null);
    }
  };

  /** Restaure une annonce archivée → DRAFT ou ACTIVE */
  const restoreListing = async (listingId: string, title: string, targetStatus: 'DRAFT' | 'ACTIVE') => {
    const token = await getToken();
    if (!token) return;
    try {
      await api.patch(`/listings/${listingId}/restore`, { status: targetStatus }, token);
      toast.success(
        targetStatus === 'ACTIVE'
          ? `"${title}" republiée avec succès`
          : `"${title}" remise en brouillon`,
      );
      patchLocal(listingId, { status: targetStatus });
      triggerRevalidation();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible de restaurer cette annonce.');
    }
  };

  /** Suppression définitive depuis les archives */
  const deleteListing = async () => {
    if (!deleteModal) return;
    const token = await getToken();
    if (!token) return;
    try {
      await api.delete(`/listings/${deleteModal.listingId}`, token);
      toast.success(`"${deleteModal.title}" supprimée définitivement`);
      setListings((prev) => prev.filter((l) => l.id !== deleteModal.listingId));
      setDeleteModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible de supprimer cette annonce.');
      setDeleteModal(null);
    }
  };

  const unpublishListing = async (listingId: string, title: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      await api.patch(`/listings/${listingId}/unpublish`, {}, token);
      toast.success(`"${title}" dépubliée et passée en brouillon`);
      patchLocal(listingId, { status: 'DRAFT' });
      triggerRevalidation();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible de dépublier cette annonce.');
    }
  };

  const publishListing = async (listingId: string, title: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      await api.patch(`/listings/${listingId}/publish`, {}, token);
      toast.success(`"${title}" publiée`);
      patchLocal(listingId, { status: 'ACTIVE' });
      triggerRevalidation();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible de publier cette annonce.');
    }
  };

  /** Ouvre le modal de confirmation boost */
  const openBoostModal = (listingId: string, title: string) => {
    setBoostModal({ listingId, title });
  };

  /** Lance réellement le paiement après confirmation */
  const confirmBoost = async () => {
    if (!boostModal) return;
    const { listingId } = boostModal;
    setBoostModal(null);
    setBoosting(listingId);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await api.post<{ payment_url?: string }>(`/listings/${listingId}/boost`, {}, token);
      if (!res.payment_url) {
        toast.error('Service de paiement indisponible. Veuillez réessayer.');
        setBoosting(null);
        return;
      }
      window.location.href = res.payment_url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du boost.');
      setBoosting(null);
    }
  };

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().slice(0, 16);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} height="100px" />)}
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

  const counts: Record<ListingStatus, number> = {
    ACTIVE:    listings.filter((l) => l.status === 'ACTIVE').length,
    DRAFT:     listings.filter((l) => l.status === 'DRAFT').length,
    RENTED:    listings.filter((l) => l.status === 'RENTED').length,
    SUSPENDED: listings.filter((l) => l.status === 'SUSPENDED').length,
  };

  // Filtre statut + recherche texte
  const q = search.trim().toLowerCase();
  const filtered  = listings
    .filter((l) => l.status === filter)
    .filter((l) => !q || l.title.toLowerCase().includes(q) || l.city.toLowerCase().includes(q));
  const pageCount = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const visible   = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div>
      {/* En-tête */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-text">Mes annonces</h1>
        <Link href="/publier" className="btn-gold self-start sm:self-auto">
          <i className="fa-solid fa-plus text-sm" /> Nouvelle annonce
        </Link>
      </div>

      {/* Cartes-filtres statut */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {FILTERS.map(({ key, label, icon, iconColor, bgColor }) => {
          const isActive = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                isActive ? 'border-gold-dark bg-gold-pale/30' : 'border-line bg-card hover:border-gold-dark/40'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full ${bgColor}`}>
                  <i className={`fa-solid ${icon} ${iconColor}`} />
                </span>
                <span className="text-2xl font-bold text-text">{counts[key]}</span>
              </div>
              <p className="text-sm font-medium text-text">{label}</p>
              {isActive && <p className="text-xs text-gold-dark mt-0.5 font-medium">Sélectionné</p>}
            </button>
          );
        })}
      </div>

      {/* Barre de recherche */}
      <div className="mb-6 relative">
        <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-sub text-sm pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par titre ou ville…"
          className="w-full rounded-xl border border-line bg-card pl-10 pr-10 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-1 focus:ring-gold-dark transition"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sub hover:text-text transition"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        )}
      </div>

      {/* Résultats */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className={`fa-solid ${q ? 'fa-magnifying-glass' : (FILTERS.find((f) => f.key === filter)?.icon ?? 'fa-house')} text-2xl text-gold-dark`} />
          </div>
          <p className="font-semibold text-text">
            {q ? `Aucun résultat pour "${search}"` : EMPTY_MESSAGES[filter]}
          </p>
          {!q && filter === 'DRAFT' && (
            <Link href="/publier" className="btn-gold mt-5">
              <i className="fa-solid fa-plus text-sm" /> Nouvelle annonce
            </Link>
          )}
          {q && (
            <button onClick={() => setSearch('')} className="mt-3 text-sm text-gold-dark hover:underline">
              Effacer la recherche
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Compteur résultats si recherche active */}
          {q && (
            <p className="mb-3 text-sm text-sub">
              {filtered.length} résultat{filtered.length > 1 ? 's' : ''} pour &quot;{search}&quot;
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visible.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onUnpublish={unpublishListing}
                onPublish={publishListing}
                onArchive={(listingId, title) => setArchiveModal({ listingId, title })}
                onRestore={restoreListing}
                onDelete={(listingId, title) => setDeleteModal({ listingId, title })}
                onVerify={(listingId, title) => openVerifModal({ listingId, title })}
                onBoost={openBoostModal}
                boosting={boosting}
              />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="border border-line bg-card text-sm px-4 py-2 rounded-xl disabled:opacity-50"
              >
                Précédent
              </button>
              <span className="text-sm text-sub">Page {page} sur {pageCount}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page === pageCount}
                className="border border-line bg-card text-sm px-4 py-2 rounded-xl disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}

      {/* Modale AlloVérifié */}
      {verifModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-line p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-text mb-1">Demander AlloVérifié</h2>
            <p className="text-sm text-sub mb-5 truncate">{verifModal.title}</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-sub mb-1.5">Type d&apos;audit</label>
                <div className="flex gap-3">
                  {[
                    { value: 'BASIC', label: 'Basique', desc: 'Contrôle des points essentiels' },
                    { value: 'FULL',  label: 'Complet', desc: 'Audit approfondi avec rapport' },
                  ].map((opt) => (
                    <button key={opt.value} type="button"
                      onClick={() => setVerifForm((f) => ({ ...f, auditType: opt.value }))}
                      className={`flex-1 rounded-xl border p-3 text-left transition-colors ${
                        verifForm.auditType === opt.value ? 'border-gold-dark bg-gold-pale' : 'border-line bg-bg hover:border-gold-dark'
                      }`}>
                      <p className={`text-sm font-medium ${verifForm.auditType === opt.value ? 'text-gold-dark' : 'text-text'}`}>{opt.label}</p>
                      <p className="text-xs text-sub mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-sub mb-1.5">Date et heure souhaitées</label>
                <input type="datetime-local" min={minDateStr} value={verifForm.scheduledAt}
                  onChange={(e) => setVerifForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-gold-dark" />
              </div>
              {/* Agent préféré — optionnel */}
              <div>
                <label className="block text-xs font-medium text-sub mb-1.5">
                  Agent préféré <span className="text-sub font-normal">(optionnel)</span>
                </label>
                <select
                  value={verifForm.preferredAgentId}
                  onChange={(e) => setVerifForm((f) => ({ ...f, preferredAgentId: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-gold-dark"
                >
                  <option value="">— Pas de préférence (recommandé) —</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.firstName} {a.lastName}
                      {a.completedMissions > 0 ? ` · ${a.completedMissions} mission${a.completedMissions > 1 ? 's' : ''}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-sub mt-1">
                  L&apos;administrateur reste libre d&apos;attribuer l&apos;agent le plus disponible.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => { setVerifModal(null); setVerifForm({ auditType: 'BASIC', scheduledAt: '', preferredAgentId: '' }); }}
                className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors">
                Annuler
              </button>
              <button onClick={requestVerif} disabled={!verifForm.scheduledAt || verifLoading} className="btn-gold text-sm disabled:opacity-50">
                {verifLoading ? <i className="fa-solid fa-spinner fa-spin" /> : 'Envoyer la demande'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale boost ─────────────────────────────────────── */}
      {boostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-line shadow-2xl overflow-hidden">

            {/* Bandeau doré */}
            <div className="bg-linear-to-r from-gold to-gold-light px-6 py-5 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 mb-3">
                <i className="fa-solid fa-rocket text-white text-2xl" />
              </div>
              <h2 className="text-xl font-extrabold text-gray-900">Booster cette annonce</h2>
              <p className="text-sm text-gray-800/80 mt-1 truncate">&ldquo;{boostModal.title}&rdquo;</p>
            </div>

            <div className="p-6">
              {/* Prix */}
              <div className="flex items-center justify-between rounded-2xl border border-gold/30 bg-gold-pale/60 px-5 py-4 mb-5">
                <div>
                  <p className="text-xs font-bold text-sub uppercase tracking-wider">Prix unique</p>
                  <p className="text-3xl font-extrabold text-text mt-0.5">5 000 <span className="text-lg font-semibold">FCFA</span></p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-sub uppercase tracking-wider">Durée</p>
                  <p className="text-3xl font-extrabold text-gold-dark mt-0.5">7 <span className="text-lg font-semibold">jours</span></p>
                </div>
              </div>

              {/* Avantages */}
              <p className="text-xs font-bold text-sub uppercase tracking-wider mb-3">Ce que vous obtenez</p>
              <div className="space-y-2.5 mb-6">
                {[
                  { icon: 'fa-bolt',             color: 'text-gold-dark', text: 'Badge « En vedette » affiché sur votre annonce' },
                  { icon: 'fa-arrow-up',          color: 'text-emerald-600', text: 'Priorité dans les résultats de recherche' },
                  { icon: 'fa-eye',               color: 'text-blue-500', text: 'Visibilité maximale sur l\'accueil et les listes' },
                  { icon: 'fa-chart-line',         color: 'text-purple-500', text: 'Score de boost +10 pts (cumulable)' },
                ].map((item) => (
                  <div key={item.icon} className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg border border-line ${item.color}`}>
                      <i className={`fa-solid ${item.icon} text-xs`} />
                    </span>
                    <p className="text-sm text-text">{item.text}</p>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="flex gap-3">
                <button
                  onClick={() => setBoostModal(null)}
                  className="flex-1 rounded-xl border border-line py-3 text-sm font-medium text-sub hover:text-text hover:border-text/30 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => void confirmBoost()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gold-dark hover:bg-gold-dark/90 text-white font-semibold py-3 text-sm transition-colors"
                >
                  <i className="fa-solid fa-lock text-xs" />
                  Payer 5 000 FCFA
                </button>
              </div>
              <p className="text-[10px] text-sub text-center mt-3">
                Paiement sécurisé via PayDunya · Sans engagement
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modale archivage (corbeille) */}
      {archiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-line p-6 shadow-xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50">
              <i className="fa-solid fa-box-archive text-amber-500" />
            </div>
            <h2 className="text-lg font-semibold text-text mb-1">Archiver l&apos;annonce ?</h2>
            <p className="text-sm text-sub mb-1">
              &quot;{archiveModal.title}&quot;
            </p>
            <p className="text-xs text-sub mb-6">
              L&apos;annonce sera masquée du public et placée dans vos archives. Vous pourrez la supprimer définitivement depuis l&apos;onglet Archives.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setArchiveModal(null)}
                className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors">
                Annuler
              </button>
              <button onClick={() => void archiveListing()}
                className="text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl transition-colors">
                Archiver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale suppression définitive (depuis archives) */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-line p-6 shadow-xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
              <i className="fa-solid fa-trash text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-text mb-1">Suppression définitive</h2>
            <p className="text-sm text-sub mb-1">&quot;{deleteModal.title}&quot;</p>
            <p className="text-xs text-sub mb-6">
              Cette action est irréversible. L&apos;annonce et toutes ses données seront définitivement supprimées.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteModal(null)}
                className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors">
                Annuler
              </button>
              <button onClick={() => void deleteListing()}
                className="text-sm font-semibold bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl transition-colors">
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BailleurListingsPage() {
  return (
    <Suspense fallback={
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} height="100px" />)}
      </div>
    }>
      <BailleurListingsContent />
    </Suspense>
  );
}

function ListingCard({
  listing, onUnpublish, onPublish, onArchive, onRestore, onDelete, onVerify, onBoost, boosting,
}: {
  listing: Listing;
  onUnpublish: (id: string, title: string) => void;
  onPublish: (id: string, title: string) => void;
  onArchive: (id: string, title: string) => void;
  onRestore: (id: string, title: string, target: 'DRAFT' | 'ACTIVE') => void;
  onDelete: (id: string, title: string) => void;
  onVerify: (id: string, title: string) => void;
  onBoost: (id: string, title: string) => void;
  boosting: string | null;
}) {
  const boosted = !!listing.boostUntil && new Date(listing.boostUntil) > new Date();

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      {/* ligne 1 */}
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-text truncate">{listing.title}</p>
        <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[listing.status]}`}>
          {STATUS_LABELS[listing.status]}
        </span>
      </div>

      {/* ligne 2 */}
      <p className="text-sm text-sub mt-0.5">
        <i className="fa-solid fa-location-dot text-gold-dark text-xs mr-1" />
        {listing.city} · {formatPrice(listing.price)}/mois
      </p>

      {/* badges */}
      {(listing.isVerified || (listing._count?.bookings ?? 0) > 0 || boosted) && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {listing.isVerified && (
            <AlloVerifieBadge />
          )}
          {(listing._count?.bookings ?? 0) > 0 && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
              <i className="fa-solid fa-calendar text-xs mr-1" />
              {listing._count?.bookings} réservation{(listing._count?.bookings ?? 0) > 1 ? 's' : ''}
            </span>
          )}
          {boosted && (
            <span className="text-xs bg-gold-pale text-gold-dark px-2.5 py-1 rounded-full font-medium">
              <i className="fa-solid fa-rocket text-xs mr-1" />Boostée
            </span>
          )}
        </div>
      )}

      {/* actions */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">

        {listing.status === 'ACTIVE' && (
          <>
            <Link href={`/listings/${listing.id}`} className="text-sm font-medium text-gold-dark hover:underline">
              Voir <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
            </Link>
            <button onClick={() => onUnpublish(listing.id, listing.title)}
              className="text-sm font-medium text-sub hover:text-amber-600 transition-colors">
              <i className="fa-solid fa-eye-slash text-xs mr-1" />Dépublier
            </button>
            {!boosted && (
              <button onClick={() => onBoost(listing.id, listing.title)} disabled={boosting !== null}
                className="text-xs font-medium text-sub hover:text-gold-dark border border-line hover:border-gold-dark rounded-lg py-1 px-2.5 transition-colors disabled:opacity-50">
                {boosting === listing.id
                  ? <i className="fa-solid fa-spinner fa-spin text-xs" />
                  : <><i className="fa-solid fa-rocket text-xs mr-1" />Booster</>
                }
              </button>
            )}
            {!listing.isVerified && (
              <button onClick={() => onVerify(listing.id, listing.title)}
                className="text-xs font-medium text-gold-dark hover:text-gold-600 border border-gold-dark hover:bg-gold-pale rounded-lg py-1 px-2.5 transition-colors">
                <i className="fa-solid fa-shield-halved text-xs mr-1" /> AlloVérifié
              </button>
            )}
            <button onClick={() => onArchive(listing.id, listing.title)}
              className="text-sm font-medium text-sub hover:text-red-500 transition-colors ml-auto">
              <i className="fa-solid fa-box-archive text-xs mr-1" />Archiver
            </button>
          </>
        )}

        {listing.status === 'DRAFT' && (
          <>
            <Link href={`/bailleur/listings/${listing.id}/edit`}
              className="text-sm font-medium text-sub hover:text-text transition-colors">
              <i className="fa-solid fa-pen-to-square text-xs mr-1" />Modifier
            </Link>
            <button onClick={() => onPublish(listing.id, listing.title)} className="btn-gold text-xs py-1.5 px-3">
              <i className="fa-solid fa-upload text-xs mr-1" />Publier
            </button>
            <button onClick={() => onArchive(listing.id, listing.title)}
              className="text-sm font-medium text-sub hover:text-red-500 transition-colors ml-auto">
              <i className="fa-solid fa-box-archive text-xs mr-1" />Archiver
            </button>
          </>
        )}

        {listing.status === 'RENTED' && (
          <Link href={`/listings/${listing.id}`} className="text-sm font-medium text-gold-dark hover:underline">
            Voir <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
          </Link>
        )}

        {listing.status === 'SUSPENDED' && (
          <>
            <button
              onClick={() => onRestore(listing.id, listing.title, 'DRAFT')}
              className="text-sm font-medium text-sub hover:text-amber-600 transition-colors"
            >
              <i className="fa-solid fa-pen-to-square text-xs mr-1" />Brouillon
            </button>
            <button
              onClick={() => onRestore(listing.id, listing.title, 'ACTIVE')}
              className="text-sm font-medium text-sub hover:text-green-600 transition-colors"
            >
              <i className="fa-solid fa-upload text-xs mr-1" />Republier
            </button>
            <button
              onClick={() => onDelete(listing.id, listing.title)}
              className="text-sm font-medium text-red-500 hover:text-red-700 transition-colors ml-auto"
            >
              <i className="fa-solid fa-trash text-xs mr-1" />Supprimer
            </button>
          </>
        )}

      </div>
    </div>
  );
}
