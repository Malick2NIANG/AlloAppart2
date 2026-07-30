'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useClerk, useAuth, useUser } from '@clerk/nextjs';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import type { MessageRoom } from '@/types';
import SubscriptionAlert from '@/components/ui/SubscriptionAlert';
import NotificationBell from '@/components/ui/NotificationBell';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  exact?: boolean;
  separator?: boolean; // si true, affiche un séparateur avec label au-dessus
}

const ROLE_COLORS: Record<string, string> = {
  LOCATAIRE:     'bg-blue-50 text-blue-700',
  BAILLEUR:      'bg-gold-pale text-gold-dark',
  PRO_AGENCE:    'bg-purple-50 text-purple-700',
  AGENT_TERRAIN: 'bg-emerald-50 text-emerald-700',
  ADMIN:         'bg-red-50 text-red-700',
};

const DOMINANT_BADGE_CLASS: Record<string, string> = {
  ADMIN:         'bg-red-100 text-red-700',
  PRO_AGENCE:    'bg-purple-100 text-purple-700',
  AGENT_TERRAIN: 'bg-blue-100 text-blue-700',
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
  children: React.ReactNode;
}

export default function DashboardShell({ userName, userId, roles, navItems, isProAgence = false, userRole, userAvatar, userInitials = '?', pendingVerifCount = 0, children }: Props) {
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
  const visibleVerifCount = pathname.includes('/verifications') ? 0 : pendingVerifCount;
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const { user } = useUser();

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

  /* Se met à jour quand MessagesShell reçoit/lit un message */
  useEffect(() => {
    const handler = () => void fetchUnread();
    window.addEventListener('aa-messages-updated', handler);
    return () => window.removeEventListener('aa-messages-updated', handler);
  }, [fetchUnread]);

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
    <div className="flex h-screen overflow-hidden bg-bg">

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
            className="absolute right-3 lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-sub hover:bg-bg transition"
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
                      {/* Badge vérifications en attente — admin uniquement */}
                      {item.href.includes('/verifications') && visibleVerifCount > 0 && (
                        <span className="absolute -top-1 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white leading-none">
                          {visibleVerifCount > 9 ? '9+' : visibleVerifCount}
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
            className={`flex w-full items-center rounded-xl px-2.5 py-2 text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors
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
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-sub hover:bg-bg transition"
            aria-label={td('openMenu')}
          >
            <i className="fa-solid fa-bars" />
          </button>
          <Link href="/">
            <Image src="/images/LOGO.png" alt="AlloAppart" width={120} height={34} className="h-8 w-auto" />
          </Link>
          <NotificationBell userId={userId} />
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
          {/* ── Droite : cloche ── */}
          <NotificationBell userId={userId} />
        </header>

        {isProAgence && <SubscriptionAlert />}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
