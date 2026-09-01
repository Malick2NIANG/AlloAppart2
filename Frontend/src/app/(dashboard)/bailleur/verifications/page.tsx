'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import type { Verification, VerifStatus } from '@/types';

interface AgentOption { id: string; firstName: string; lastName: string; completedMissions: number; }
interface ListingOption { id: string; title: string; }

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
}

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  bio: string | null;
  phone: string | null;
  completedMissions: number;
}

/* ── Visual config (no text) ─────────────────────────────────────────────── */

const VERIF_STYLE: Record<VerifStatus, { color: string; icon: string; bg: string }> = {
  REQUESTED:       { color: 'text-amber-600',   icon: 'fa-clock',           bg: 'bg-amber-50'   },
  SCHEDULED:       { color: 'text-blue-600',    icon: 'fa-calendar-check',  bg: 'bg-blue-50'    },
  IN_PROGRESS:     { color: 'text-purple-600',  icon: 'fa-person-walking',  bg: 'bg-purple-50'  },
  DONE:            { color: 'text-emerald-600', icon: 'fa-shield-check',    bg: 'bg-emerald-50' },
  REJECTED:        { color: 'text-red-600',     icon: 'fa-circle-xmark',    bg: 'bg-red-50'     },
  DECLINE_PENDING: { color: 'text-orange-600',  icon: 'fa-hourglass-half',  bg: 'bg-orange-50'  },
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
        <span className="text-xs text-red-600 font-medium">{t('verifRejected')}</span>
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
                      : 'bg-emerald-100 text-emerald-600'
                    : 'bg-line text-sub'
                }`}>
                  <i className={`fa-solid ${done ? (active ? style.icon : 'fa-check') : style.icon} text-[10px]`} />
                </div>
                <p className={`mt-1 text-[9px] text-center leading-tight max-w-[56px] ${done ? (active ? style.color + ' font-semibold' : 'text-emerald-600') : 'text-sub'}`}>
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
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
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

function VerifCard({ v, expanded, onToggle, onRate }: {
  v: VerifWithRating; expanded: boolean; onToggle: () => void; onRate: () => void;
}) {
  const t = useTranslations('bailleur');
  const locale = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';
  const style = VERIF_STYLE[v.status];
  const { getToken } = useAuth();
  const router = useRouter();
  const [openingChat, setOpeningChat] = useState(false);

  const STATUS_LABELS: Record<VerifStatus, string> = {
    REQUESTED:       t('verifStatusRequested'),
    SCHEDULED:       t('verifStatusScheduled'),
    IN_PROGRESS:     t('verifStatusInProgress'),
    DONE:            t('verifStatusDone'),
    REJECTED:        t('verifStatusRejected'),
    DECLINE_PENDING: t('verifStatusDeclinePending'),
  };

  const AUDIT_LABELS: Record<string, string> = {
    BASIC: t('verifAuditLabelBasic'),
    FULL:  t('verifAuditLabelFull'),
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
        <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${style.bg}`}>
          <i className={`fa-solid ${style.icon} ${style.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="font-semibold text-text text-sm truncate">{v.listing?.title ?? t('verifDefaultListing')}</p>
            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.color}`}>
              {STATUS_LABELS[v.status]}
            </span>
            {v.rating && (
              <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                <i className="fa-solid fa-star text-amber-400 text-[9px]" />{v.rating.rating}/5
              </span>
            )}
          </div>
          <p className="text-xs text-sub">{AUDIT_LABELS[v.auditType] ?? v.auditType}{v.listing?.city ? ` · ${v.listing.city}` : ''}</p>
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
              <div className={`mt-4 rounded-xl border p-4 ${isScheduled ? 'border-blue-200 bg-blue-50' : 'border-line bg-bg'}`}>
                {isScheduled && (
                  <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-2">
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
                        <a href={`tel:${agent.phone}`} className="text-xs text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1">
                          <i className="fa-solid fa-phone text-[9px]" />{agent.phone}
                        </a>
                        <button
                          type="button"
                          onClick={() => void openAgentChat(agent.id)}
                          disabled={openingChat}
                          className="text-xs text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1 disabled:opacity-50"
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
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5">
                <i className="fa-solid fa-shield-check text-emerald-500" />
                <p className="text-sm font-semibold text-emerald-700">{t('verifCertifiedBadge')}</p>
              </div>
              {v.notes && (
                <div className="rounded-xl bg-bg p-3">
                  <p className="text-[10px] font-semibold text-sub uppercase tracking-wide mb-1">{t('verifAgentNotes')}</p>
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
                  <p className="text-[10px] font-semibold text-sub uppercase tracking-wide mb-2">{t('verifPhotosLabel', { count: v.photos.length })}</p>
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
                        <p className="text-[10px] font-semibold text-sub uppercase tracking-wide">{t('verifYourReview')}</p>
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
                        className="shrink-0 flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
                        <i className="fa-solid fa-star text-amber-400 text-[10px]" />{t('verifLeaveReview')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {v.status === 'REJECTED' && v.notes && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-1">{t('verifRejectionReason')}</p>
              <p className="text-sm text-red-700">{v.notes}</p>
            </div>
          )}

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

/* ── AgentCard ───────────────────────────────────────────────────────────── */

function AgentCard({ agent }: { agent: Agent }) {
  const t = useTranslations('bailleur');
  const initials = [agent.firstName?.[0], agent.lastName?.[0]].filter(Boolean).join('').toUpperCase();
  return (
    <div className="bg-card rounded-2xl border border-line shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        {agent.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agent.avatar} alt={`${agent.firstName} ${agent.lastName}`}
            className="h-14 w-14 rounded-full object-cover border border-line flex-shrink-0" />
        ) : (
          <div className="h-14 w-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-semibold text-gold">{initials}</span>
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-text text-base leading-snug truncate">{agent.firstName} {agent.lastName}</p>
          <p className="text-xs text-sub mt-0.5">{t('agentVerifiedBadge')}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
          <p className="text-xl font-bold text-emerald-600">{agent.completedMissions}</p>
          <p className="text-[10px] text-emerald-700 mt-0.5 leading-tight">
            {t('agentMission', { count: agent.completedMissions })}
          </p>
        </div>
        <div className="flex-1 bg-gold/5 rounded-xl p-3 text-center border border-gold/20">
          <p className="text-xl font-bold text-gold"><i className="fa-solid fa-shield-halved text-lg" /></p>
          <p className="text-[10px] text-amber-700 mt-0.5 leading-tight">{t('agentCertified')}</p>
        </div>
      </div>

      {agent.bio && <p className="text-xs text-sub leading-relaxed line-clamp-3">{agent.bio}</p>}

      {agent.phone && (
        <a href={`tel:${agent.phone}`} className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 transition-colors">
          <i className="fa-solid fa-phone text-[10px]" />{agent.phone}
        </a>
      )}

      <div className="mt-auto pt-3 border-t border-line flex items-center justify-between gap-2">
        {agent.completedMissions >= 10 ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
            <i className="fa-solid fa-star text-[9px] text-amber-500" />{t('agentExperienced')}
          </span>
        ) : agent.completedMissions >= 3 ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1">
            <i className="fa-solid fa-circle-check text-[9px] text-blue-500" />{t('agentActiveLabel')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
            <i className="fa-solid fa-seedling text-[9px] text-emerald-500" />{t('agentNew')}
          </span>
        )}
        <Link href={`/bailleur/agents/${agent.id}`}
          className="text-[11px] text-gold-dark hover:underline flex items-center gap-1 shrink-0">
          {t('agentViewProfile')} <i className="fa-solid fa-arrow-right text-[9px]" />
        </Link>
      </div>
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

/* ── Modal Nouvelle demande ──────────────────────────────────────────────── */

function NewVerifModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const { getToken } = useAuth();
  const t = useTranslations('bailleur');
  const [listings,  setListings]  = useState<ListingOption[]>([]);
  const [agents,    setAgents]    = useState<AgentOption[]>([]);
  const [form, setForm] = useState({ listingId: '', auditType: 'BASIC', scheduledAt: '', preferredAgentId: '' });
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    const load = async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const [lst, agt, verifs] = await Promise.all([
          api.get<{ data: ListingOption[] }>('/listings/mine?status=ACTIVE&limit=100', token),
          api.get<AgentOption[]>('/auth/agents', token),
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
      await api.post('/verifications', {
        listingId:  form.listingId,
        auditType:  form.auditType,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        ...(form.preferredAgentId ? { preferredAgentId: form.preferredAgentId } : {}),
      }, token);
      onSent();
    } catch { setError(t('verifError')); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card border border-line p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-text">{t('newVerifTitle')}</h2>
            <p className="text-xs text-sub mt-0.5">{t('newVerifSubtitle')}</p>
          </div>
          <button onClick={onClose} className="text-sub hover:text-text transition-colors">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-sub mb-1.5">{t('newVerifListingLabel')}</label>
            <select value={form.listingId}
              onChange={(e) => setForm((f) => ({ ...f, listingId: e.target.value }))}
              className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-gold-dark">
              <option value="">{t('newVerifListingDefault')}</option>
              {listings.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-sub mb-1.5">{t('verifAuditType')}</label>
            <div className="flex gap-3">
              {[
                { value: 'BASIC', label: t('verifAuditBasic'), desc: t('verifAuditBasicDesc') },
                { value: 'FULL',  label: t('verifAuditFull'),  desc: t('verifAuditFullDesc')  },
              ].map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => setForm((f) => ({ ...f, auditType: opt.value }))}
                  className={`flex-1 rounded-xl border p-3 text-left transition-colors ${
                    form.auditType === opt.value ? 'border-gold-dark bg-gold-pale' : 'border-line bg-bg hover:border-gold-dark'
                  }`}>
                  <p className={`text-sm font-medium ${form.auditType === opt.value ? 'text-gold-dark' : 'text-text'}`}>{opt.label}</p>
                  <p className="text-xs text-sub mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
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
            <select value={form.preferredAgentId}
              onChange={(e) => setForm((f) => ({ ...f, preferredAgentId: e.target.value }))}
              className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-gold-dark">
              <option value="">{t('verifAgentDefault')}</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.firstName} {a.lastName}
                  {a.completedMissions > 0 ? ` · ${t('newVerifMissions', { count: a.completedMissions })}` : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-sub mt-1">{t('verifAgentNote')}</p>
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose}
            className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors">
            {t('cancel')}
          </button>
          <button onClick={() => void handleSubmit()} disabled={!form.listingId || !form.scheduledAt || loading}
            className="btn-gold text-sm rounded-xl px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <i className="fa-solid fa-spinner fa-spin" /> : t('verifSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Tab: Mes demandes ───────────────────────────────────────────────────── */

function MesDemandesTab() {
  const { getToken } = useAuth();
  const t = useTranslations('bailleur');
  const [verifs,      setVerifs]      = useState<VerifWithRating[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [ratingModal, setRatingModal] = useState<{ verifId: string; agentName: string; existing?: AgentRating | null } | null>(null);

  const fetchVerifs = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.get<VerifWithRating[]>('/verifications/mine', token);
      setVerifs(data);
    } catch {} finally { setLoading(false); }
  }, [getToken]);

  useEffect(() => { void fetchVerifs(); }, [fetchVerifs]);

  const handleRatingSaved = (verifId: string, saved: AgentRating) => {
    setVerifs((prev) => prev.map((v) => v.id === verifId ? { ...v, rating: saved } : v));
    setRatingModal(null);
  };

  const active   = verifs.filter((v) => !['DONE', 'REJECTED'].includes(v.status));
  const archived = verifs.filter((v) =>  ['DONE', 'REJECTED'].includes(v.status));

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
      <div className="space-y-6">
        {active.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-sub uppercase tracking-widest mb-3">
              {t('verifSectionActive', { count: active.length })}
            </h2>
            <div className="flex flex-col gap-3">
              {active.map((v) => (
                <VerifCard key={v.id} v={v} expanded={expanded === v.id}
                  onToggle={() => setExpanded(expanded === v.id ? null : v.id)}
                  onRate={() => setRatingModal({ verifId: v.id, agentName: v.agent ? `${v.agent.firstName} ${v.agent.lastName}` : '', existing: v.rating })}
                />
              ))}
            </div>
          </section>
        )}
        {archived.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-sub uppercase tracking-widest mb-3">
              {t('verifSectionHistory', { count: archived.length })}
            </h2>
            <div className="flex flex-col gap-3">
              {archived.map((v) => (
                <VerifCard key={v.id} v={v} expanded={expanded === v.id}
                  onToggle={() => setExpanded(expanded === v.id ? null : v.id)}
                  onRate={() => setRatingModal({ verifId: v.id, agentName: v.agent ? `${v.agent.firstName} ${v.agent.lastName}` : '', existing: v.rating })}
                />
              ))}
            </div>
          </section>
        )}
      </div>

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

/* ── Tab: Nos agents ─────────────────────────────────────────────────────── */

function NosAgentsTab() {
  const { getToken } = useAuth();
  const t = useTranslations('bailleur');
  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.get<Agent[]>('/auth/agents', token);
      setAgents(data);
    } catch {} finally { setLoading(false); }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const filtered = agents.filter((a) => {
    const q = search.toLowerCase();
    return !q || a.firstName.toLowerCase().includes(q) || a.lastName.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-sub text-xs" />
          <input type="text" placeholder={t('verifAgentsSearchPlaceholder')} value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-line rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-gold/30 text-text placeholder:text-sub" />
        </div>
        {agents.length > 0 && (
          <p className="text-xs text-sub shrink-0">{t('verifAgentsCount', { count: filtered.length })}</p>
        )}
      </div>

      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <i className="fa-solid fa-circle-info text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 leading-relaxed">{t('verifAgentsInfoNote')}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-2xl border border-line p-5 animate-pulse space-y-4">
              <div className="flex gap-3 items-center">
                <div className="h-14 w-14 rounded-full bg-line" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-line rounded w-3/4" />
                  <div className="h-3 bg-line rounded w-1/2" />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 h-16 bg-line rounded-xl" />
                <div className="flex-1 h-16 bg-line rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <i className="fa-solid fa-user-slash text-4xl text-line mb-4" />
          <p className="text-sub text-sm">
            {search ? t('agentNoResults') : t('agentNone')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
        </div>
      )}
    </div>
  );
}

/* ── Page principale ─────────────────────────────────────────────────────── */

type Tab = 'demandes' | 'agents';

function VerificationsPageContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const t = useTranslations('bailleur');
  const activeTab    = (searchParams.get('tab') as Tab) ?? 'demandes';
  const [newVerifOpen,  setNewVerifOpen]  = useState(false);
  const [demandesKey,   setDemandesKey]   = useState(0);

  const setTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/bailleur/verifications?${params.toString()}`);
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'demandes', label: t('tabMyRequests'), icon: 'fa-shield-halved' },
    { key: 'agents',   label: t('tabAgents'),     icon: 'fa-user-shield'   },
  ];

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
        <button onClick={() => setNewVerifOpen(true)} className="btn-gold text-sm flex items-center gap-2 rounded-full px-4 py-2 shrink-0">
          <i className="fa-solid fa-plus text-xs" />{t('verificationsNewRequest')}
        </button>
      </div>

      <div className="flex gap-1 rounded-xl bg-card border border-line p-1 w-fit">
        {TABS.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === key
                ? 'bg-card shadow-sm text-text border border-line'
                : 'text-sub hover:text-text'
            }`}>
            <i className={`fa-solid ${icon} text-xs ${activeTab === key ? 'text-gold-dark' : ''}`} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'demandes' ? <MesDemandesTab key={demandesKey} /> : <NosAgentsTab />}

      {newVerifOpen && (
        <NewVerifModal
          onClose={() => setNewVerifOpen(false)}
          onSent={() => {
            setNewVerifOpen(false);
            setTab('demandes');
            setDemandesKey((k) => k + 1);
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
