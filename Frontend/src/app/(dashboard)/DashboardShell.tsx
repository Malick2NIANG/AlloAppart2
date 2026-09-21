'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import Pusher from 'pusher-js';
import { useClerk, useAuth, useUser } from '@clerk/nextjs';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import type { MessageRoom } from '@/types';
import SubscriptionAlert from '@/components/ui/SubscriptionAlert';
import NotificationBell from '@/components/ui/NotificationBell';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { useLocaleTransition } from '@/components/ui/LocaleTransition';
import { SkeletonStatCard } from '@/components/ui/Skeleton';
import type { Locale } from '@/i18n/config';

/**
 * Skeleton fidèle à la mise en page du dashboard (sidebar + header + zone de
 * travail) — affiché pendant le changement de langue à la place du skeleton
 * générique de la racine (cf. LocaleTransitionOverlay), pour que la
 * transition ne "coupe" pas visuellement le tableau de bord.
 */
function DashboardSkeletonOverlay({ collapsed }: { collapsed: boolean }) {
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-[999] flex bg-bg">
      {/* Sidebar */}
      <div className={`hidden lg:flex shrink-0 flex-col border-r border-line bg-card ${collapsed ? 'w-16' : 'w-64'}`}>
        <div className="flex h-14 shrink-0 items-center border-b border-line px-5">
          {!collapsed && <div className="h-3 w-24 rounded-full bg-line animate-pulse" />}
        </div>
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-line animate-pulse" />
          {!collapsed && (
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded-full bg-line animate-pulse" />
              <div className="h-2.5 w-16 rounded-full bg-line animate-pulse" />
            </div>
          )}
        </div>
        <div className="flex-1 space-y-1 px-2 py-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2.5 py-2">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-line animate-pulse" />
              {!collapsed && <div className="h-3 flex-1 max-w-[70%] rounded-full bg-line animate-pulse" />}
            </div>
          ))}
        </div>
        <div className="space-y-1 border-t border-line px-2 py-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2.5 py-2">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-line animate-pulse" />
              {!collapsed && <div className="h-3 w-20 rounded-full bg-line animate-pulse" />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-card px-4 lg:hidden">
          <div className="h-11 w-11 rounded-xl bg-line animate-pulse" />
          <div className="h-8 w-28 rounded-full bg-line animate-pulse" />
          <div className="h-9 w-9 rounded-full bg-line animate-pulse" />
        </div>
        {/* Header desktop */}
        <div className="hidden h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-card px-6 lg:flex">
          <div className="flex items-center gap-2">
            <div className="h-3 w-40 rounded-full bg-line animate-pulse" />
            <div className="h-3 w-16 rounded-full bg-line animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-16 rounded-full bg-line animate-pulse" />
            <div className="h-9 w-9 rounded-full bg-line animate-pulse" />
            <div className="h-9 w-9 rounded-full bg-line animate-pulse" />
          </div>
        </div>

        {/* Zone de travail */}
        <div className="flex-1 space-y-6 overflow-hidden p-4 sm:p-6 lg:p-8">
          <div className="space-y-2">
            <div className="h-6 w-56 rounded-full bg-line animate-pulse" />
            <div className="h-3 w-80 max-w-full rounded-full bg-line animate-pulse" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonStatCard key={i} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  exact?: boolean;
  separator?: boolean; // si true, affiche un séparateur avec label au-dessus
}

const ROLE_COLORS: Record<string, string> = {
  LOCATAIRE:     'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  BAILLEUR:      'bg-gold-pale text-gold-dark',
  PRO_AGENCE:    'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
  AGENT_TERRAIN: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
  ADMIN:         'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
};

const DOMINANT_BADGE_CLASS: Record<string, string> = {
  ADMIN:         'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  PRO_AGENCE:    'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  AGENT_TERRAIN: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
};

type DominantRole = 'ADMIN' | 'PRO_AGENCE' | 'AGENT_TERRAIN';

