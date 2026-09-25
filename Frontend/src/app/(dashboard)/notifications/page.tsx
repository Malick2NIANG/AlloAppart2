'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import { StatFilterCard } from '@/components/bookings/StatFilterCard';
import { BookingSearchRow } from '@/components/bookings/BookingSearchRow';
import { BookingPagination } from '@/components/bookings/BookingPagination';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/* Config visuelle uniquement — les libellés sont traduits dans le composant */
const TYPE_STYLE: Record<string, { icon: string; color: string; bg: string; labelKey: string }> = {
  VERIF_ASSIGNED:        { icon: 'fa-shield-halved',  color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-950/30',    labelKey: 'typeVerification' },
  VERIF_SCHEDULED:       { icon: 'fa-calendar-check', color: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-950/30',    labelKey: 'typeVerification' },
  VERIF_IN_PROGRESS:     { icon: 'fa-person-walking', color: 'text-purple-600 dark:text-purple-400',  bg: 'bg-purple-50 dark:bg-purple-950/30',  labelKey: 'typeVerification' },
  VERIF_DONE:            { icon: 'fa-circle-check',   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', labelKey: 'typeVerification' },
  VERIF_DECLINED:        { icon: 'fa-ban',            color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/30',   labelKey: 'typeVerification' },
  VERIF_VALIDATED:       { icon: 'fa-medal',          color: 'text-yellow-600 dark:text-yellow-400',  bg: 'bg-yellow-50 dark:bg-yellow-950/30',  labelKey: 'typeVerification' },
  NEW_BOOKING:           { icon: 'fa-calendar-plus',  color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-950/30',    labelKey: 'typeBooking'      },
  BOOKING_CONFIRMED:     { icon: 'fa-circle-check',   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', labelKey: 'typeBooking'      },
  BOOKING_CANCELLED:     { icon: 'fa-calendar-xmark', color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-950/30',     labelKey: 'typeBooking'      },
  REVIEW_RECEIVED:       { icon: 'fa-star',           color: 'text-yellow-500',  bg: 'bg-yellow-50 dark:bg-yellow-950/30',  labelKey: 'typeReview'       },
  LISTING_REPORTED:      { icon: 'fa-flag',           color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-950/30',     labelKey: 'typeReport'       },
  VERIF_DECLINE_REQUEST: { icon: 'fa-hand',           color: 'text-orange-600 dark:text-orange-400',  bg: 'bg-orange-50 dark:bg-orange-950/30',  labelKey: 'typeVerification' },
};

const DEFAULT_STYLE = { icon: 'fa-circle-dot', color: 'text-sub', bg: 'bg-bg', labelKey: 'typeDefault' };

type Filter = 'all' | 'unread';

const PER_PAGE_OPTIONS = [10, 20, 50] as const;

export default function NotificationsPage() {
  const { getToken } = useAuth();
  const router    = useRouter();
  const t         = useTranslations('notifications');
  const locale    = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';

  const [notifs,   setNotifs]   = useState<Notif[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<Filter>('all');
  const [marking,  setMarking]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [perPage,  setPerPage]  = useState<number>(PER_PAGE_OPTIONS[0]);
  const [page,     setPage]     = useState(1);
  // Notifications dont le texte (tronqué à 2 lignes par défaut) a été
  // déplié — clé = id de la notif, même pattern que NotificationBell.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Notifications dont le texte dépasse réellement 2 lignes (donc tronqué
  // visuellement) — mesuré au DOM plutôt qu'estimé sur le nombre de
  // caractères, pour éviter les faux négatifs (texte proche de la limite
  // selon la largeur d'écran/police). N'affiche "Voir plus" que si besoin.
  const [truncated, setTruncated] = useState<Record<string, boolean>>({});

  const relativeTime = (dateStr: string): string => {
    // eslint-disable-next-line react-hooks/purity -- lecture de l'heure courante pour un affichage "il y a X min/h/j", snapshot voulu au rendu
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return t('justNow');
    if (m < 60) return t('minutesAgo', { count: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t('hoursAgo', { count: h });
    const d = Math.floor(h / 24);
    if (d < 7)  return t('daysAgo', { count: d });
    return new Date(dateStr).toLocaleDateString(numLocale, { day: 'numeric', month: 'short' });
  };

  const load = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      const data = await api.get<Notif[]>('/notifications/mine', token);
      setNotifs(Array.isArray(data) ? data : []);
    } catch {
      setNotifs([]);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch initial, setState après résolution async
  useEffect(() => { void load(); }, [load]);

  const markAllRead = async () => {
    const token = await getToken();
    if (!token) return;
    setMarking(true);
    try {
      await api.patch('/notifications/read-all', {}, token);
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } finally {
      setMarking(false);
    }
  };

  const markOne = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      await api.patch(`/notifications/${id}/read`, {}, token);
      setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch {}
  };

  const unreadCount = notifs.filter((n) => !n.isRead).length;

  const q = search.trim().toLowerCase();
  const filtered = notifs
    .filter((n) => (filter === 'unread' ? !n.isRead : true))
    .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage  = Math.min(page, pageCount);
  const displayed = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  return (
    <div>
      {/* Fermer */}
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 text-sm text-sub transition hover:text-text"
      >
        <i className="fa-solid fa-xmark text-xs" /> {t('back')}
      </button>

      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">{t('title')}</h1>
          <p className="text-sm text-sub mt-0.5">
            {t('count', { count: notifs.length })}
            {unreadCount > 0 && (
              <span className="ml-2 font-semibold text-gold-dark">{t('unreadCount', { count: unreadCount })}</span>
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => void markAllRead()}
            disabled={marking}
            className="text-sm font-medium text-gold-dark hover:underline disabled:opacity-50"
          >
            {marking ? <i className="fa-solid fa-spinner fa-spin" /> : t('markAllRead')}
          </button>
        )}
      </div>

      {/* Filtres — même gabarit cartes stats/filtre que le reste de l'app */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatFilterCard
          icon="fa-bell"
          label={t('filterAll')}
          value={notifs.length}
          color="text-gold-dark"
          bg="bg-gold-pale dark:bg-gold-dark/20"
          active={filter === 'all'}
          onClick={() => { setFilter('all'); setPage(1); }}
          selectedLabel={t('filterSelected')}
        />
        <StatFilterCard
          icon="fa-envelope"
          label={t('filterUnread')}
          value={unreadCount}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-50 dark:bg-blue-950/30"
          active={filter === 'unread'}
          onClick={() => { setFilter('unread'); setPage(1); }}
          selectedLabel={t('filterSelected')}
        />
      </div>

      {/* Recherche + lignes par page */}
      <BookingSearchRow
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t('searchPlaceholder')}
        perPage={perPage}
        onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
        perPageOptions={PER_PAGE_OPTIONS}
        rowsLabel={t('rowsLabel')}
      />

      {/* Liste */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl border border-line bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-bell text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">
            {q ? t('noSearchResults') : filter === 'unread' ? t('emptyUnread') : t('empty')}
          </p>
          {!q && (
            <p className="mt-1 text-sm text-sub">
              {filter === 'unread' ? t('emptyUnreadDesc') : t('emptyDesc')}
            </p>
          )}
          {!q && filter === 'unread' && (
            <button onClick={() => { setFilter('all'); setPage(1); }} className="mt-4 text-sm font-medium text-gold-dark hover:underline">
              {t('seeAll')}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayed.map((n) => {
            const style      = TYPE_STYLE[n.type] ?? DEFAULT_STYLE;
            const isExpanded = !!expanded[n.id];
            return (
              <div
                key={n.id}
                onClick={() => { if (!n.isRead) void markOne(n.id); }}
                className={`group flex items-start gap-4 rounded-2xl border p-4 transition-all cursor-pointer ${
                  !n.isRead
                    ? 'border-gold/30 dark:border-gold/20 bg-gold-pale/30 dark:bg-gold-dark/10 hover:bg-gold-pale/50 dark:hover:bg-gold-dark/20'
                    : 'border-line bg-card hover:bg-bg'
                }`}
              >
                {/* Icône */}
                <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${style.bg}`}>
                  <i className={`fa-solid ${style.icon} text-sm ${style.color}`} />
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${style.color} mr-2`}>
                        {t(style.labelKey as Parameters<typeof t>[0])}
                      </span>
                      <p className={`text-sm leading-snug ${!n.isRead ? 'font-semibold text-text' : 'font-medium text-text'}`}>
                        {n.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!n.isRead && (
                        <div className="h-2 w-2 rounded-full bg-gold-dark" />
                      )}
                      <span className="text-[11px] text-sub whitespace-nowrap">{relativeTime(n.createdAt)}</span>
                    </div>
                  </div>
                  <p
                    ref={(el) => {
                      // Mesuré une seule fois (tant que replié) : si le texte
                      // dépasse la hauteur visible sous line-clamp-2, il est
                      // réellement tronqué et mérite un bouton "Voir plus".
                      if (el && !isExpanded && truncated[n.id] === undefined) {
                        const overflowing = el.scrollHeight > el.clientHeight + 1;
                        if (overflowing) setTruncated((prev) => ({ ...prev, [n.id]: true }));
                      }
                    }}
                    className={`text-sm text-sub mt-0.5 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}
                  >
                    {n.body}
                  </p>
                  {truncated[n.id] && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpanded((prev) => ({ ...prev, [n.id]: !prev[n.id] }));
                      }}
                      className="mt-1 text-xs font-semibold text-gold-dark hover:underline"
                    >
                      {isExpanded ? t('seeLessText') : t('seeMoreText')}
                      <i className={`fa-solid fa-chevron-down text-[9px] ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BookingPagination
        page={safePage}
        pageCount={pageCount}
        onPageChange={setPage}
        previousLabel={t('previous')}
        nextLabel={t('next')}
        pageOfLabel={t('pageOf', { page: safePage, total: pageCount })}
      />
    </div>
  );
}
