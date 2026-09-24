'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import type { Verification } from '@/types';

interface RecentRating {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  raterFirstName: string;
  raterLastName: string;
  raterAvatar?: string | null;
}

interface AgentStats {
  assigned: number;
  inProgress: number;
  doneThisMonth: number;
  doneTotal: number;
  todayMissions: (Verification & { listing?: { id: string; title: string; city: string; address?: string } })[];
  avgRating: number | null;
  totalRatings: number;
  recentRatings: RecentRating[];
}

type ViewMode = 'month' | 'week';

const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  REQUESTED:      { bg: 'bg-blue-50 dark:bg-blue-950/30',    text: 'text-blue-600 dark:text-blue-400',   dot: 'bg-blue-500' },
  SCHEDULED:      { bg: 'bg-gold-pale',  text: 'text-gold-dark',  dot: 'bg-gold' },
  IN_PROGRESS:    { bg: 'bg-purple-50 dark:bg-purple-950/30',  text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  DONE:           { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400',dot: 'bg-emerald-500' },
  REJECTED:       { bg: 'bg-red-50 dark:bg-red-950/30',     text: 'text-red-600 dark:text-red-400',    dot: 'bg-red-500' },
  DECLINE_PENDING:{ bg: 'bg-amber-50 dark:bg-amber-950/30',   text: 'text-amber-600 dark:text-amber-400',  dot: 'bg-amber-500' },
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

export default function AgentDashboard() {
  const { getToken } = useAuth();
  const t = useTranslations('agent');
  const locale = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';
  const [stats,   setStats]   = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  // ── Calendrier (fusionné depuis /agent/calendrier) ───────────────────────
  const [missions, setMissions]         = useState<Verification[]>([]);
  const [calLoading, setCalLoading]     = useState(true);
  const [view, setView]                 = useState<ViewMode>('month');
  const [cursor, setCursor]             = useState(new Date());
  const [weekBase, setWeekBase]         = useState(() => startOfWeek(new Date()));
  const [selected, setSelected]         = useState<Date | null>(null);
  const calToastRef = useRef(console.error);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    void (async () => {
      const token = await getToken();
      if (!token) { setLoading(false); setCalLoading(false); return; }
      try {
        const data = await api.get<AgentStats>('/verifications/stats', token);
        setStats(data);
      } catch {}
      finally { setLoading(false); }
      try {
        const all = await api.get<Verification[]>('/verifications/all-mine', token);
        setMissions(all);
      } catch (e) { calToastRef.current(e); }
      finally { setCalLoading(false); }
    })();
  // getToken est stable depuis Clerk — pas de boucle
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? t('greetingMorning') : hour < 18 ? t('greetingAfternoon') : t('greetingEvening');

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

  const missionsOn = useCallback(
    (d: Date) => missions.filter((m) => isSameDay(new Date(m.scheduledAt), d)),
    [missions],
  );

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

  const legendStatuses = ['SCHEDULED','IN_PROGRESS','DONE','REJECTED'];

  return (
    <div className="space-y-7">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text">
          {greeting}, <span className="text-gold-dark">{t('roleAgent')}</span>
        </h1>
        <p className="text-sm text-sub mt-0.5">
          {now.toLocaleDateString(numLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats — grille à 5 colonnes sur desktop pour que les 5 cartes
          s'alignent proprement sur une seule ligne (au lieu de l'ancien
          col-span-2 sur la carte note qui cassait la symétrie du grid). */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="rounded-2xl border border-line bg-card p-4 animate-pulse h-24" />
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            icon="fa-calendar-check"
            iconBg="bg-blue-50 dark:bg-blue-950/30"
            iconColor="text-blue-600 dark:text-blue-400"
            label={t('statAssigned')}
            value={stats.assigned}
          />
          <StatCard
            icon="fa-person-walking"
            iconBg="bg-purple-50 dark:bg-purple-950/30"
            iconColor="text-purple-600 dark:text-purple-400"
            label={t('statInProgressLabel')}
            value={stats.inProgress}
          />
          <StatCard
            icon="fa-shield-halved"
            iconBg="bg-emerald-50 dark:bg-emerald-950/30"
            iconColor="text-emerald-600 dark:text-emerald-400"
            label={t('statThisMonth')}
            value={stats.doneThisMonth}
          />
          <StatCard
            icon="fa-trophy"
            iconBg="bg-gold-pale"
            iconColor="text-gold-dark"
            label={t('statTotalCertified')}
            value={stats.doneTotal}
          />
          {/* Note moyenne — même gabarit StatCard que les 4 autres (au lieu
              d'un bloc customisé à part) pour une grille visuellement uniforme. */}
          <StatCard
            icon="fa-star"
            iconBg="bg-amber-50 dark:bg-amber-950/30"
            iconColor="text-amber-500"
            label={stats.avgRating !== null ? t('avgRatingLabel', { count: stats.totalRatings }) : t('noRatingsYet')}
            value={stats.avgRating !== null ? <>{stats.avgRating.toFixed(1)}<span className="text-sm font-normal text-sub">/5</span></> : '—'}
          />
        </div>
      )}

      {/* Missions du jour */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-text flex items-center gap-2">
            <i className="fa-solid fa-sun text-gold-dark text-xs" />
            {t('todayMissions')}
          </h2>
          <Link href="/agent/verifications" className="text-xs text-gold-dark hover:underline">
            {t('allMissionsLink')}
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[1,2].map((i) => (
              <div key={i} className="rounded-2xl border border-line bg-card p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : !stats || stats.todayMissions.length === 0 ? (
          <div className="rounded-2xl border border-line bg-card p-8 text-center">
            <i className="fa-solid fa-coffee text-2xl text-sub mb-3 block" />
            <p className="font-semibold text-text text-sm">{t('noMissionsToday')}</p>
            <p className="text-xs text-sub mt-1">{t('noMissionsTodayHint')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {stats.todayMissions.map((m) => (
              <MissionCard key={m.id} mission={m} />
            ))}
          </div>
        )}
      </section>

      {/* Calendrier des missions (fusionné depuis l'ancienne page
          /agent/calendrier, désormais supprimée) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-text flex items-center gap-2">
            <i className="fa-regular fa-calendar-days text-gold-dark text-xs" />
            {t('calendarTitle')}
          </h2>
          <div className="flex items-center gap-2">
            <Link href="/agent/verifications" className="text-xs text-gold-dark hover:underline">
              {t('allMissionsLink')}
            </Link>
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

        {calLoading ? (
          <div className="rounded-2xl border border-line bg-card p-8 animate-pulse h-48" />
        ) : (
          <>
            {/* Legend */}
            <div className="flex items-center gap-3 flex-wrap">
              {legendStatuses.map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-[11px] text-sub">
                  <div className={`h-2 w-2 rounded-full ${STATUS_COLOR[s]?.dot ?? 'bg-sub'}`} />
                  {STATUS_LABEL[s]}
                </div>
              ))}
            </div>

            {/* Month view */}
            {view === 'month' && (
              <div className="rounded-2xl border border-line bg-card overflow-hidden">
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

                <div className="grid grid-cols-7 border-b border-line">
                  {DAYS.map((d) => (
                    <div key={d} className="text-center py-2 text-[11px] font-bold text-sub">{d}</div>
                  ))}
                </div>

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
                        } ${isSelected ? 'bg-gold-pale/60 dark:bg-gold-dark/15' : ''}`}>
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

            {/* Week view */}
            {view === 'week' && (
              <div className="rounded-2xl border border-line bg-card overflow-hidden">
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

                <div className="grid grid-cols-7 min-h-[200px]">
                  {weekDays.map((d, i) => {
                    const isToday    = isSameDay(d, today);
                    const dayMs      = missionsOn(d);
                    const isSelected = selected && isSameDay(d, selected);
                    return (
                      <div key={i}
                        className={`border-r border-line last:border-r-0 ${isToday ? 'bg-gold-pale/20 dark:bg-gold-dark/10' : ''} ${isSelected ? 'bg-gold-pale/40 dark:bg-gold-dark/15' : ''}`}
                        onClick={() => setSelected(isSameDay(d, selected ?? new Date(0)) ? null : d)}>
                        <div className={`text-center py-2 border-b border-line sticky top-0 ${isToday ? 'bg-gold-pale dark:bg-gold-dark/20' : 'bg-card'}`}>
                          <p className="text-[10px] font-semibold text-sub">{DAYS[i]}</p>
                          <p className={`text-sm font-extrabold ${isToday ? 'text-gold-dark' : 'text-text'}`}>{d.getDate()}</p>
                        </div>
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

            {/* Selected day detail */}
            {selected && (
              <div className="rounded-2xl border border-line bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-text">
                    {isSameDay(selected, today) ? t('todayMissions') : selected.toLocaleDateString(numLocale, { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  <button onClick={() => setSelected(null)} className="text-sub hover:text-text transition-colors">
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
                {selectedMissions.length === 0 ? (
                  <p className="text-sm text-sub text-center py-4">
                    {isSameDay(selected, today) ? t('noMissionsToday') : t('noMissionsThisDay')}
                  </p>
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

            {/* Empty state */}
            {missions.length === 0 && (
              <div className="rounded-2xl border border-line bg-card p-8 text-center">
                <div className="h-12 w-12 mx-auto mb-3 rounded-2xl bg-gold-pale flex items-center justify-center">
                  <i className="fa-regular fa-calendar-xmark text-gold-dark text-xl" />
                </div>
                <p className="font-semibold text-text">{t('emptyCalendarTitle')}</p>
                <p className="text-sm text-sub mt-1">{t('emptyCalendarSub')}</p>
              </div>
            )}
          </>
        )}
      </section>

      {/* Derniers avis reçus */}
      {!loading && stats && stats.recentRatings.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-text flex items-center gap-2">
              <i className="fa-solid fa-star text-amber-400 text-xs" />
              {t('recentReviews')}
            </h2>
          </div>
          <div className="rounded-2xl border border-line bg-card divide-y divide-line overflow-hidden">
            {stats.recentRatings.map((r) => {
              const initials = `${r.raterFirstName[0]}${r.raterLastName[0]}`.toUpperCase();
              // eslint-disable-next-line react-hooks/purity -- lecture de l'heure courante pour un affichage "il y a X jours", snapshot voulu au rendu
              const diffDays = Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 86400000);
              const timeStr = diffDays === 0
                ? t('timeToday')
                : diffDays === 1
                  ? t('timeYesterday')
                  : t('timeDaysAgo', { days: diffDays });
              return (
                <div key={r.id} className="flex items-start gap-3 px-4 py-3">
                  {r.raterAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.raterAvatar} alt={r.raterFirstName}
                      className="h-8 w-8 rounded-full object-cover border border-line shrink-0 mt-0.5" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-bg border border-line flex items-center justify-center text-[10px] font-bold text-sub shrink-0 mt-0.5">
                      {initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-semibold text-text">{r.raterFirstName} {r.raterLastName[0]}.</p>
                      <span className="text-[10px] text-sub">{timeStr}</span>
                    </div>
                    <div className="flex gap-0.5 mb-1">
                      {[1,2,3,4,5].map((n) => (
                        <span key={n} className={`text-sm leading-none ${n <= r.rating ? 'text-amber-400' : 'text-line'}`}>★</span>
                      ))}
                    </div>
                    {r.comment && (
                      <p className="text-xs text-sub leading-relaxed line-clamp-2">{r.comment}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Raccourcis */}
      <section>
        <h2 className="text-sm font-bold text-text mb-3">{t('quickAccess')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/agent/messages"
            className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 hover:border-gold/40 transition-all group"
          >
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-comment-dots text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-text text-sm group-hover:text-gold-dark transition-colors">{t('quickMessages')}</p>
              <p className="text-xs text-sub">{t('quickMessagesDesc')}</p>
            </div>
            <i className="fa-solid fa-chevron-right text-sub text-xs ml-auto group-hover:text-gold-dark transition-colors" />
          </Link>

          <Link
            href="/agent/profil"
            className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 hover:border-gold/40 transition-all group"
          >
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-user text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-text text-sm group-hover:text-gold-dark transition-colors">{t('quickProfile')}</p>
              <p className="text-xs text-sub">{t('quickProfileDesc')}</p>
            </div>
            <i className="fa-solid fa-chevron-right text-sub text-xs ml-auto group-hover:text-gold-dark transition-colors" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, iconBg, iconColor, label, value }: {
  icon: string; iconBg: string; iconColor: string; label: string; value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className={`h-9 w-9 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
        <i className={`fa-solid ${icon} ${iconColor} text-sm`} />
      </div>
      <p className="text-2xl font-extrabold text-text">{value}</p>
      <p className="text-xs text-sub mt-0.5">{label}</p>
    </div>
  );
}

function MissionCard({ mission }: { mission: Verification & { listing?: { id: string; title: string; city: string; address?: string } } }) {
  const t = useTranslations('agent');
  const locale = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';
  const time = new Date(mission.scheduledAt).toLocaleTimeString(numLocale, { hour: '2-digit', minute: '2-digit' });
  const statusColor = mission.status === 'IN_PROGRESS' ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400' : 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400';
  const statusLabel = mission.status === 'IN_PROGRESS' ? t('statusInProgress') : t('statusScheduled');

  return (
    <Link
      href="/agent/verifications"
      className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 hover:border-gold/40 transition-all"
    >
      {/* Heure */}
      <div className="shrink-0 text-center w-12">
        <p className="text-lg font-extrabold text-gold-dark leading-none">{time}</p>
        <p className="text-[9px] text-sub uppercase tracking-wide mt-0.5">{t('missionScheduledAbbr')}</p>
      </div>

      <div className="w-px h-10 bg-line shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text text-sm truncate">{mission.listing?.title ?? t('missionFallback')}</p>
        <p className="text-xs text-sub truncate mt-0.5">
          <i className="fa-solid fa-location-dot text-gold-dark text-[10px] mr-1" />
          {mission.listing?.city}{mission.listing?.address ? ` · ${mission.listing.address}` : ''}
        </p>
      </div>

      <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${statusColor}`}>
        {statusLabel}
      </span>
    </Link>
  );
}
