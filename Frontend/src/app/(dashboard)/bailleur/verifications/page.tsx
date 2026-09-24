'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import type { Verification, VerifStatus } from '@/types';
import { StatFilterCard } from '@/components/bookings/StatFilterCard';
import { BookingSearchRow } from '@/components/bookings/BookingSearchRow';
import { BookingPagination } from '@/components/bookings/BookingPagination';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

const PER_PAGE_OPTIONS = [6, 12, 24] as const;
type DemandesFilter = 'ALL' | 'ACTIVE' | 'HISTORY';

interface ListingOption {
  id: string;
  title: string;
  city?: string | null;
  images?: string[] | null;
}

interface AgentRating {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
}

interface VerifWithRating extends Omit<Verification, 'agent'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent?: any;
  rating?: AgentRating | null;
  // Présent uniquement pour une demande REJECTED : indique si un crédit de
  // re-soumission gratuit a été émis pour cette annonce, et s'il a déjà été
  // consommé — cf. verifications.service.ts findByRequester().
  credit?: { used: boolean } | null;
}

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  bio: string | null;
  phone: string | null;
  coverageZone: string | null;
  completedMissions: number;
}

/* ── Visual config (no text) ─────────────────────────────────────────────── */

const VERIF_STYLE: Record<VerifStatus, { color: string; icon: string; bg: string }> = {
  REQUESTED:       { color: 'text-amber-600 dark:text-amber-400',   icon: 'fa-clock',           bg: 'bg-amber-50 dark:bg-amber-950/30'   },
  SCHEDULED:       { color: 'text-blue-600 dark:text-blue-400',    icon: 'fa-calendar-check',  bg: 'bg-blue-50 dark:bg-blue-950/30'    },
  IN_PROGRESS:     { color: 'text-purple-600 dark:text-purple-400',  icon: 'fa-person-walking',  bg: 'bg-purple-50 dark:bg-purple-950/30'  },
  DONE:            { color: 'text-emerald-600 dark:text-emerald-400', icon: 'fa-shield-halved',   bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  REJECTED:        { color: 'text-red-600 dark:text-red-400',     icon: 'fa-circle-xmark',    bg: 'bg-red-50 dark:bg-red-950/30'     },
  DECLINE_PENDING: { color: 'text-orange-600 dark:text-orange-400',  icon: 'fa-hourglass-half',  bg: 'bg-orange-50 dark:bg-orange-950/30'  },
};

const STEPS: VerifStatus[] = ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'DONE'];

function getStepIndex(status: VerifStatus) {
  if (status === 'REJECTED') return -1;
  return STEPS.indexOf(status);
}

/* ── Timeline ────────────────────────────────────────────────────────────── */

function Timeline({ status }: { status: VerifStatus }) {
  const t = useTranslations('bailleur');
  const STATUS_LABELS: Record<VerifStatus, string> = {
    REQUESTED:       t('verifStatusRequested'),
    SCHEDULED:       t('verifStatusScheduled'),
    IN_PROGRESS:     t('verifStatusInProgress'),
    DONE:            t('verifStatusDone'),
    REJECTED:        t('verifStatusRejected'),
    DECLINE_PENDING: t('verifStatusDeclinePending'),
  };

  const currentIdx = getStepIndex(status);
  if (status === 'REJECTED') {
    return (
      <div className="flex items-center gap-2 mt-3">
        <i className="fa-solid fa-circle-xmark text-red-500" />
        <span className="text-xs text-red-600 dark:text-red-400 font-medium">{t('verifRejected')}</span>
      </div>
    );
  }
  return (
    <div className="mt-4">
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const style  = VERIF_STYLE[step];
          const done   = i <= currentIdx;
          const active = i === currentIdx;
          const isLast = i === STEPS.length - 1;
          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs transition-all ${
                  done
                    ? active
                      ? `${style.bg} ${style.color} ring-2 ring-offset-1 ring-current`
                      : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                    : 'bg-line text-sub'
                }`}>
                  <i className={`fa-solid ${done ? (active ? style.icon : 'fa-check') : style.icon} text-[10px]`} />
                </div>
                <p className={`mt-1 text-[9px] text-center leading-tight max-w-[56px] ${done ? (active ? style.color + ' font-semibold' : 'text-emerald-600 dark:text-emerald-400') : 'text-sub'}`}>
                  {STATUS_LABELS[step]}
                </p>
              </div>
              {!isLast && (
                <div className={`flex-1 h-0.5 mb-4 ${i < currentIdx ? 'bg-emerald-300' : 'bg-line'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Stars ───────────────────────────────────────────────────────────────── */

function Stars({ value, interactive = false, onChange }: { value: number; interactive?: boolean; onChange?: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!interactive}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => interactive && setHovered(n)}
          onMouseLeave={() => interactive && setHovered(0)}
          className={`text-lg leading-none transition-colors ${interactive ? 'cursor-pointer' : 'cursor-default'} ${
            n <= (hovered || value) ? 'text-amber-400' : 'text-line'
          }`}>★</button>
      ))}
    </div>
  );
}

/* ── Modal notation ──────────────────────────────────────────────────────── */

