'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import type { Verification } from '@/types';

type ViewMode = 'month' | 'week';

const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  REQUESTED:      { bg: 'bg-blue-50',    text: 'text-blue-600',   dot: 'bg-blue-500' },
  SCHEDULED:      { bg: 'bg-gold-pale',  text: 'text-gold-dark',  dot: 'bg-gold' },
  IN_PROGRESS:    { bg: 'bg-purple-50',  text: 'text-purple-600', dot: 'bg-purple-500' },
  DONE:           { bg: 'bg-emerald-50', text: 'text-emerald-600',dot: 'bg-emerald-500' },
  REJECTED:       { bg: 'bg-red-50',     text: 'text-red-600',    dot: 'bg-red-500' },
  DECLINE_PENDING:{ bg: 'bg-amber-50',   text: 'text-amber-600',  dot: 'bg-amber-500' },
};

function startOfWeek(d: Date) {
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  const r = new Date(d);
  r.setDate(d.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function AgentCalendrierPage() {
  const { getToken } = useAuth();
  const t = useTranslations('agent');
  const locale = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';

  const [missions, setMissions] = useState<Verification[]>([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<ViewMode>('month');
  const [cursor, setCursor]     = useState(new Date());       // month pointer
  const [weekBase, setWeekBase] = useState(() => startOfWeek(new Date())); // week pointer
  const [selected, setSelected] = useState<Date | null>(null);
  const toastRef = useRef(console.error);

  /* Locale-aware day / month names — Monday-first */
  const DAYS = useMemo(
    () => Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(numLocale, { weekday: 'short' }).format(new Date(2024, 0, 1 + i)),
    ),
    [numLocale],
  );
  const MONTHS = useMemo(
    () => Array.from({ length: 12 }, (_, i) =>
      new Intl.DateTimeFormat(numLocale, { month: 'long' }).format(new Date(2024, i, 1)),
    ),
    [numLocale],
  );

  const STATUS_LABEL: Record<string, string> = useMemo(() => ({
    REQUESTED:       t('statusRequested'),
    SCHEDULED:       t('statusScheduled'),
    IN_PROGRESS:     t('statusInProgress'),
    DONE:            t('statusDone'),
    REJECTED:        t('statusRejected'),
    DECLINE_PENDING: t('statusDeclinePending'),
  }), [t]);

  const fmtTime = useCallback(
    (d: string) => new Date(d).toLocaleTimeString(numLocale, { hour: '2-digit', minute: '2-digit' }),
    [numLocale],
  );

  const load = useCallback(async () => {
    const token = await getToken().catch(() => null);
    if (!token) return;
    try {
      const data = await api.get<Verification[]>('/verifications/all-mine', token);
      setMissions(data);
    } catch (e) { toastRef.current(e); }
    finally { setLoading(false); }
  }, [getToken]);

  useEffect(() => { void load(); }, [load]);

  // ── Mission lookup helpers ─────────────────────────────────────────────────
  const missionsOn = (d: Date) =>
    missions.filter((m) => isSameDay(new Date(m.scheduledAt), d));

  const selectedMissions = selected ? missionsOn(selected) : [];

  // ─── Month view grid ───────────────────────────────────────────────────────
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const firstDow = firstOfMonth.getDay(); // 0=Sun
  const gridStart = new Date(firstOfMonth);
  const offset = firstDow === 0 ? 6 : firstDow - 1;
  gridStart.setDate(1 - offset);

  const monthCells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    monthCells.push(d);
  }

  // ─── Week view ─────────────────────────────────────────────────────────────
  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekBase);
    d.setDate(weekBase.getDate() + i);
    return d;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ─── Legend ────────────────────────────────────────────────────────────────
  const legendStatuses = ['SCHEDULED','IN_PROGRESS','DONE','REJECTED'];

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-extrabold text-text">
          <i className="fa-regular fa-calendar-days text-gold-dark mr-2" />
          {t('calendarTitle')}
        </h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-xl border border-line overflow-hidden">
            {(['month','week'] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-1.5 text-xs font-semibold transition-colors ${
                  view === v ? 'bg-gold-dark text-white' : 'text-sub hover:bg-bg'
                }`}>
                {v === 'month' ? t('viewMonth') : t('viewWeek')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {legendStatuses.map((s) => (
          <div key={s} className="flex items-center gap-1.5 text-[11px] text-sub">
            <div className={`h-2 w-2 rounded-full ${STATUS_COLOR[s]?.dot ?? 'bg-sub'}`} />
            {STATUS_LABEL[s]}
          </div>
        ))}
      </div>

      {/* ── Month view ── */}
      {view === 'month' && (
        <div className="rounded-2xl border border-line bg-card overflow-hidden">
          {/* Nav */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-line">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="h-8 w-8 rounded-lg hover:bg-bg flex items-center justify-center text-sub transition-colors">
              <i className="fa-solid fa-chevron-left text-xs" />
            </button>
            <p className="font-bold text-text">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </p>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="h-8 w-8 rounded-lg hover:bg-bg flex items-center justify-center text-sub transition-colors">
              <i className="fa-solid fa-chevron-right text-xs" />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 border-b border-line">
            {DAYS.map((d) => (
              <div key={d} className="text-center py-2 text-[11px] font-bold text-sub">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {monthCells.map((d, i) => {
              const inMonth  = d.getMonth() === cursor.getMonth();
              const isToday  = isSameDay(d, today);
              const dayMissions = missionsOn(d);
              const isSelected = selected && isSameDay(d, selected);
              return (
                <button key={i} onClick={() => setSelected(isSameDay(d, selected ?? new Date(0)) ? null : d)}
                  className={`relative min-h-[64px] p-1.5 text-left border-b border-r border-line transition-colors ${
                    inMonth ? 'hover:bg-bg' : 'bg-bg/40'
                  } ${isSelected ? 'bg-gold-pale/60' : ''}`}>
                  <span className={`text-xs font-semibold leading-none mb-1 flex items-center justify-center h-5 w-5 rounded-full ${
                    isToday ? 'bg-gold-dark text-white' : inMonth ? 'text-text' : 'text-sub/40'
                  }`}>{d.getDate()}</span>
                  <div className="space-y-0.5">
                    {dayMissions.slice(0, 2).map((m) => {
                      const c = STATUS_COLOR[m.status] ?? STATUS_COLOR['SCHEDULED'];
                      return (
                        <div key={m.id} className={`flex items-center gap-0.5 rounded px-1 py-0.5 ${c.bg}`}>
                          <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.dot}`} />
                          <span className={`text-[9px] font-semibold truncate leading-none ${c.text}`}>
                            {fmtTime(m.scheduledAt)}
                          </span>
                        </div>
                      );
                    })}
                    {dayMissions.length > 2 && (
                      <div className="text-[9px] text-sub pl-1">+{dayMissions.length - 2}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Week view ── */}
      {view === 'week' && (
        <div className="rounded-2xl border border-line bg-card overflow-hidden">
          {/* Nav */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-line">
            <button onClick={() => { const w = new Date(weekBase); w.setDate(weekBase.getDate() - 7); setWeekBase(w); }}
              className="h-8 w-8 rounded-lg hover:bg-bg flex items-center justify-center text-sub transition-colors">
              <i className="fa-solid fa-chevron-left text-xs" />
            </button>
            <p className="font-bold text-text text-sm">
              {t('weekRangeLabel', {
                start: `${weekDays[0].getDate()} ${MONTHS[weekDays[0].getMonth()]}`,
                end:   `${weekDays[6].getDate()} ${MONTHS[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`,
              })}
            </p>
            <button onClick={() => { const w = new Date(weekBase); w.setDate(weekBase.getDate() + 7); setWeekBase(w); }}
              className="h-8 w-8 rounded-lg hover:bg-bg flex items-center justify-center text-sub transition-colors">
              <i className="fa-solid fa-chevron-right text-xs" />
            </button>
          </div>

          {/* Week columns */}
          <div className="grid grid-cols-7 min-h-[200px]">
            {weekDays.map((d, i) => {
              const isToday    = isSameDay(d, today);
              const dayMs      = missionsOn(d);
              const isSelected = selected && isSameDay(d, selected);
              return (
                <div key={i}
                  className={`border-r border-line last:border-r-0 ${isToday ? 'bg-gold-pale/20' : ''} ${isSelected ? 'bg-gold-pale/40' : ''}`}
                  onClick={() => setSelected(isSameDay(d, selected ?? new Date(0)) ? null : d)}>
                  {/* Day header */}
                  <div className={`text-center py-2 border-b border-line sticky top-0 ${isToday ? 'bg-gold-pale' : 'bg-card'}`}>
                    <p className="text-[10px] font-semibold text-sub">{DAYS[i]}</p>
                    <p className={`text-sm font-extrabold ${isToday ? 'text-gold-dark' : 'text-text'}`}>{d.getDate()}</p>
                  </div>
                  {/* Missions */}
                  <div className="p-1 space-y-1 cursor-pointer">
                    {dayMs.map((m) => {
                      const c = STATUS_COLOR[m.status] ?? STATUS_COLOR['SCHEDULED'];
                      return (
                        <Link key={m.id} href={`/agent/verifications/${m.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className={`block rounded-lg p-1.5 ${c.bg} hover:opacity-90 transition-opacity`}>
                          <p className={`text-[9px] font-bold ${c.text}`}>{fmtTime(m.scheduledAt)}</p>
                          <p className="text-[9px] text-text truncate leading-snug mt-0.5">
                            {(m as Verification & { listing?: { title?: string } }).listing?.title ?? t('missionFallback')}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Selected day detail ── */}
      {selected && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-text">
              {selected.toLocaleDateString(numLocale, { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            <button onClick={() => setSelected(null)} className="text-sub hover:text-text transition-colors">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          {selectedMissions.length === 0 ? (
            <p className="text-sm text-sub text-center py-4">{t('noMissionsThisDay')}</p>
          ) : (
            <div className="space-y-3">
              {selectedMissions.map((m) => {
                const c   = STATUS_COLOR[m.status] ?? STATUS_COLOR['SCHEDULED'];
                const lnk = m as Verification & { listing?: { title?: string; city?: string } };
                return (
                  <div key={m.id} className={`rounded-xl p-3 ${c.bg} flex items-center justify-between gap-3`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`} />
                      <div className="min-w-0">
                        <p className={`text-sm font-bold ${c.text}`}>{fmtTime(m.scheduledAt)}</p>
                        <p className="text-xs text-text truncate">{lnk.listing?.title ?? t('missionFallback')}</p>
                        {lnk.listing?.city && <p className="text-[10px] text-sub">{lnk.listing.city}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/60 ${c.text}`}>
                        {STATUS_LABEL[m.status] ?? m.status}
                      </span>
                      <Link href={`/agent/verifications/${m.id}`}
                        className={`h-8 w-8 rounded-lg bg-white/60 flex items-center justify-center ${c.text} hover:bg-white transition-colors`}>
                        <i className="fa-solid fa-arrow-right text-xs" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {missions.length === 0 && (
        <div className="rounded-2xl border border-line bg-card p-8 text-center">
          <div className="h-12 w-12 mx-auto mb-3 rounded-2xl bg-gold-pale flex items-center justify-center">
            <i className="fa-regular fa-calendar-xmark text-gold-dark text-xl" />
          </div>
          <p className="font-semibold text-text">{t('emptyCalendarTitle')}</p>
          <p className="text-sm text-sub mt-1">{t('emptyCalendarSub')}</p>
        </div>
      )}
    </div>
  );
}
