'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';

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
  VERIF_ASSIGNED:        { icon: 'fa-shield-halved',  color: 'text-blue-600',    bg: 'bg-blue-50',    labelKey: 'typeVerification' },
  VERIF_SCHEDULED:       { icon: 'fa-calendar-check', color: 'text-blue-700',    bg: 'bg-blue-50',    labelKey: 'typeVerification' },
  VERIF_IN_PROGRESS:     { icon: 'fa-person-walking', color: 'text-purple-600',  bg: 'bg-purple-50',  labelKey: 'typeVerification' },
  VERIF_DONE:            { icon: 'fa-circle-check',   color: 'text-emerald-600', bg: 'bg-emerald-50', labelKey: 'typeVerification' },
  VERIF_DECLINED:        { icon: 'fa-ban',            color: 'text-amber-600',   bg: 'bg-amber-50',   labelKey: 'typeVerification' },
  VERIF_VALIDATED:       { icon: 'fa-medal',          color: 'text-yellow-600',  bg: 'bg-yellow-50',  labelKey: 'typeVerification' },
  NEW_BOOKING:           { icon: 'fa-calendar-plus',  color: 'text-blue-600',    bg: 'bg-blue-50',    labelKey: 'typeBooking'      },
  BOOKING_CONFIRMED:     { icon: 'fa-circle-check',   color: 'text-emerald-600', bg: 'bg-emerald-50', labelKey: 'typeBooking'      },
  BOOKING_CANCELLED:     { icon: 'fa-calendar-xmark', color: 'text-red-600',     bg: 'bg-red-50',     labelKey: 'typeBooking'      },
  REVIEW_RECEIVED:       { icon: 'fa-star',           color: 'text-yellow-500',  bg: 'bg-yellow-50',  labelKey: 'typeReview'       },
  LISTING_REPORTED:      { icon: 'fa-flag',           color: 'text-red-600',     bg: 'bg-red-50',     labelKey: 'typeReport'       },
  VERIF_DECLINE_REQUEST: { icon: 'fa-hand',           color: 'text-orange-600',  bg: 'bg-orange-50',  labelKey: 'typeVerification' },
};

const DEFAULT_STYLE = { icon: 'fa-circle-dot', color: 'text-sub', bg: 'bg-bg', labelKey: 'typeDefault' };

type Filter = 'all' | 'unread';

export default function NotificationsPage() {
  const { getToken } = useAuth();
  const t         = useTranslations('notifications');
  const locale    = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';

  const [notifs,   setNotifs]   = useState<Notif[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<Filter>('all');
  const [marking,  setMarking]  = useState(false);

  const relativeTime = (dateStr: string): string => {
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

  const displayed = filter === 'unread' ? notifs.filter((n) => !n.isRead) : notifs;
  const unreadCount = notifs.filter((n) => !n.isRead).length;

  const FILTERS: [Filter, string][] = [
    ['all',    t('filterAll')],
    ['unread', t('filterUnread')],
  ];

  return (
    <div>
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

      {/* Filtres */}
      <div className="flex gap-2 mb-5">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
              filter === key
                ? 'border-gold-dark bg-gold-dark text-white'
                : 'border-line bg-card text-sub hover:border-gold-dark/40 hover:text-text'
            }`}
          >
            {label}
            {key === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 text-xs">({unreadCount})</span>
            )}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl border border-line bg-card animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-bell text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">
            {filter === 'unread' ? t('emptyUnread') : t('empty')}
          </p>
          <p className="mt-1 text-sm text-sub">
            {filter === 'unread' ? t('emptyUnreadDesc') : t('emptyDesc')}
          </p>
          {filter === 'unread' && (
            <button onClick={() => setFilter('all')} className="mt-4 text-sm font-medium text-gold-dark hover:underline">
              {t('seeAll')}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayed.map((n) => {
            const style = TYPE_STYLE[n.type] ?? DEFAULT_STYLE;
            return (
              <div
                key={n.id}
                onClick={() => { if (!n.isRead) void markOne(n.id); }}
                className={`group flex items-start gap-4 rounded-2xl border p-4 transition-all cursor-pointer ${
                  !n.isRead
                    ? 'border-gold/30 bg-gold-pale/30 hover:bg-gold-pale/50'
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
                  <p className="text-sm text-sub mt-0.5 leading-relaxed">{n.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