interface Props {
  userName: string;
  userId: string;
  roles: string[];
  navItems: NavItem[];
  isProAgence?: boolean;
  userRole?: DominantRole | null;
  userAvatar?: string | null;
  userInitials?: string;
  pendingVerifCount?: number;
  pendingReportsCount?: number;
  pendingDisputesCount?: number;
  children: React.ReactNode;
}

export default function DashboardShell({ userName, userId, roles, navItems, isProAgence = false, userRole, userAvatar, userInitials = '?', pendingVerifCount: initialVerifCount = 0, pendingReportsCount: initialReportsCount = 0, pendingDisputesCount: initialDisputesCount = 0, children }: Props) {
  const td     = useTranslations('dashboard');
  const locale = useLocale();

  // Computed translation maps (inside component to access td)
  const ROLE_LABELS: Record<string, string> = {
    LOCATAIRE:     td('roleLocataire'),
    BAILLEUR:      td('roleBailleur'),
    PRO_AGENCE:    td('roleProAgence'),
    AGENT_TERRAIN: td('roleAgent'),
    ADMIN:         td('roleAdmin'),
  };

  const DOMINANT_BADGE: Record<DominantRole, { label: string; className: string }> = {
    ADMIN:         { label: td('badgeAdmin'),     className: DOMINANT_BADGE_CLASS.ADMIN         },
    PRO_AGENCE:    { label: td('badgeProAgence'), className: DOMINANT_BADGE_CLASS.PRO_AGENCE    },
    AGENT_TERRAIN: { label: td('badgeAgent'),     className: DOMINANT_BADGE_CLASS.AGENT_TERRAIN },
  };

  const SPACE_LABEL: Record<string, { label: string; sub: string }> = {
    ADMIN:         { label: td('spaceAdmin'),    sub: td('spaceAdminSub')     },
    PRO_AGENCE:    { label: td('spaceProAgence'),sub: td('spaceProAgenceSub') },
    AGENT_TERRAIN: { label: td('spaceAgent'),    sub: td('spaceAgentSub')     },
    BAILLEUR:      { label: td('spaceBailleur'), sub: ''                       },
    LOCATAIRE:     { label: td('spaceLocataire'),sub: td('spaceLocataireSub') },
  };

  const [open, setOpen]           = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tooltip, setTooltip]     = useState<{ label: string; top: number } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [now, setNow]             = useState(new Date());
  const pathname = usePathname();
  const isAdmin = roles.includes('ADMIN');

  /* ── Badges "action requise" (admin) — seedés côté serveur (layout.tsx),
     rendus vivants ici via Pusher (événements causés par d'autres
     utilisateurs) + un event window dédié (actions de l'admin lui-même sur
     ses propres pages, cf. espace/verifications, /reports, /bookings). ── */
  const [verifCount,    setVerifCount]    = useState(initialVerifCount);
  const [reportsCount,  setReportsCount]  = useState(initialReportsCount);
  const [disputesCount, setDisputesCount] = useState(initialDisputesCount);
  const visibleVerifCount    = pathname.includes('/verifications') ? 0 : verifCount;
  const visibleReportsCount  = pathname.includes('/reports')       ? 0 : reportsCount;
  const visibleDisputesCount = pathname.includes('/bookings')      ? 0 : disputesCount;
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const { user } = useUser();
  const { pending: localePending, setHasCustomOverlay } = useLocaleTransition();

  /* ── Déclare un skeleton dédié (sidebar+header+contenu) auprès du
     provider global, pour que l'overlay générique de la racine s'efface
     pendant qu'on est dans le dashboard. ── */
  useEffect(() => {
    setHasCustomOverlay(true);
    return () => setHasCustomOverlay(false);
  }, [setHasCustomOverlay]);

  /* ── Horloge (mise à jour chaque minute) ── */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  /* ── Badge messages non lus ──────────────────────────────── */
  const fetchUnread = useCallback(async () => {
    const token = await getToken().catch(() => null);
    if (!token) return;
    try {
      const rooms = await api.get<MessageRoom[]>('/messages/rooms', token);
      const count = rooms.filter((r) => r.messages?.[0] && !r.messages[0].readAt && r.messages[0].senderId !== userId).length;
      setUnreadCount(count);
    } catch {}
  }, [getToken]);

  useEffect(() => { void fetchUnread(); }, [fetchUnread]);

  /* Se met à jour quand MessagesShell reçoit/lit un message (même onglet) */
  useEffect(() => {
    const handler = () => void fetchUnread();
    window.addEventListener('aa-messages-updated', handler);
    return () => window.removeEventListener('aa-messages-updated', handler);
  }, [fetchUnread]);

  /* ── Badges admin "action requise" — refetch ciblé par compteur ──────── */
  const fetchVerifCount = useCallback(async () => {
    const token = await getToken().catch(() => null);
    if (!token) return;
    try {
      const r = await api.get<{ count: number }>('/verifications/pending-count', token);
      setVerifCount(r.count);
    } catch {}
  }, [getToken]);

  const fetchReportsCount = useCallback(async () => {
    const token = await getToken().catch(() => null);
    if (!token) return;
    try {
      const r = await api.get<{ count: number }>('/listings/reports/pending-count', token);
      setReportsCount(r.count);
    } catch {}
  }, [getToken]);

  const fetchDisputesCount = useCallback(async () => {
    const token = await getToken().catch(() => null);
    if (!token) return;
    try {
      const r = await api.get<{ count: number }>('/bookings/disputes/pending-count', token);
      setDisputesCount(r.count);
    } catch {}
  }, [getToken]);

  /* Rafraîchissements auto-provoqués : l'admin agit sur sa propre page
     (valider/assigner une vérif, approuver/refuser un déclin, suspendre une
     annonce signalée, trancher un litige) — même pattern que
     'aa-messages-updated' pour rester cohérent avec l'existant. */
  useEffect(() => {
    if (!isAdmin) return;
    const handler = (e: Event) => {
      const kind = (e as CustomEvent<{ kind?: string }>).detail?.kind;
      if (kind === 'VERIFICATIONS') void fetchVerifCount();
      else if (kind === 'REPORTS') void fetchReportsCount();
      else if (kind === 'DISPUTES') void fetchDisputesCount();
    };
    window.addEventListener('aa-badges-updated', handler);
    return () => window.removeEventListener('aa-badges-updated', handler);
  }, [isAdmin, fetchVerifCount, fetchReportsCount, fetchDisputesCount]);

  /* ── Pusher temps réel — événements causés par d'autres utilisateurs ─────
     Canal déjà utilisé par NotificationBell (même souscription, deux
     abonnés indépendants — Pusher-js le permet sans conflit) : on y ajoute
     ici deux écoutes dédiées aux badges, pour ne pas coupler leur logique à
     celle de la cloche (qui marque tout lu à l'ouverture). */
  useEffect(() => {
    if (!userId) return;
    const key  = process.env.NEXT_PUBLIC_SOKETI_APP_KEY  ?? '';
    const host = process.env.NEXT_PUBLIC_SOKETI_HOST     ?? 'localhost';
    const port = Number(process.env.NEXT_PUBLIC_SOKETI_PORT ?? '6001');
    if (!key) return;

    const useTLS = port === 443;
    const client = new Pusher(key, {
      cluster: 'mt1', wsHost: host, wsPort: port, wssPort: port,
      forceTLS: useTLS, enabledTransports: useTLS ? ['wss'] : ['ws'], disableStats: true,
    });
    const ch = client.subscribe(`user-${userId}`);

    // Badge Messages — tous rôles (signal léger, sans écriture DB ni cloche).
    ch.bind('unread-badge', () => void fetchUnread());

    // Badges admin — types de notification déjà envoyés aux admins.
    if (isAdmin) {
      ch.bind('notification', (notif: { type?: string }) => {
        if (notif?.type === 'LISTING_REPORTED') void fetchReportsCount();
        else if (notif?.type === 'BOOKING_DISPUTED') void fetchDisputesCount();
        else if (notif?.type === 'VERIF_DECLINE_REQUEST' || notif?.type === 'VERIF_REQUESTED') {
          void fetchVerifCount();
        }
      });
    }

    return () => { ch.unbind_all(); client.unsubscribe(`user-${userId}`); client.disconnect(); };
  }, [userId, isAdmin, fetchUnread, fetchReportsCount, fetchDisputesCount, fetchVerifCount]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => { if (!collapsed) setTooltip(null); }, [collapsed]);

  const chipRoles = userRole ? roles.filter((r) => r !== userRole) : roles;

  /* ── Last sign-in relative time ── */
  const lastSignInText = (() => {
    if (user?.lastSignInAt == null) return null;
    const diff = now.getTime() - new Date(user.lastSignInAt).getTime();
    const min  = Math.floor(diff / 60_000);
    const h    = Math.floor(min / 60);
    const d    = Math.floor(h / 24);
    if (d > 1)    return td('daysAgo',    { count: d });
    if (d === 1)  return td('yesterday');
    if (h >= 1)   return td('hoursAgo',   { count: h });
    if (min >= 1) return td('minutesAgo', { count: min });
    return td('justNow');
  })();

  return (
    <div className="dashboard-viewport flex overflow-hidden bg-bg">

      {/* Skeleton pleine page (sidebar + header + zone de travail) pendant
          un changement de langue — cf. DashboardSkeletonOverlay plus haut. */}
      {localePending && <DashboardSkeletonOverlay collapsed={collapsed} />}

      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Tooltip collapsed — position fixed pour échapper aux overflow parents */}
      {collapsed && tooltip && (
        <div
          className="pointer-events-none fixed z-200 -translate-y-1/2"
          style={{ top: tooltip.top, left: '4.5rem' }}
        >
          <div className="flex items-center gap-0">
            <div className="h-0 w-0 border-y-[5px] border-r-[6px] border-y-transparent border-r-gray-800" />
            <span className="rounded-md rounded-l-none bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg">
              {tooltip.label}
            </span>
          </div>
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-line bg-card
        transition-all duration-300
        lg:relative lg:inset-auto lg:z-auto lg:h-full lg:translate-x-0
        ${open ? 'translate-x-0' : '-translate-x-full'}
        ${collapsed ? 'w-16' : 'w-64'}
      `}>

        {/* ── En-tête espace ── */}
        <div className="relative flex h-14 shrink-0 items-center border-b border-line overflow-hidden">
          {/* Trait gold vertical */}
          <div className="absolute left-0 inset-y-0 w-1 bg-gold-dark rounded-r-full" />
          {collapsed ? (
            <div className="flex w-full items-center justify-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-pale">
                <i className="fa-solid fa-house text-gold-dark text-sm" />
              </span>
            </div>
          ) : (
            <div className="pl-5 pr-4">
              {(() => {
                const key = userRole ?? roles[0] ?? '';
                const info = SPACE_LABEL[key] ?? { label: td('spaceFallback'), sub: '' };
                return (
                  <>
                    <p className="text-xs font-semibold text-gold-dark uppercase tracking-widest leading-none">
                      {info.label}
                    </p>
                    {info.sub && (
                      <p className="text-[10px] text-sub mt-0.5 leading-none">{info.sub}</p>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          {/* Bouton fermeture mobile */}
          <button
            onClick={() => setOpen(false)}
            className="absolute right-3 lg:hidden flex h-11 w-11 items-center justify-center rounded-lg text-sub hover:bg-bg transition"
            aria-label={td('closeMenu')}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* ── Utilisateur + bouton collapse ── */}
        <div className="relative shrink-0 border-b border-line">
          {!collapsed ? (
            <div className="px-4 py-3 flex items-center gap-3">
              {/* Avatar cliquable → /profil */}
              <Link href="/profil" className="shrink-0 group relative">
                {userAvatar ? (
                  <div className="relative h-9 w-9 rounded-full overflow-hidden ring-2 ring-gold/20 group-hover:ring-gold/60 transition-all">
                    <Image src={userAvatar} alt={td('profilePhoto')} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-pale ring-2 ring-transparent group-hover:ring-gold/40 transition-all">
                    <span className="text-xs font-bold text-gold-dark">{userInitials}</span>
                  </div>
                )}
                {/* Overlay crayon au hover */}
                <span className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <i className="fa-solid fa-pen text-white text-[8px]" />
                </span>
              </Link>
              <div className="min-w-0">
                <Link href="/profil" className="text-sm font-semibold text-text truncate hover:text-gold-dark transition-colors block">
                  {userName}
                </Link>
                {userRole && (
                  <span className={`mt-0.5 inline-block text-[10px] px-1.5 py-0.5 rounded-full font-semibold leading-none ${DOMINANT_BADGE[userRole].className}`}>
                    {DOMINANT_BADGE[userRole].label}
                  </span>
                )}
                {chipRoles.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {chipRoles.map((r) => (
                      <span key={r} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${ROLE_COLORS[r] ?? 'bg-bg text-sub border border-line'}`}>
                        {ROLE_LABELS[r] ?? r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-3">
              <Link href="/profil" className="group relative">
                {userAvatar ? (
                  <div className="relative h-9 w-9 rounded-full overflow-hidden ring-2 ring-gold/20 group-hover:ring-gold/60 transition-all">
                    <Image src={userAvatar} alt={td('profilePhoto')} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-pale ring-2 ring-transparent group-hover:ring-gold/40 transition-all">
                    <span className="text-xs font-bold text-gold-dark">{userInitials}</span>
                  </div>
                )}
                <span className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <i className="fa-solid fa-pen text-white text-[8px]" />
                </span>
              </Link>
            </div>
          )}

          {/* Bouton collapse — bord droit, niveau nom */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? td('expandMenu') : td('collapseMenu')}
            className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 h-7 w-7 items-center justify-center rounded-full border border-line bg-card shadow-md text-sub hover:border-gold/60 hover:text-gold-dark transition-all"
          >
            <i className={`fa-solid fa-chevron-${collapsed ? 'right' : 'left'} text-[10px]`} />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              if (item.separator) {
                return (
                  <li key={`sep-${item.label}`} className="pt-3 pb-1">
                    {!collapsed && (
                      <p className="px-2.5 text-[10px] font-semibold uppercase tracking-widest text-sub/60">
                        {item.label}
                      </p>
                    )}
                    {collapsed && <div className="mx-auto w-4 border-t border-line" />}
                  </li>
                );
              }
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li
                  key={item.href}
                  onMouseEnter={(e) => {
                    if (!collapsed) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({ label: item.label, top: rect.top + rect.height / 2 });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <Link
                    href={item.href}
                    className={`flex items-center rounded-xl px-2.5 py-2 text-sm font-medium transition-colors
                      ${active ? 'text-gold-dark' : 'text-sub hover:text-text'}
                      ${collapsed ? 'justify-center gap-0' : 'gap-3'}
                    `}
                  >
                    {/* Icône avec fond animé + badge non lus */}
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                      {active && (
                        <motion.span
                          layoutId="nav-active-bg"
                          className="absolute inset-0 rounded-lg bg-gold-pale"
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        />
                      )}
                      <i className={`relative z-10 ${item.icon} text-sm`} />
                      {/* Badge non lus — uniquement sur l'item Messages */}
                      {item.href.includes('/messages') && unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                      {/* Badges "action requise" — admin uniquement */}
                      {item.href.includes('/verifications') && visibleVerifCount > 0 && (
                        <span className="absolute -top-1 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white leading-none">
                          {visibleVerifCount > 9 ? '9+' : visibleVerifCount}
                        </span>
                      )}
                      {item.href === '/espace/reports' && visibleReportsCount > 0 && (
                        <span className="absolute -top-1 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white leading-none">
                          {visibleReportsCount > 9 ? '9+' : visibleReportsCount}
                        </span>
                      )}
                      {item.href === '/espace/bookings' && visibleDisputesCount > 0 && (
                        <span className="absolute -top-1 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white leading-none">
                          {visibleDisputesCount > 9 ? '9+' : visibleDisputesCount}
                        </span>
                      )}
                    </span>
                    {!collapsed && (
                      <span className="flex-1 flex items-center justify-between">
                        {item.label}
                        {item.href.includes('/messages') && unreadCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                        {item.href.includes('/verifications') && visibleVerifCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white leading-none">
                            {visibleVerifCount > 9 ? '9+' : visibleVerifCount}
                          </span>
                        )}
                        {item.href === '/espace/reports' && visibleReportsCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white leading-none">
                            {visibleReportsCount > 9 ? '9+' : visibleReportsCount}
                          </span>
                        )}
                        {item.href === '/espace/bookings' && visibleDisputesCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white leading-none">
                            {visibleDisputesCount > 9 ? '9+' : visibleDisputesCount}
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Pied de sidebar ── */}
        <div className="shrink-0 border-t border-line px-2 py-3">
          <Link
            href="/"
            title={collapsed ? td('backToSite') : undefined}
            onMouseEnter={(e) => {
              if (!collapsed) return;
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({ label: td('backToSite'), top: rect.top + rect.height / 2 });
            }}
            onMouseLeave={() => setTooltip(null)}
            className={`flex items-center rounded-xl px-2.5 py-2 text-sm font-medium text-sub hover:text-text transition-colors
              ${collapsed ? 'justify-center gap-0' : 'gap-3'}
            `}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <i className="fa-solid fa-arrow-left text-sm" />
            </span>
            {!collapsed && td('backToSite')}
          </Link>
          <button
            onClick={() => void signOut({ redirectUrl: '/sign-in' })}
            title={collapsed ? td('signOut') : undefined}
            onMouseEnter={(e) => {
              if (!collapsed) return;
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({ label: td('signOut'), top: rect.top + rect.height / 2 });
            }}
            onMouseLeave={() => setTooltip(null)}
            className={`flex w-full items-center rounded-xl px-2.5 py-2 text-sm font-medium text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors
              ${collapsed ? 'justify-center gap-0' : 'gap-3'}
            `}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <i className="fa-solid fa-right-from-bracket text-sm" />
            </span>
            {!collapsed && td('signOut')}
          </button>
        </div>
      </aside>

      {/* ── Contenu principal ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Top bar mobile */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-card px-4 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-sub hover:bg-bg transition"
            aria-label={td('openMenu')}
          >
            <i className="fa-solid fa-bars" />
          </button>
          <Link href="/">
            <Image src="/images/LOGO.png" alt="AlloAppart" width={120} height={34} className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher currentLocale={locale as Locale} />
            <ThemeToggle />
            <NotificationBell userId={userId} />
          </div>
        </header>

        {/* Top bar desktop */}
        <header className="hidden lg:flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-card px-6">
          {/* ── Gauche : date, heure, dernière connexion ── */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <i className="fa-regular fa-calendar text-gold-dark text-[11px]" />
              <span className="text-xs font-medium text-text capitalize">
                {now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span className="h-3 w-px bg-line" />
              <i className="fa-regular fa-clock text-gold-dark text-[11px]" />
              <span className="text-xs font-semibold text-text">
                {now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {lastSignInText != null && (
              <p className="text-[10px] text-sub mt-0.5 leading-none">
                <i className="fa-solid fa-right-to-bracket text-[9px] mr-1" />
                {td('lastSignIn')} {lastSignInText}
              </p>
            )}
          </div>
          {/* ── Droite : langue, thème, cloche ── */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher currentLocale={locale as Locale} />
            <ThemeToggle />
            <NotificationBell userId={userId} />
          </div>
        </header>

        {isProAgence && <SubscriptionAlert />}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
