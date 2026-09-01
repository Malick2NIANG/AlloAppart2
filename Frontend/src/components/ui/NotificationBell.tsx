'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import Pusher from 'pusher-js';
import { api } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  metadata?: { listingId?: string; verificationId?: string };
}

const TYPE_ICON: Record<string, { icon: string; color: string }> = {
  VERIF_ASSIGNED:    { icon: 'fa-shield-halved',    color: 'text-blue-500'    },
  VERIF_SCHEDULED:   { icon: 'fa-calendar-check',   color: 'text-blue-600'    },
  VERIF_IN_PROGRESS: { icon: 'fa-person-walking',   color: 'text-purple-500'  },
  VERIF_DONE:        { icon: 'fa-circle-check',      color: 'text-emerald-500' },
  VERIF_DECLINED:    { icon: 'fa-ban',               color: 'text-amber-500'   },
  VERIF_VALIDATED:   { icon: 'fa-medal',             color: 'text-gold'        },
  NEW_BOOKING:       { icon: 'fa-calendar-plus',    color: 'text-blue-500'    },
  BOOKING_CONFIRMED: { icon: 'fa-circle-check',     color: 'text-emerald-500' },
  BOOKING_CANCELLED: { icon: 'fa-calendar-xmark',   color: 'text-red-500'     },
  REVIEW_RECEIVED:   { icon: 'fa-star',             color: 'text-gold'        },
};

export default function NotificationBell({ userId }: { userId: string }) {
  const t             = useTranslations('notifications');
  const { getToken }  = useAuth();
  const [notifs,      setNotifs]      = useState<Notif[]>([]);
  const [unread,      setUnread]      = useState(0);
  const [open,        setOpen]        = useState(false);
  const [loading,     setLoading]     = useState(false);
  const dropdownRef   = useRef<HTMLDivElement>(null);
  const tokenRef      = useRef<string | null>(null);

  const relativeTime = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m    = Math.floor(diff / 60000);
    if (m < 1)  return t('justNow');
    if (m < 60) return t('minutesAgo', { count: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t('hoursAgo', { count: h });
    return t('daysAgo', { count: Math.floor(h / 24) });
  };

  /* ── Fetch ───────────────────────────────────────────────── */
  const fetchNotifs = useCallback(async () => {
    const token = await getToken().catch(() => null);
    if (!token) return;
    tokenRef.current = token;
    try {
      const [list, countRes] = await Promise.all([
        api.get<Notif[]>('/notifications/mine', token),
        api.get<{ count: number }>('/notifications/unread-count', token),
      ]);
      setNotifs(list);
      setUnread(countRes.count);
    } catch {}
  }, [getToken]);

  useEffect(() => { void fetchNotifs(); }, [fetchNotifs]);

  /* ── Pusher temps réel ────────────────────────────────────── */
  useEffect(() => {
    if (!userId) return;
    const key  = process.env.NEXT_PUBLIC_SOKETI_APP_KEY  ?? '';
    const host = process.env.NEXT_PUBLIC_SOKETI_HOST     ?? 'localhost';
    const port = Number(process.env.NEXT_PUBLIC_SOKETI_PORT ?? '6001');
    if (!key) return;

    // En prod, Soketi est servi en HTTPS/WSS via Caddy (port 443) — le
    // navigateur bloque un ws:// non chiffré depuis une page https://.
    const useTLS = port === 443;
    const client = new Pusher(key, {
      cluster: 'mt1', wsHost: host, wsPort: port, wssPort: port,
      forceTLS: useTLS, enabledTransports: useTLS ? ['wss'] : ['ws'], disableStats: true,
    });
    const ch = client.subscribe(`user-${userId}`);
    ch.bind('notification', (notif: Notif) => {
      setNotifs((prev) => [notif, ...prev].slice(0, 30));
      setUnread((n) => n + 1);
    });
    return () => { ch.unbind_all(); client.unsubscribe(`user-${userId}`); client.disconnect(); };
  }, [userId]);

  /* ── Fermer en cliquant dehors ────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* ── Ouvrir dropdown + marquer tout lu ────────────────────── */
  const handleOpen = async () => {
    setOpen((o) => !o);
    if (!open && unread > 0) {
      const token = tokenRef.current ?? await getToken().catch(() => null);
      if (token) {
        try {
          await api.patch('/notifications/read-all', {}, token);
          setUnread(0);
          setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
        } catch {}
      }
    }
  };

  /* ── Marquer une seule notif lue ──────────────────────────── */
  const markOne = async (id: string) => {
    const token = tokenRef.current ?? await getToken().catch(() => null);
    if (!token) return;
    try {
      await api.patch(`/notifications/${id}/read`, {}, token);
      setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch {}
  };

  if (loading) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-bg text-sub hover:text-text hover:bg-card transition-colors"
        aria-label={t('title')}
      >
        <i className="fa-solid fa-bell text-sm" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-line bg-card shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="text-sm font-semibold text-main">{t('title')}</p>
            {notifs.length > 0 && (
              <button
                onClick={async () => {
                  const token = tokenRef.current ?? await getToken().catch(() => null);
                  if (token) {
                    await api.patch('/notifications/read-all', {}, token).catch(() => {});
                    setUnread(0);
                    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
                  }
                }}
                className="text-[10px] text-sub hover:text-gold-dark transition-colors"
              >
                {t('markAllRead')}
              </button>
            )}
          </div>

          {/* Liste */}
          <div className="max-h-80 overflow-y-auto divide-y divide-line">
            {notifs.length === 0 ? (
              <div className="py-10 text-center">
                <i className="fa-solid fa-bell-slash text-2xl text-line mb-2" />
                <p className="text-xs text-sub">{t('empty')}</p>
              </div>
            ) : (
              notifs.map((n) => {
                const cfg = TYPE_ICON[n.type] ?? { icon: 'fa-circle-dot', color: 'text-sub' };
                return (
                  <div
                    key={n.id}
                    onClick={() => void markOne(n.id)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-bg transition-colors ${!n.isRead ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className="shrink-0 h-8 w-8 rounded-xl flex items-center justify-center bg-bg border border-line mt-0.5">
                      <i className={`fa-solid ${cfg.icon} text-xs ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold text-main leading-snug ${!n.isRead ? 'font-bold' : ''}`}>
                        {n.title}
                      </p>
                      <p className="text-[11px] text-sub mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-sub/70 mt-1">{relativeTime(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <div className="shrink-0 h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-line px-4 py-2.5 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-gold-dark hover:underline"
            >
              {t('seeAll')} <i className="fa-solid fa-arrow-right text-[10px] ml-1" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
