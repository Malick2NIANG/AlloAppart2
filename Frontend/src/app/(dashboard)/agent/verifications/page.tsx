'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Verification } from '@/types';
import { useToast } from '@/components/ui/Toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Tab = 'assigned' | 'inprogress' | 'history';

interface FullVerif extends Omit<Verification, 'listing'> {
  listing?: {
    id: string; title: string; city: string; address?: string; images: string[];
    owner?: { id: string; firstName: string; lastName: string; phone?: string; email?: string };
  };
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const AUDIT_LABEL: Record<string, string> = { BASIC: 'Basic', FULL: 'Full' };

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function AgentVerificationsPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const router = useRouter();

  const [tab,          setTab]          = useState<Tab>('assigned');
  const [assigned,     setAssigned]     = useState<FullVerif[]>([]);
  const [history,      setHistory]      = useState<FullVerif[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [acting,       setActing]       = useState<string | null>(null);
  const [openingChat,  setOpeningChat]  = useState<string | null>(null);

  /* Modals */
  const [declineModal,  setDeclineModal]  = useState<FullVerif | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [completeModal,   setCompleteModal]   = useState<FullVerif | null>(null);
  const [completeNotes,   setCompleteNotes]   = useState('');
  const [completeReport,  setCompleteReport]  = useState('');
  const [completeTour,    setCompleteTour]    = useState('');
  const [photos,          setPhotos]          = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  /* ── Load ────────────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      const [a, h] = await Promise.all([
        api.get<FullVerif[]>('/verifications/assigned', token),
        api.get<FullVerif[]>('/verifications/history', token),
      ]);
      setAssigned(a);
      setHistory(h);
    } catch { toastRef.current.error('Impossible de charger les missions.'); }
    finally { setLoading(false); }
  }, [getToken]); // toast exclu des deps pour éviter la boucle infinie

  useEffect(() => { void load(); }, [load]);

  const inProgress = assigned.filter((v) => v.status === 'IN_PROGRESS');
  const scheduled  = assigned.filter((v) => v.status === 'SCHEDULED');

  /* ── Actions ─────────────────────────────────────────────────────────── */
  const doAction = async (id: string, action: 'start' | 'complete' | 'reject', body?: object) => {
    const token = await getToken();
    if (!token) return;
    setActing(id + action);
    try {
      await api.patch(`/verifications/${id}/${action}`, body ?? {}, token);
      toastRef.current.success(action === 'start' ? 'Mission démarrée !' : action === 'complete' ? 'Mission certifiée ✓' : 'Mission rejetée');
      await load();
    } catch { toastRef.current.error('Erreur. Veuillez réessayer.'); }
    finally { setActing(null); }
  };

  /* ── Photo upload ─────────────────────────────────────────────────────── */
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const token = await getToken().catch(() => null);
    if (!token) return;
    setUploadingPhotos(true);
    const urls: string[] = [];
    for (const file of files) {
      try {
        const form = new FormData();
        form.append('file', file);
        const res  = await fetch(`${API_URL}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
        const data = await res.json() as { url?: string };
        if (data.url) urls.push(data.url);
      } catch { /* skip */ }
    }
    setPhotos((prev) => [...prev, ...urls]);
    setUploadingPhotos(false);
    e.target.value = '';
  };

  /* ── Contact bailleur ────────────────────────────────────────────────── */
  const openBailleurChat = async (listingId: string, verificationId: string) => {
    setOpeningChat(verificationId);
    try {
      const token = await getToken();
      if (!token) return;
      // L'agent utilise son propre ID comme tenantId → room entre agent et bailleur
      const room = await api.post<{ id: string }>('/messages/rooms', { listingId }, token);
      router.push(`/agent/messages?room=${room.id}`);
    } catch { toastRef.current.error('Impossible d\'ouvrir la messagerie.'); }
    finally { setOpeningChat(null); }
  };

  const submitComplete = async () => {
    if (!completeModal) return;
    await doAction(completeModal.id, 'complete', {
      notes:     completeNotes.trim()  || undefined,
      reportUrl: completeReport.trim() || undefined,
      tourUrl:   completeTour.trim()   || undefined,
      photos:    photos.length ? photos : undefined,
    });
    setCompleteModal(null);
    setCompleteNotes(''); setCompleteReport(''); setCompleteTour(''); setPhotos([]);
  };

  const submitDecline = async () => {
    if (!declineModal || !declineReason.trim()) return;
    const token = await getToken();
    if (!token) return;
    setActing(declineModal.id + 'decline');
    try {
      await api.patch(`/verifications/${declineModal.id}/decline`, { reason: declineReason }, token);
      toastRef.current.success('Mission déclinée — l\'admin va réassigner.');
      setDeclineModal(null); setDeclineReason('');
      await load();
    } catch { toastRef.current.error('Erreur. Veuillez réessayer.'); }
    finally { setActing(null); }
  };

  /* ── Tabs data ────────────────────────────────────────────────────────── */
  const lists: Record<Tab, FullVerif[]> = {
    assigned:   scheduled,
    inprogress: inProgress,
    history,
  };
  const TAB_CONFIG: { key: Tab; label: string; icon: string; count?: number }[] = [
    { key: 'assigned',   label: 'À faire',   icon: 'fa-calendar-check', count: scheduled.length },
    { key: 'inprogress', label: 'En cours',  icon: 'fa-person-walking', count: inProgress.length },
    { key: 'history',    label: 'Terminées', icon: 'fa-circle-check' },
  ];

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text flex items-center gap-2">
          <i className="fa-solid fa-shield-halved text-gold-dark" /> Mes missions
        </h1>
        <p className="text-sm text-sub mt-0.5">Vérifications AlloVérifié qui vous sont assignées</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg rounded-xl p-1 border border-line">
        {TAB_CONFIG.map(({ key, label, icon, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
              tab === key ? 'bg-card shadow text-gold-dark' : 'text-sub hover:text-text'
            }`}
          >
            <i className={`fa-solid ${icon} text-[10px]`} />
            {label}
            {count !== undefined && count > 0 && (
              <span className={`h-4 min-w-4 rounded-full flex items-center justify-center text-[9px] font-bold px-1 ${
                tab === key ? 'bg-gold-dark text-white' : 'bg-line text-sub'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3].map((i) => <div key={i} className="h-24 rounded-2xl border border-line bg-card animate-pulse" />)}
        </div>
      ) : lists[tab].length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="flex flex-col gap-3">
          {lists[tab].map((v) => (
            <MissionCard
              key={v.id}
              v={v}
              expanded={expanded === v.id}
              onToggle={() => setExpanded(expanded === v.id ? null : v.id)}
              acting={acting}
              openingChat={openingChat}
              onStart={() => doAction(v.id, 'start')}
              onComplete={() => setCompleteModal(v)}
              onDecline={() => setDeclineModal(v)}
              onContact={() => void openBailleurChat(v.listingId, v.id)}
            />
          ))}
        </div>
      )}

      {/* ── Modal Décliner ── */}
      {declineModal && (
        <Modal title="Décliner la mission" onClose={() => { setDeclineModal(null); setDeclineReason(''); }}>
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 mb-4 flex items-start gap-2">
            <i className="fa-solid fa-circle-info text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">
              Votre demande sera transmise à l&apos;admin pour approbation. La mission reste assignée jusqu&apos;à sa décision. Un motif est obligatoire.
            </p>
          </div>
          <p className="text-sm text-sub mb-2">
            Mission : <span className="font-semibold text-text">{declineModal.listing?.title}</span>
          </p>
          <label className="block text-xs font-semibold text-sub uppercase tracking-wide mb-1.5">
            Motif du déclin <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={4}
            placeholder="Expliquez pourquoi vous ne pouvez pas effectuer cette mission (indisponibilité, conflit horaire, etc.)..."
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            maxLength={500}
            className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
          <p className="text-[11px] text-sub text-right mt-0.5">{declineReason.length}/500</p>
          <div className="flex gap-3 mt-3 justify-end">
            <button onClick={() => { setDeclineModal(null); setDeclineReason(''); }} className="btn-cancel text-sm">Annuler</button>
            <button
              onClick={() => void submitDecline()}
              disabled={!declineReason.trim() || acting !== null}
              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {acting
                ? <i className="fa-solid fa-spinner fa-spin" />
                : <><i className="fa-solid fa-paper-plane text-xs" /> Soumettre à l&apos;admin</>
              }
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal Terminer ── */}
      {completeModal && (
        <Modal title="Terminer la vérification" onClose={() => { setCompleteModal(null); setCompleteNotes(''); setCompleteReport(''); setCompleteTour(''); setPhotos([]); }}>
          <p className="text-sm text-sub mb-4">
            Mission : <span className="font-semibold text-text">{completeModal.listing?.title}</span>
          </p>

          <div className="space-y-4">
            {/* Notes */}
            <Field label="Observations de terrain">
              <textarea
                rows={3} value={completeNotes} onChange={(e) => setCompleteNotes(e.target.value)}
                placeholder="État du bien, remarques, points importants..."
                className="input-field resize-none"
              />
            </Field>

            {/* Photos */}
            <Field label={`Photos terrain (${photos.length})`}>
              <div className="space-y-2">
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((url, i) => (
                      <div key={i} className="relative group aspect-square rounded-xl overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Photo ${i+1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <i className="fa-solid fa-xmark text-[9px]" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhotos}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-bg py-3 text-sm text-sub hover:border-gold/40 hover:text-gold-dark transition-colors"
                >
                  {uploadingPhotos
                    ? <><i className="fa-solid fa-spinner fa-spin" /> Envoi…</>
                    : <><i className="fa-solid fa-camera" /> Ajouter des photos</>
                  }
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </div>
            </Field>

            {/* Rapport */}
            <Field label="URL du rapport (optionnel)">
              <input type="url" value={completeReport} onChange={(e) => setCompleteReport(e.target.value)}
                placeholder="https://drive.google.com/..." className="input-field" />
            </Field>

            {/* Visite 3D */}
            <Field label={<>Lien visite 3D <span className="text-gold-dark font-bold">AlloVérifié™</span> <span className="text-sub font-normal">(optionnel)</span></>}>
              <input type="url" value={completeTour} onChange={(e) => setCompleteTour(e.target.value)}
                placeholder="https://lumalabs.ai/capture/..." className="input-field" />
              <p className="mt-1 text-[11px] text-sub">Filmez avec Luma AI et collez le lien ici.</p>
            </Field>
          </div>

          <div className="flex gap-3 mt-5 justify-end">
            <button onClick={() => { setCompleteModal(null); setPhotos([]); }} className="btn-cancel text-sm">Annuler</button>
            <button
              onClick={() => void submitComplete()}
              disabled={acting !== null}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {acting
                ? <><i className="fa-solid fa-spinner fa-spin" /> Envoi…</>
                : <><i className="fa-solid fa-shield-check" /> Certifier le bien</>
              }
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Mission Card ────────────────────────────────────────────────────────── */

function MissionCard({ v, expanded, onToggle, acting, openingChat, onStart, onComplete, onDecline, onContact }: {
  v: FullVerif;
  expanded: boolean;
  onToggle: () => void;
  acting: string | null;
  openingChat: string | null;
  onStart: () => void;
  onComplete: () => void;
  onDecline: () => void;
  onContact: () => void;
}) {
  const isScheduled   = v.status === 'SCHEDULED';
  const isInProgress  = v.status === 'IN_PROGRESS';
  const isDone        = v.status === 'DONE';
  const isRejected    = v.status === 'REJECTED';

  // Démarrage autorisé 15 min avant l'heure prévue (miroir du backend)
  const earliest  = new Date(new Date(v.scheduledAt).getTime() - 15 * 60 * 1000);
  const canStart  = new Date() >= earliest;
  const minsLeft  = Math.ceil((earliest.getTime() - Date.now()) / 60000);

  const statusCfg = {
    SCHEDULED:       { label: 'Planifiée',               bg: 'bg-blue-50',    color: 'text-blue-600',    icon: 'fa-calendar-check' },
    IN_PROGRESS:     { label: 'En cours',                bg: 'bg-purple-50',  color: 'text-purple-600',  icon: 'fa-person-walking' },
    DONE:            { label: 'Certifiée',               bg: 'bg-emerald-50', color: 'text-emerald-600', icon: 'fa-shield-check'   },
    REJECTED:        { label: 'Rejetée',                 bg: 'bg-red-50',     color: 'text-red-600',     icon: 'fa-circle-xmark'   },
    REQUESTED:       { label: 'En attente',              bg: 'bg-amber-50',   color: 'text-amber-600',   icon: 'fa-clock'          },
    DECLINE_PENDING: { label: 'Déclin en attente admin', bg: 'bg-orange-50',  color: 'text-orange-600',  icon: 'fa-hourglass-half' },
  }[v.status] ?? { label: v.status, bg: 'bg-bg', color: 'text-sub', icon: 'fa-circle' };

  return (
    <div className={`rounded-2xl border bg-card overflow-hidden transition-colors ${
      isInProgress ? 'border-purple-200' : isDone ? 'border-emerald-200' : 'border-line'
    }`}>
      {/* Barre de statut en haut */}
      {isInProgress && <div className="h-0.5 bg-gradient-to-r from-purple-400 to-gold-dark" />}
      {isDone        && <div className="h-0.5 bg-emerald-400" />}

      {/* Header cliquable */}
      <button type="button" onClick={onToggle} className="w-full flex items-start gap-4 p-4 text-left hover:bg-bg/40 transition-colors">
        <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${statusCfg.bg}`}>
          <i className={`fa-solid ${statusCfg.icon} ${statusCfg.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <p className="font-bold text-text text-sm truncate">{v.listing?.title ?? 'Mission'}</p>
            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
            <span className="text-[10px] text-sub bg-bg border border-line px-2 py-0.5 rounded-full">
              {AUDIT_LABEL[v.auditType] ?? v.auditType}
            </span>
          </div>
          <p className="text-xs text-sub">
            <i className="fa-solid fa-location-dot text-gold-dark text-[10px] mr-1" />
            {v.listing?.city}{v.listing?.address ? ` · ${v.listing.address}` : ''}
          </p>
          <p className="text-xs text-sub mt-0.5">
            <i className="fa-regular fa-calendar text-[10px] mr-1" />
            {fmtDate(v.scheduledAt)} à {fmtTime(v.scheduledAt)}
          </p>
        </div>

        <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} text-sub text-xs shrink-0 mt-1`} />
      </button>

      {/* Détails */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-line pt-4">

          {/* Contact bailleur */}
          {v.listing?.owner && (
            <div className="rounded-xl bg-bg border border-line p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gold-pale flex items-center justify-center text-xs font-bold text-gold-dark shrink-0">
                {`${v.listing.owner.firstName?.[0] ?? ''}${v.listing.owner.lastName?.[0] ?? ''}`.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text">{v.listing.owner.firstName} {v.listing.owner.lastName}</p>
                <p className="text-[10px] text-sub">Propriétaire</p>
              </div>
              <div className="flex gap-2">
                {v.listing.owner.phone && (
                  <a href={`tel:${v.listing.owner.phone}`}
                    className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors"
                    title={v.listing.owner.phone}
                  >
                    <i className="fa-solid fa-phone text-xs" />
                  </a>
                )}
                {v.listing.owner.email && (
                  <a href={`mailto:${v.listing.owner.email}`}
                    className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors"
                    title={v.listing.owner.email}
                  >
                    <i className="fa-solid fa-envelope text-xs" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={onContact}
                  disabled={openingChat !== null}
                  className="h-8 w-8 rounded-full bg-gold-pale flex items-center justify-center text-gold-dark hover:bg-gold/20 transition-colors disabled:opacity-50"
                  title="Messagerie interne"
                >
                  {openingChat === v.id
                    ? <i className="fa-solid fa-spinner fa-spin text-xs" />
                    : <i className="fa-solid fa-comment-dots text-xs" />
                  }
                </button>
              </div>
            </div>
          )}

          {/* Notes / rapport si DONE */}
          {isDone && v.notes && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">Vos observations</p>
              <p className="text-sm text-emerald-800">{v.notes}</p>
            </div>
          )}
          {isDone && v.photos?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-sub uppercase tracking-wide mb-2">Photos ({v.photos.length})</p>
              <div className="grid grid-cols-3 gap-2">
                {v.photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded-xl overflow-hidden block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Photo ${i+1}`} className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Motif rejet */}
          {isRejected && v.notes && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3">
              <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-1">Motif du rejet</p>
              <p className="text-sm text-red-700">{v.notes}</p>
            </div>
          )}

          {/* Actions */}
          {v.status === 'DECLINE_PENDING' && (
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 flex items-start gap-2">
              <i className="fa-solid fa-hourglass-half text-orange-500 mt-0.5 text-sm" />
              <div>
                <p className="text-sm font-semibold text-orange-700">Déclin en attente d&apos;approbation</p>
                <p className="text-xs text-orange-600 mt-0.5">Votre demande de déclin a été transmise à l&apos;admin. Vous serez notifié de sa décision.</p>
              </div>
            </div>
          )}
          {(isScheduled || isInProgress) && (
            <div className="flex gap-2 pt-1 flex-wrap">
              {isScheduled && (
                canStart ? (
                  <button
                    onClick={onStart}
                    disabled={acting !== null}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gold-dark hover:bg-gold-dark/90 text-white text-sm font-semibold py-2.5 disabled:opacity-50 transition-colors"
                  >
                    {acting ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-play text-xs" /> Démarrer la visite</>}
                  </button>
                ) : (
                  <div className="flex-1 flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5">
                    <i className="fa-solid fa-clock text-blue-500 text-sm shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-blue-700">Visite planifiée à {fmtTime(v.scheduledAt)}</p>
                      <p className="text-[10px] text-blue-500">Disponible dans {minsLeft} min</p>
                    </div>
                  </div>
                )
              )}
              {isInProgress && (
                <button
                  onClick={onComplete}
                  disabled={acting !== null}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 disabled:opacity-50 transition-colors"
                >
                  <i className="fa-solid fa-shield-check text-xs" /> Certifier le bien
                </button>
              )}
              {/* Un seul bouton Décliner — motif obligatoire + approbation admin requise */}
              {isScheduled && (
                <button
                  onClick={onDecline}
                  disabled={acting !== null}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-200 text-amber-600 hover:bg-amber-50 text-sm font-medium px-4 py-2.5 transition-colors disabled:opacity-50"
                >
                  <i className="fa-solid fa-ban text-xs" /> Décliner
                </button>
              )}
            </div>
          )}

          {/* Lien vers la page détail */}
          <div className="pt-1 flex justify-end">
            <Link href={`/agent/verifications/${v.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-dark hover:underline">
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" /> Voir le détail complet
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

function EmptyState({ tab }: { tab: Tab }) {
  const cfg = {
    assigned:   { icon: 'fa-calendar-check', text: 'Aucune mission planifiée', sub: 'Les missions assignées par l\'admin apparaîtront ici.' },
    inprogress: { icon: 'fa-person-walking',  text: 'Aucune visite en cours',  sub: 'Démarrez une mission planifiée pour la voir ici.' },
    history:    { icon: 'fa-shield-check',    text: 'Aucune mission terminée', sub: 'Votre historique de certifications apparaîtra ici.' },
  }[tab];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-line bg-card">
      <div className="h-14 w-14 rounded-2xl bg-gold-pale flex items-center justify-center mb-4">
        <i className={`fa-solid ${cfg.icon} text-2xl text-gold-dark`} />
      </div>
      <p className="font-semibold text-text">{cfg.text}</p>
      <p className="text-xs text-sub mt-1 max-w-xs">{cfg.sub}</p>
    </div>
  );
}

/* ── Helpers UI ──────────────────────────────────────────────────────────── */

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-card border border-line p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text">{title}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center text-sub hover:bg-bg transition-colors">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-sub uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}