function RatingModal({ verifId, agentName, existing, onClose, onSaved }: {
  verifId: string; agentName: string; existing?: AgentRating | null;
  onClose: () => void; onSaved: (r: AgentRating) => void;
}) {
  const { getToken } = useAuth();
  const t = useTranslations('bailleur');
  const [rating,  setRating]  = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const starLabels = ['', t('ratingDesc1'), t('ratingDesc2'), t('ratingDesc3'), t('ratingDesc4'), t('ratingDesc5')];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setError(t('ratingSelectError')); return; }
    setSaving(true); setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error(t('ratingUnauthError'));
      const saved = await api.post<AgentRating>(`/verifications/${verifId}/rate`, { rating, comment: comment || undefined }, token);
      onSaved(saved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('ratingSendError'));
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-card border border-line shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-text">{t('ratingTitle')}</h2>
            <p className="text-xs text-sub mt-0.5">{t('ratingSubtitle', { agentName })}</p>
          </div>
          <button onClick={onClose} className="text-sub hover:text-text transition-colors"><i className="fa-solid fa-xmark text-sm" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-sub uppercase tracking-wide block mb-2">{t('ratingLabel')}</label>
            <Stars value={rating} interactive onChange={setRating} />
            {rating > 0 && <p className="text-xs text-sub mt-1">{starLabels[rating]}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-sub uppercase tracking-wide block mb-1">{t('ratingCommentLabel')}</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3}
              placeholder={t('ratingCommentPh')}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-text placeholder:text-sub resize-none focus:outline-none focus:ring-2 focus:ring-gold/40" />
            <p className="text-[10px] text-sub text-right mt-0.5">{comment.length}/1000</p>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-line bg-bg py-2.5 text-sm text-sub hover:text-text transition-colors">
              {t('cancel')}
            </button>
            <button type="submit" disabled={saving || rating === 0} className="flex-1 btn-gold rounded-xl py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? <i className="fa-solid fa-spinner fa-spin" /> : existing ? t('ratingEdit') : t('ratingSend')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── VerifCard ───────────────────────────────────────────────────────────── */

function VerifCard({ v, expanded, onToggle, onRate, isProActive, onRequestAgain, onEdit, onCancelled }: {
  v: VerifWithRating; expanded: boolean; onToggle: () => void; onRate: () => void; isProActive: boolean;
  onRequestAgain: (listing: ListingOption) => void;
  onEdit: (v: VerifWithRating) => void;
  onCancelled: () => void;
}) {
  const t = useTranslations('bailleur');
  const locale = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';
  const style = VERIF_STYLE[v.status];
  const { getToken } = useAuth();
  const router = useRouter();
  const [openingChat, setOpeningChat] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  // Édition/annulation : uniquement tant que la demande n'a pas encore été
  // prise en charge par un agent (même règle que côté backend).
  const handleCancel = async () => {
    const token = await getToken();
    if (!token) return;
    setCancelling(true);
    try {
      await api.delete(`/verifications/${v.id}`, token);
      onCancelled();
    } catch (err: unknown) {
      alert((err as { message?: string })?.message ?? t('verifCancelError'));
    } finally {
      setCancelling(false);
    }
  };

  const STATUS_LABELS: Record<VerifStatus, string> = {
    REQUESTED:       t('verifStatusRequested'),
    SCHEDULED:       t('verifStatusScheduled'),
    IN_PROGRESS:     t('verifStatusInProgress'),
    DONE:            t('verifStatusDone'),
    REJECTED:        t('verifStatusRejected'),
    DECLINE_PENDING: t('verifStatusDeclinePending'),
  };

  const openAgentChat = async (agentId: string) => {
    if (!v.listingId) return;
    setOpeningChat(true);
    try {
      const token = await getToken();
      if (!token) return;
      const room = await api.post<{ id: string }>('/messages/rooms', { listingId: v.listingId, tenantId: agentId }, token);
      router.push(`/bailleur/messages?room=${room.id}`);
    } catch { /* ignore */ } finally { setOpeningChat(false); }
  };

  return (
    <div className="rounded-2xl border border-line bg-card overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex items-start gap-4 p-5 text-left hover:bg-bg/50 transition-colors">
        {/* Photo principale de l'annonce — pour différencier les demandes en
            un coup d'œil ; badge de statut superposé en bas à droite (icône
            seule en repli si l'annonce n'a pas encore de photo). */}
        <div className="relative shrink-0 h-14 w-14 rounded-xl overflow-hidden bg-bg">
          {v.listing?.images?.[0] ? (
            <Image src={v.listing.images[0]} alt={v.listing.title ?? ''} fill className="object-cover" sizes="56px" />
          ) : (
            <div className={`h-full w-full flex items-center justify-center ${style.bg}`}>
              <i className={`fa-solid ${style.icon} ${style.color}`} />
            </div>
          )}
          <span className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-card ${style.bg}`}>
            <i className={`fa-solid ${style.icon} ${style.color} text-[9px]`} />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="font-semibold text-text text-sm truncate">{v.listing?.title ?? t('verifDefaultListing')}</p>
            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.color}`}>
              {STATUS_LABELS[v.status]}
            </span>
            {v.rating && (
              <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                <i className="fa-solid fa-star text-amber-400 text-[9px]" />{v.rating.rating}/5
              </span>
            )}
          </div>
          <p className="text-xs text-sub">{v.listing?.city ?? ''}</p>
          <p className="text-xs text-sub mt-0.5">
            <i className="fa-regular fa-calendar text-[10px] mr-1" />
            {t('verifScheduledOn', { date: new Date(v.scheduledAt).toLocaleDateString(numLocale, { day: 'numeric', month: 'long', year: 'numeric' }) })}
          </p>
        </div>
        <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} text-sub text-xs shrink-0 mt-1`} />
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-line">
          <Timeline status={v.status} />
          {v.agent && (() => {
            const agent = v.agent;
            const initials = `${agent.firstName?.[0] ?? ''}${agent.lastName?.[0] ?? ''}`.toUpperCase();
            const isScheduled = v.status === 'SCHEDULED';
            return (
              <div className={`mt-4 rounded-xl border p-4 ${isScheduled ? 'border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30' : 'border-line bg-bg'}`}>
                {isScheduled && (
                  <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2">
                    <i className="fa-solid fa-circle-check mr-1" />{t('verifAssignedBadge')}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  {agent.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={agent.avatar} alt={`${agent.firstName} ${agent.lastName}`}
                      className="h-12 w-12 rounded-full object-cover border border-line shrink-0" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gold-pale flex items-center justify-center text-sm font-bold text-gold-dark shrink-0">{initials}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text">{agent.firstName} {agent.lastName}</p>
                    <p className="text-xs text-sub">{t('verifAgentCertified')}</p>
                    {agent.bio && <p className="text-xs text-sub mt-0.5 line-clamp-2">{agent.bio}</p>}
                    {agent.phone && (
                      <div className="flex items-center gap-3 mt-1.5">
                        <a href={`tel:${agent.phone}`} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-400 transition-colors flex items-center gap-1">
                          <i className="fa-solid fa-phone text-[9px]" />{agent.phone}
                        </a>
                        <button
                          type="button"
                          onClick={() => void openAgentChat(agent.id)}
                          disabled={openingChat}
                          className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {openingChat
                            ? <i className="fa-solid fa-spinner fa-spin text-[9px]" />
                            : <i className="fa-solid fa-message text-[9px]" />
                          }
                          {t('verifAgentMessage')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {v.status === 'DONE' && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5">
                <i className="fa-solid fa-shield-halved text-emerald-500" />
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{t('verifCertifiedBadge')}</p>
              </div>
              {v.notes && (
                <div className="rounded-xl bg-bg p-3">
                  <p className="text-[10px] font-semibold text-sub uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <i className="fa-solid fa-note-sticky text-gold-dark" />{t('verifAgentNotes')}
                  </p>
                  <p className="text-sm text-text">{v.notes}</p>
                </div>
              )}
              {v.reportUrl && (
                <a href={v.reportUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-gold-dark hover:border-gold/40 transition-colors">
                  <i className="fa-solid fa-file-pdf text-red-500" />{t('verifDownloadReport')}
                  <i className="fa-solid fa-arrow-down-to-line ml-auto text-xs" />
                </a>
              )}
              {v.photos && v.photos.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-sub uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <i className="fa-regular fa-images text-gold-dark" />{t('verifPhotosLabel', { count: v.photos.length })}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {v.photos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Photo ${i + 1}`} className="w-full aspect-square object-cover rounded-xl hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {v.agent && (
                <div className="rounded-xl border border-line bg-bg p-4 space-y-2">
                  {v.rating ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-semibold text-sub uppercase tracking-wide flex items-center gap-1.5">
                          <i className="fa-solid fa-star text-amber-400" />{t('verifYourReview')}
                        </p>
                        <button onClick={onRate} className="text-[10px] text-gold-dark hover:underline">{t('verifEditReview')}</button>
                      </div>
                      <Stars value={v.rating.rating} />
                      {v.rating.comment && <p className="text-xs text-text mt-1 italic">&ldquo;{v.rating.comment}&rdquo;</p>}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-text">{t('verifRateQuestion')}</p>
                        <p className="text-[11px] text-sub mt-0.5">{t('verifRateHint')}</p>
                      </div>
                      <button onClick={onRate}
                        className="shrink-0 flex items-center gap-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors">
                        <i className="fa-solid fa-star text-amber-400 text-[10px]" />{t('verifLeaveReview')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {v.status === 'REJECTED' && (
            <div className="mt-4 space-y-2">
              {v.notes && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 px-4 py-3">
                  <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-exclamation" />{t('verifRejectionReason')}
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-400">{v.notes}</p>
                </div>
              )}
              {/* Le bailleur a besoin de savoir immédiatement s'il devra
                  repayer pour redemander une vérification sur cette annonce,
                  ou s'il lui reste un crédit gratuit (cf. reject() côté
                  backend : un crédit n'est émis que si cette demande avait
                  été payée). */}
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 px-4 py-3 flex items-start gap-2.5">
                <i className="fa-solid fa-circle-info text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                  {v.credit
                    ? (v.credit.used ? t('verifCreditUsedNote') : t('verifCreditAvailableNote'))
                    : (isProActive ? t('verifNoPaymentNotePro') : t('verifNoPaymentNoteOnce'))}
                </p>
              </div>
              {/* Raccourci : redemande immédiate, uniquement quand cette annonce
                  n'aura rien à repayer (PRO illimité, ou crédit de re-soumission
                  encore disponible) — sinon on renvoie vers le flux normal
                  (paiement) via le bouton "+" en haut de page. */}
              {(isProActive || (v.credit && !v.credit.used)) && v.listing && (
                <button
                  type="button"
                  onClick={() => onRequestAgain({
                    id: v.listingId,
                    title: v.listing?.title ?? '',
                    city: v.listing?.city,
                    images: v.listing?.images,
                  })}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-gold-dark/30 bg-gold-pale/30 dark:bg-gold-dark/10 px-4 py-2.5 text-sm font-semibold text-gold-dark hover:bg-gold-pale/50 dark:hover:bg-gold-dark/20 transition-colors"
                >
                  <i className="fa-solid fa-rotate-right text-xs" />
                  {t('verifRequestAgain')}
                </button>
              )}
            </div>
          )}

          {/* Édition/annulation — uniquement tant qu'aucun agent n'a pris en
              charge la demande, cf. VerificationsService.update()/cancel(). */}
          {v.status === 'REQUESTED' && v.listing && (
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEdit(v)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm font-semibold text-text hover:border-gold-dark/40 transition-colors"
              >
                <i className="fa-solid fa-pen text-xs" />{t('verifEditRequest')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmCancelOpen(true)}
                disabled={cancelling}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
              >
                <i className="fa-solid fa-trash-can text-xs" />{t('verifCancelRequest')}
              </button>
            </div>
          )}

          <ConfirmModal
            open={confirmCancelOpen}
            onClose={() => setConfirmCancelOpen(false)}
            onConfirm={handleCancel}
            title={t('verifCancelConfirmTitle')}
            description={t('verifCancelConfirmDesc')}
            confirmLabel={t('verifCancelRequest')}
            variant="danger"
          />

          {v.listing && (
            <Link href={`/bailleur/listings/${v.listingId}/edit`}
              className="mt-4 flex items-center gap-2 text-xs text-gold-dark hover:underline">
              <i className="fa-solid fa-house text-[10px]" />{t('verifEditListing')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/* ── DateTimePicker ──────────────────────────────────────────────────────── */

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

function DateTimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t      = useTranslations('bailleur');
  const locale = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';

  // Locale-aware day/month names
  const DAYS = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(numLocale, { weekday: 'short' }).format(new Date(2024, 0, 1 + i))
  );
  const MONTHS = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(numLocale, { month: 'long' }).format(new Date(2024, i, 1))
  );

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const minAllowed = new Date(today); minAllowed.setDate(minAllowed.getDate() + 1);

  const parsed = value ? new Date(value) : null;
  const [open,   setOpen]   = useState(false);
  const [cursor, setCursor] = useState<Date>(() => {
    const d = parsed ?? minAllowed;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [popPos, setPopPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef     = useRef<HTMLDivElement>(null);
  const timeRef    = useRef<HTMLDivElement>(null);

  const selDate = parsed ? `${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,'0')}-${String(parsed.getDate()).padStart(2,'0')}` : '';
  const selHour = parsed ? String(parsed.getHours()).padStart(2,'0') : '08';
  const selMin  = parsed ? (['00','15','30','45'].includes(String(parsed.getMinutes()).padStart(2,'0')) ? String(parsed.getMinutes()).padStart(2,'0') : '00') : '00';

  const openPicker = () => {
    if (!triggerRef.current) { setOpen(true); return; }
    const r = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 16;
    const spaceAbove = r.top - 16;
    if (spaceBelow >= spaceAbove) {
      setPopPos({ top: r.bottom + 8, left: r.left, width: r.width, maxHeight: spaceBelow });
    } else {
      setPopPos({ bottom: window.innerHeight - r.top + 8, left: r.left, width: r.width, maxHeight: spaceAbove });
    }
    setOpen(true);
  };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        popRef.current    && !popRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const buildValue = (dateStr: string, hh: string, mm: string) => `${dateStr}T${hh}:${mm}`;

  const selectDay = (d: Date) => {
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    onChange(buildValue(ds, selHour, selMin));
    setTimeout(() => {
      timeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const changeTime = (hh: string, mm: string) => {
    if (!selDate) return;
    onChange(buildValue(selDate, hh, mm));
  };

  const year = cursor.getFullYear(); const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const displayValue = parsed
    ? `${String(parsed.getDate()).padStart(2,'0')}/${String(parsed.getMonth()+1).padStart(2,'0')}/${parsed.getFullYear()}  ${selHour}:${selMin}`
    : '';

  return (
    <>
      <button ref={triggerRef} type="button"
        onClick={() => open ? setOpen(false) : openPicker()}
        className={`w-full flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
          open ? 'border-gold-dark ring-2 ring-gold/30' : 'border-line hover:border-gold-dark/50'
        } bg-bg text-left`}>
        <i className="fa-regular fa-calendar text-gold-dark shrink-0" />
        <span className={displayValue ? 'text-text' : 'text-sub'}>
          {displayValue || t('dtpPlaceholder')}
        </span>
        {displayValue
          ? <span role="button" onClick={(e) => { e.stopPropagation(); onChange(''); }}
              className="ml-auto text-sub hover:text-text transition-colors cursor-pointer">
              <i className="fa-solid fa-xmark text-xs" />
            </span>
          : <i className="fa-solid fa-chevron-down ml-auto text-sub text-xs" />
        }
      </button>

      {open && popPos && (
        <div ref={popRef}
          style={{ position: 'fixed', top: popPos.top, bottom: popPos.bottom, left: popPos.left, width: popPos.width, maxHeight: popPos.maxHeight, zIndex: 9999 }}
          className="rounded-2xl border border-line bg-card shadow-2xl p-4 overflow-y-auto">

          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setCursor(new Date(year, month - 1, 1))}
              className="h-7 w-7 rounded-full hover:bg-bg flex items-center justify-center text-sub hover:text-text transition-colors">
              <i className="fa-solid fa-chevron-left text-xs" />
            </button>
            <span className="text-sm font-semibold text-text">{MONTHS[month]} {year}</span>
            <button type="button" onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="h-7 w-7 rounded-full hover:bg-bg flex items-center justify-center text-sub hover:text-text transition-colors">
              <i className="fa-solid fa-chevron-right text-xs" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-sub py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
              const isSelected = ds === selDate;
              const isPast     = d < minAllowed;
              const isToday    = d.toDateString() === today.toDateString();
              return (
                <button key={i} type="button" disabled={isPast} onClick={() => selectDay(d)}
                  className={`h-8 w-full rounded-lg text-xs font-medium transition-all ${
                    isSelected ? 'bg-gold text-gray-900 font-bold shadow-sm'
                    : isPast   ? 'text-line cursor-not-allowed'
                    : isToday  ? 'border border-gold/50 text-gold-dark hover:bg-gold-pale'
                               : 'text-text hover:bg-gold-pale hover:text-gold-dark'
                  }`}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {selDate && (
            <div ref={timeRef} className="mt-4 pt-3 border-t border-line">
              <p className="text-[10px] font-semibold text-sub uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <i className="fa-regular fa-clock text-gold-dark" />{t('dtpTimeLabel')}
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <p className="text-[10px] text-sub mb-1 text-center">{t('dtpHourLabel')}</p>
                  <div className="h-28 overflow-y-auto rounded-xl border border-line bg-bg flex flex-col" style={{ scrollbarWidth: 'thin' }}>
                    {HOURS.map((h) => (
                      <button key={h} type="button" onClick={() => changeTime(h, selMin)}
                        className={`shrink-0 py-1.5 text-sm text-center transition-colors ${
                          h === selHour ? 'bg-gold text-gray-900 font-bold' : 'text-text hover:bg-gold-pale hover:text-gold-dark'
                        }`}>
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center text-sub text-lg font-light pt-5">:</div>
                <div className="flex-1">
                  <p className="text-[10px] text-sub mb-1 text-center">{t('dtpMinLabel')}</p>
                  <div className="rounded-xl border border-line bg-bg overflow-hidden flex flex-col">
                    {MINUTES.map((m) => (
                      <button key={m} type="button" onClick={() => changeTime(selHour, m)}
                        className={`py-1.5 text-sm text-center transition-colors ${
                          m === selMin ? 'bg-gold text-gray-900 font-bold' : 'text-text hover:bg-gold-pale hover:text-gold-dark'
                        }`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)}
                className="mt-3 w-full rounded-xl bg-gold py-2 text-sm font-semibold text-gray-900 hover:bg-gold-dark transition-colors">
                {t('dtpConfirm')}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ── Modal Nouvelle demande / Modifier / Redemander ──────────────────────── */

// Convertit un ISO backend (UTC) en valeur locale "YYYY-MM-DDTHH:mm" attendue
// par DateTimePicker (même format que celui produit par son buildValue()).
function toLocalDateTimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface EditingVerif {
  id: string;
  listing: ListingOption;
  scheduledAt: string;
  preferredAgentId?: string | null;
}

function NewVerifModal({ onClose, onSent, initialListing, editingVerif }: {
  onClose: () => void;
  onSent: () => void;
  initialListing?: ListingOption | null;
  editingVerif?: EditingVerif | null;
}) {
  const { getToken } = useAuth();
  const t = useTranslations('bailleur');
  const [listings,  setListings]  = useState<ListingOption[]>([]);
  const [agents,    setAgents]    = useState<Agent[]>([]);
  const [form, setForm] = useState({
    listingId:    editingVerif?.listing.id ?? initialListing?.id ?? '',
    scheduledAt:  editingVerif ? toLocalDateTimeValue(editingVerif.scheduledAt) : '',
    preferredAgentId: editingVerif?.preferredAgentId ?? '',
  });
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [agentPickerOpen,   setAgentPickerOpen]   = useState(false);
  const [listingPickerOpen, setListingPickerOpen] = useState(false);

  // Annonce verrouillée dans les deux cas : on modifie une demande existante
  // (impossible de changer l'annonce d'une demande déjà soumise), ou on
  // redemande pour la même annonce après un refus (raccourci "Demander à
  // nouveau").
  const lockedListing = editingVerif?.listing ?? initialListing ?? null;

  useEffect(() => {
    const load = async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const [lst, agt, verifs] = await Promise.all([
          api.get<{ data: ListingOption[] }>('/listings/mine?status=ACTIVE&limit=100', token),
          api.get<Agent[]>('/auth/agents', token),
          api.get<{ listingId: string; status: string }[]>('/verifications/mine', token),
        ]);
        const excludedIds = new Set(
          (verifs ?? [])
            .filter((v) => v.status !== 'REJECTED')
            .map((v) => v.listingId)
        );
        setListings((lst.data ?? []).filter((l) => !excludedIds.has(l.id)));
        setAgents(agt ?? []);
      } catch {}
    };
    void load();
  }, [getToken]);

  const handleSubmit = async () => {
    if (!form.listingId) { setError(t('newVerifSelectListing')); return; }
    if (!form.scheduledAt) { setError(t('newVerifSelectDate')); return; }
    setLoading(true); setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error();
      if (editingVerif) {
        await api.patch(`/verifications/${editingVerif.id}`, {
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          preferredAgentId: form.preferredAgentId,
        }, token);
      } else {
        await api.post('/verifications', {
          listingId:  form.listingId,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          ...(form.preferredAgentId ? { preferredAgentId: form.preferredAgentId } : {}),
        }, token);
        // Rafraîchit le badge sidebar "AlloVérifié" — no-op si aucun crédit consommé.
        window.dispatchEvent(new CustomEvent('aa-badges-updated', { detail: { kind: 'BAILLEUR_CREDIT' } }));
      }
      onSent();
    } catch (err: unknown) {
      const msg = (err as { status?: number; message?: string })?.status === 409
        ? (err as { message?: string }).message
        : undefined;
      setError(msg ?? t('verifError'));
    }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card border border-line p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-text">
              {editingVerif ? t('editVerifTitle') : t('newVerifTitle')}
            </h2>
            <p className="text-xs text-sub mt-0.5">
              {editingVerif
                ? t('editVerifSubtitle', { title: editingVerif.listing.title })
                : initialListing ? t('newVerifAgainSubtitle', { title: initialListing.title }) : t('newVerifSubtitle')}
            </p>
          </div>
          <button onClick={onClose} className="text-sub hover:text-text transition-colors">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-sub mb-1.5">{t('newVerifListingLabel')}</label>
            {(() => {
              const locked = !!lockedListing;
              const selected = locked ? lockedListing : listings.find((l) => l.id === form.listingId);
              const thumb = selected?.images?.[0];
              return (
                <button
                  type="button"
                  onClick={() => { if (!locked) setListingPickerOpen(true); }}
                  disabled={locked}
                  className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    locked ? 'border-line bg-bg/60 cursor-not-allowed' : 'border-line bg-bg hover:border-gold-dark/40'
                  }`}
                >
                  {selected ? (
                    <>
                      <div className="relative h-8 w-8 rounded-lg overflow-hidden bg-line shrink-0">
                        {thumb ? (
                          <Image src={thumb} alt={selected.title} fill sizes="32px" className="object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <i className="fa-solid fa-house text-[10px] text-sub" />
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-medium text-text truncate flex-1">{selected.title}</span>
                    </>
                  ) : (
                    <span className="text-sm text-sub flex-1">{t('newVerifListingDefault')}</span>
                  )}
                  <i className={`fa-solid ${locked ? 'fa-lock' : 'fa-chevron-down'} text-xs text-sub shrink-0`} />
                </button>
              );
            })()}
            {lockedListing && (
              <p className="text-[10px] text-sub mt-1">{t('newVerifListingLockedNote')}</p>
            )}
          </div>

          <div className="rounded-xl border border-line bg-bg p-3">
            <p className="text-sm font-medium text-text">{t('verifAuditType')}</p>
            <p className="text-xs text-sub mt-0.5">{t('verifAuditBasicDesc')}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-sub mb-1.5">{t('verifDateLabel')}</label>
            <DateTimePicker
              value={form.scheduledAt}
              onChange={(v) => setForm((f) => ({ ...f, scheduledAt: v }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-sub mb-1.5">
              {t('verifAgentLabel')} <span className="font-normal text-sub">{t('verifAgentOptional')}</span>
            </label>
            {(() => {
              const selected = agents.find((a) => a.id === form.preferredAgentId);
              const initials = selected
                ? [selected.firstName?.[0], selected.lastName?.[0]].filter(Boolean).join('').toUpperCase()
                : '';
              return (
                <button
                  type="button"
                  onClick={() => setAgentPickerOpen(true)}
                  className="w-full flex items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2.5 text-left hover:border-gold-dark/40 transition-colors"
                >
                  {selected ? (
                    <>
                      {selected.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selected.avatar} alt={`${selected.firstName} ${selected.lastName}`} className="h-8 w-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gold-pale flex items-center justify-center text-[10px] font-bold text-gold-dark shrink-0">
                          {initials}
                        </div>
                      )}
                      <span className="text-sm font-medium text-text truncate flex-1">{selected.firstName} {selected.lastName}</span>
                    </>
                  ) : (
                    <>
                      <div className="h-8 w-8 rounded-full bg-line/60 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-shuffle text-[11px] text-sub" />
                      </div>
                      <span className="text-sm text-sub flex-1">{t('verifAgentDefault')}</span>
                    </>
                  )}
                  <i className="fa-solid fa-chevron-down text-xs text-sub shrink-0" />
                </button>
              );
            })()}
            <p className="text-[10px] text-sub mt-1">{t('verifAgentNote')}</p>
          </div>
        </div>

        {agentPickerOpen && (
          <AgentPickerModal
            agents={agents}
            selectedId={form.preferredAgentId}
            onSelect={(id) => setForm((f) => ({ ...f, preferredAgentId: id }))}
            onClose={() => setAgentPickerOpen(false)}
          />
        )}

        {listingPickerOpen && (
          <ListingPickerModal
            listings={listings}
            selectedId={form.listingId}
            onSelect={(id) => setForm((f) => ({ ...f, listingId: id }))}
            onClose={() => setListingPickerOpen(false)}
          />
        )}

        {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose}
            className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors">
            {t('cancel')}
          </button>
          <button onClick={() => void handleSubmit()} disabled={!form.listingId || !form.scheduledAt || loading}
            className="btn-gold text-sm rounded-xl px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <i className="fa-solid fa-spinner fa-spin" /> : (editingVerif ? t('editVerifSubmit') : t('verifSubmit'))}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Sous-modal : sélection d'un agent préféré (recherche + pagination) ──── */

const AGENT_PICKER_PER_PAGE = 6;

function AgentPickerModal({
  agents, selectedId, onSelect, onClose,
}: {
  agents: Agent[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('bailleur');
  const [search, setSearch] = useState('');
  const [page,   setPage]   = useState(1);

  const q = search.trim().toLowerCase();
  const filtered = agents.filter((a) => {
    if (!q) return true;
    const name = `${a.firstName} ${a.lastName}`.toLowerCase();
    const zone = (a.coverageZone ?? '').toLowerCase();
    return name.includes(q) || zone.includes(q);
  });
  const pageCount   = Math.max(1, Math.ceil(filtered.length / AGENT_PICKER_PER_PAGE));
  const clampedPage = Math.min(page, pageCount);
  const visible      = filtered.slice((clampedPage - 1) * AGENT_PICKER_PER_PAGE, clampedPage * AGENT_PICKER_PER_PAGE);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination suite à une recherche
  useEffect(() => { setPage(1); }, [search]);

  const choose = (id: string) => { onSelect(id); onClose(); };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-card border border-line p-6 shadow-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4 shrink-0">
          <h3 className="text-base font-semibold text-text">{t('verifAgentPickerTitle')}</h3>
          <button onClick={onClose} className="text-sub hover:text-text transition-colors">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="relative mb-4 shrink-0">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-sub text-sm pointer-events-none" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('verifAgentSearchPlaceholder')}
            className="w-full rounded-xl border border-line bg-bg pl-10 pr-10 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-1 focus:ring-gold-dark transition"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sub hover:text-text">
              <i className="fa-solid fa-xmark text-sm" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {!q && clampedPage === 1 && (
              <button
                type="button"
                onClick={() => choose('')}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  selectedId === '' ? 'border-gold-dark bg-gold-pale/30 dark:bg-gold-dark/10' : 'border-line bg-bg hover:border-gold-dark/40'
                }`}
              >
                <div className="h-10 w-10 rounded-full bg-line/60 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-shuffle text-sm text-sub" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text">{t('verifAgentDefault')}</p>
                  <p className="text-[11px] text-sub truncate">{t('verifAgentNote')}</p>
                </div>
                {selectedId === '' && <i className="fa-solid fa-circle-check text-gold-dark text-sm shrink-0 ml-auto" />}
              </button>
            )}

            {visible.map((a) => {
              const initials = [a.firstName?.[0], a.lastName?.[0]].filter(Boolean).join('').toUpperCase();
              const active = selectedId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => choose(a.id)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    active ? 'border-gold-dark bg-gold-pale/30 dark:bg-gold-dark/10' : 'border-line bg-bg hover:border-gold-dark/40'
                  }`}
                >
                  {a.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.avatar} alt={`${a.firstName} ${a.lastName}`} className="h-10 w-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gold-pale flex items-center justify-center text-xs font-bold text-gold-dark shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text truncate">{a.firstName} {a.lastName}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      {a.completedMissions > 0 && (
                        <span className="text-[11px] text-sub">{t('newVerifMissions', { count: a.completedMissions })}</span>
                      )}
                      {a.coverageZone && (
                        <span className="text-[11px] text-sub flex items-center gap-1">
                          <i className="fa-solid fa-location-dot text-[9px]" /> {a.coverageZone}
                        </span>
                      )}
                    </div>
                  </div>
                  {active && <i className="fa-solid fa-circle-check text-gold-dark text-sm shrink-0" />}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <i className="fa-solid fa-magnifying-glass text-2xl text-line mb-2" />
              <p className="text-sm text-sub">{t('noResultsFor', { search })}</p>
              <button onClick={() => setSearch('')} className="text-xs text-gold-dark hover:underline mt-1">{t('clearSearch')}</button>
            </div>
          )}
        </div>

        <div className="shrink-0">
          <BookingPagination
            page={clampedPage} pageCount={pageCount} onPageChange={setPage}
            previousLabel={t('previous')} nextLabel={t('next')}
            pageOfLabel={t('pageOf', { page: clampedPage, total: pageCount })}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Sous-modal : sélection de l'annonce à vérifier (recherche + pagination) */

const LISTING_PICKER_PER_PAGE = 6;

function ListingPickerModal({
  listings, selectedId, onSelect, onClose,
}: {
  listings: ListingOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('bailleur');
  const [search, setSearch] = useState('');
  const [page,   setPage]   = useState(1);

  const q = search.trim().toLowerCase();
  const filtered = listings.filter((l) => {
    if (!q) return true;
    return l.title.toLowerCase().includes(q) || (l.city ?? '').toLowerCase().includes(q);
  });
  const pageCount   = Math.max(1, Math.ceil(filtered.length / LISTING_PICKER_PER_PAGE));
  const clampedPage = Math.min(page, pageCount);
  const visible      = filtered.slice((clampedPage - 1) * LISTING_PICKER_PER_PAGE, clampedPage * LISTING_PICKER_PER_PAGE);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination suite à une recherche
  useEffect(() => { setPage(1); }, [search]);

  const choose = (id: string) => { onSelect(id); onClose(); };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-card border border-line p-6 shadow-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4 shrink-0">
          <h3 className="text-base font-semibold text-text">{t('newVerifListingPickerTitle')}</h3>
          <button onClick={onClose} className="text-sub hover:text-text transition-colors">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="relative mb-4 shrink-0">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-sub text-sm pointer-events-none" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('newVerifListingSearchPlaceholder')}
            className="w-full rounded-xl border border-line bg-bg pl-10 pr-10 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-1 focus:ring-gold-dark transition"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sub hover:text-text">
              <i className="fa-solid fa-xmark text-sm" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visible.map((l) => {
              const active = selectedId === l.id;
              const thumb = l.images?.[0];
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => choose(l.id)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    active ? 'border-gold-dark bg-gold-pale/30 dark:bg-gold-dark/10' : 'border-line bg-bg hover:border-gold-dark/40'
                  }`}
                >
                  <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-line shrink-0">
                    {thumb ? (
                      <Image src={thumb} alt={l.title} fill sizes="40px" className="object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <i className="fa-solid fa-house text-xs text-sub" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text truncate">{l.title}</p>
                    {l.city && (
                      <span className="text-[11px] text-sub flex items-center gap-1 mt-0.5">
                        <i className="fa-solid fa-location-dot text-[9px]" /> {l.city}
                      </span>
                    )}
                  </div>
                  {active && <i className="fa-solid fa-circle-check text-gold-dark text-sm shrink-0" />}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <i className="fa-solid fa-magnifying-glass text-2xl text-line mb-2" />
              <p className="text-sm text-sub">{t('noResultsFor', { search })}</p>
              <button onClick={() => setSearch('')} className="text-xs text-gold-dark hover:underline mt-1">{t('clearSearch')}</button>
            </div>
          )}
        </div>

        <div className="shrink-0">
          <BookingPagination
            page={clampedPage} pageCount={pageCount} onPageChange={setPage}
            previousLabel={t('previous')} nextLabel={t('next')}
            pageOfLabel={t('pageOf', { page: clampedPage, total: pageCount })}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Tab: Mes demandes ───────────────────────────────────────────────────── */

function MesDemandesTab({
  verifs, loading, onRatingSaved, isProActive, onRequestAgain, onEdit, onCancelled,
}: {
  verifs: VerifWithRating[];
  loading: boolean;
  onRatingSaved: (verifId: string, saved: AgentRating) => void;
  isProActive: boolean;
  onRequestAgain: (listing: ListingOption) => void;
  onEdit: (v: VerifWithRating) => void;
  onCancelled: () => void;
}) {
  const t = useTranslations('bailleur');
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [ratingModal, setRatingModal] = useState<{ verifId: string; agentName: string; existing?: AgentRating | null } | null>(null);
  const [subFilter, setSubFilter] = useState<DemandesFilter>('ALL');
  const [search,    setSearch]    = useState('');
  const [page,      setPage]      = useState(1);
  const [perPage,   setPerPage]   = useState<typeof PER_PAGE_OPTIONS[number]>(6);

  const active   = verifs.filter((v) => !['DONE', 'REJECTED'].includes(v.status));
  const archived = verifs.filter((v) =>  ['DONE', 'REJECTED'].includes(v.status));

  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination suite à un changement de filtre/recherche
  useEffect(() => { setPage(1); }, [subFilter, search, perPage]);

  const base = subFilter === 'ACTIVE' ? active : subFilter === 'HISTORY' ? archived : verifs;
  const q = search.trim().toLowerCase();
  const filtered = base.filter((v) =>
    !q || (v.listing?.title ?? '').toLowerCase().includes(q) || (v.listing?.city ?? '').toLowerCase().includes(q));
  const pageCount    = Math.max(1, Math.ceil(filtered.length / perPage));
  const clampedPage  = Math.min(page, pageCount);
  const visible       = filtered.slice((clampedPage - 1) * perPage, clampedPage * perPage);

  const handleRatingSaved = (verifId: string, saved: AgentRating) => {
    onRatingSaved(verifId, saved);
    setRatingModal(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-line bg-card p-5 animate-pulse">
            <div className="h-4 bg-line rounded w-1/3 mb-3" />
            <div className="h-3 bg-line rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (verifs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-line bg-card">
        <div className="h-16 w-16 rounded-2xl bg-gold-pale flex items-center justify-center mb-4">
          <i className="fa-solid fa-shield-halved text-3xl text-gold-dark" />
        </div>
        <h2 className="text-lg font-bold text-text mb-1">{t('verifEmpty')}</h2>
        <p className="text-sm text-sub max-w-xs mb-5">{t('verifEmptyHint')}</p>
        <Link href="/bailleur/listings" className="btn-gold rounded-full px-6 py-2.5 text-sm">
          {t('verifRequestBtn')}
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Sous-filtre par statut — même pattern StatFilterCard que bailleur/bookings */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <StatFilterCard
          icon="fa-layer-group"
          label={t('verifFilterAll')}
          value={verifs.length}
          color="text-gold-dark"
          bg="bg-gold-pale/40 dark:bg-gold-dark/10"
          active={subFilter === 'ALL'}
          onClick={() => setSubFilter('ALL')}
          selectedLabel={t('filterSelected')}
        />
        <StatFilterCard
          icon="fa-clock"
          label={t('verifFilterActive')}
          value={active.length}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-50 dark:bg-blue-950/30"
          active={subFilter === 'ACTIVE'}
          onClick={() => setSubFilter('ACTIVE')}
          selectedLabel={t('filterSelected')}
        />
        <StatFilterCard
          icon="fa-box-archive"
          label={t('verifFilterHistory')}
          value={archived.length}
          color="text-sub"
          bg="bg-card"
          active={subFilter === 'HISTORY'}
          onClick={() => setSubFilter('HISTORY')}
          selectedLabel={t('filterSelected')}
        />
      </div>

      {/* Recherche + lignes par page */}
      <BookingSearchRow
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('verifSearchPlaceholder')}
        perPage={perPage}
        onPerPageChange={(n) => setPerPage(n as typeof PER_PAGE_OPTIONS[number])}
        perPageOptions={PER_PAGE_OPTIONS}
        rowsLabel={t('rowsLabel')}
      />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-sub">{q ? t('noResultsFor', { search }) : t('verifFilterEmpty')}</p>
          {q && (
            <button onClick={() => setSearch('')} className="mt-3 text-sm text-gold-dark hover:underline">
              {t('clearSearch')}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((v) => (
            <VerifCard key={v.id} v={v} expanded={expanded === v.id} isProActive={isProActive}
              onToggle={() => setExpanded(expanded === v.id ? null : v.id)}
              onRate={() => setRatingModal({ verifId: v.id, agentName: v.agent ? `${v.agent.firstName} ${v.agent.lastName}` : '', existing: v.rating })}
              onRequestAgain={onRequestAgain}
              onEdit={onEdit}
              onCancelled={onCancelled}
            />
          ))}
        </div>
      )}

      <BookingPagination
        page={clampedPage}
        pageCount={pageCount}
        onPageChange={setPage}
        previousLabel={t('previous')}
        nextLabel={t('next')}
        pageOfLabel={t('pageOf', { page: clampedPage, total: pageCount })}
      />

      {ratingModal && (
        <RatingModal
          verifId={ratingModal.verifId}
          agentName={ratingModal.agentName}
          existing={ratingModal.existing}
          onClose={() => setRatingModal(null)}
          onSaved={(saved) => handleRatingSaved(ratingModal.verifId, saved)}
        />
      )}
    </>
  );
}

/* ── Page principale ─────────────────────────────────────────────────────── */

function VerificationsPageContent() {
  const { getToken }  = useAuth();
  const t = useTranslations('bailleur');
  const [newVerifOpen,  setNewVerifOpen]  = useState(false);
  // Pré-remplissage pour le raccourci "Demander à nouveau" (demande rejetée,
  // encore éligible à une redemande gratuite) — annonce verrouillée dans le
  // modal, seuls date/heure et agent préféré restent modifiables.
  const [prefillListing, setPrefillListing] = useState<ListingOption | null>(null);
  // Édition d'une demande existante (statut REQUESTED) — annonce verrouillée
  // dans le modal, seuls date/heure et agent préféré restent modifiables.
  const [editingVerif, setEditingVerif] = useState<EditingVerif | null>(null);

  const [verifs,        setVerifs]        = useState<VerifWithRating[]>([]);
  const [verifsLoading, setVerifsLoading] = useState(true);
  // Abonnement PRO actif = AlloVérifié gratuit et illimité (cf. isProActive()
  // backend) — détermine si la note "aucun paiement nécessaire" sur une
  // demande refusée doit préciser qu'un paiement sera requis la prochaine
  // fois (non-PRO, crédit ponctuel) ou que c'est gratuit à chaque fois (PRO).
  // /subscriptions/me est réservé PRO_AGENCE/ADMIN : un simple BAILLEUR reçoit
  // un 403, traité ici comme "pas PRO" (même schéma défensif que ailleurs).
  const [isProActive, setIsProActive] = useState(false);

  useEffect(() => {
    void getToken().then((token) => {
      if (!token) return;
      api.get<{ plan: string; status: string }>('/subscriptions/me', token)
        .then((sub) => setIsProActive(sub?.plan === 'PRO' && sub?.status === 'ACTIVE'))
        .catch(() => setIsProActive(false));
    });
  }, [getToken]);

  const fetchVerifs = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.get<VerifWithRating[]>('/verifications/mine', token);
      setVerifs(data);
    } catch {} finally { setVerifsLoading(false); }
  }, [getToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch initial, setState après résolution async
  useEffect(() => { void fetchVerifs(); }, [fetchVerifs]);

  // Rafraîchissement automatique en arrière-plan — pas de bouton "Actualiser"
  // volontairement : le statut (agent assigné, visite en cours, certifié...)
  // peut changer côté agent/admin à tout moment, l'utilisateur doit le voir
  // sans action. Silencieux (fetchVerifs ne repasse pas loading à true) et
  // suspendu si l'onglet n'est pas visible pour ne pas spammer l'API.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void fetchVerifs();
    }, 15_000);
    return () => clearInterval(interval);
  }, [fetchVerifs]);

  const handleRatingSaved = (verifId: string, saved: AgentRating) => {
    setVerifs((prev) => prev.map((v) => v.id === verifId ? { ...v, rating: saved } : v));
  };

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text flex items-center gap-2">
            <i className="fa-solid fa-shield-halved text-gold-dark" />
            {t('verificationsPageTitle')}
          </h1>
          <p className="text-sm text-sub mt-0.5">{t('verificationsPageSub')}</p>
        </div>
        <button onClick={() => { setPrefillListing(null); setEditingVerif(null); setNewVerifOpen(true); }} className="btn-gold text-sm flex items-center gap-2 rounded-full px-4 py-2 shrink-0">
          <i className="fa-solid fa-plus text-xs" />{t('verificationsNewRequest')}
        </button>
      </div>

      <MesDemandesTab
        verifs={verifs} loading={verifsLoading} onRatingSaved={handleRatingSaved} isProActive={isProActive}
        onRequestAgain={(listing) => { setPrefillListing(listing); setEditingVerif(null); setNewVerifOpen(true); }}
        onEdit={(v) => {
          if (!v.listing) return;
          setEditingVerif({
            id: v.id,
            listing: { id: v.listingId, title: v.listing.title, city: v.listing.city, images: v.listing.images },
            scheduledAt: v.scheduledAt,
            preferredAgentId: v.preferredAgentId,
          });
          setPrefillListing(null);
          setNewVerifOpen(true);
        }}
        onCancelled={() => void fetchVerifs()}
      />

      {newVerifOpen && (
        <NewVerifModal
          initialListing={prefillListing}
          editingVerif={editingVerif}
          onClose={() => { setNewVerifOpen(false); setPrefillListing(null); setEditingVerif(null); }}
          onSent={() => {
            setNewVerifOpen(false);
            setPrefillListing(null);
            setEditingVerif(null);
            void fetchVerifs();
          }}
        />
      )}
    </div>
  );
}

export default function BailleurVerificationsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-line bg-card p-5 animate-pulse">
            <div className="h-4 bg-line rounded w-1/3 mb-3" />
            <div className="h-3 bg-line rounded w-1/2" />
          </div>
        ))}
      </div>
    }>
      <VerificationsPageContent />
    </Suspense>
  );
}
