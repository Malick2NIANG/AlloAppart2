'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useClerk, useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import type { MessageRoom } from '@/types';
import SubscriptionAlert from '@/components/ui/SubscriptionAlert';
import NotificationBell from '@/components/ui/NotificationBell';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  exact?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  LOCATAIRE:     'Locataire',
  BAILLEUR:      'Bailleur',
  PRO_AGENCE:    'Agence PRO',
  AGENT_TERRAIN: 'Agent terrain',
  ADMIN:         'Admin',
};

const ROLE_COLORS: Record<string, string> = {
  LOCATAIRE:     'bg-blue-50 text-blue-700',
  BAILLEUR:      'bg-gold-pale text-gold-dark',
  PRO_AGENCE:    'bg-purple-50 text-purple-700',
  AGENT_TERRAIN: 'bg-emerald-50 text-emerald-700',
  ADMIN:         'bg-red-50 text-red-700',
};

type DominantRole = 'ADMIN' | 'PRO_AGENCE' | 'AGENT_TERRAIN';

const DOMINANT_BADGE: Record<DominantRole, { label: string; className: string }> = {
  ADMIN:         { label: 'Admin',         className: 'bg-red-100 text-red-700'        },
  PRO_AGENCE:    { label: 'Agence PRO',    className: 'bg-purple-100 text-purple-700'  },
  AGENT_TERRAIN: { label: 'Agent terrain', className: 'bg-blue-100 text-blue-700'      },
};

const SPACE_LABEL: Record<string, { label: string; sub: string }> = {
  ADMIN:         { label: 'Admin',           sub: 'Tableau de bord' },
  PRO_AGENCE:    { label: 'Espace Agence',   sub: 'Pro' },
  AGENT_TERRAIN: { label: 'Espace Agent',    sub: 'Terrain' },
  BAILLEUR:      { label: 'Espace Bailleur', sub: '' },
  LOCATAIRE:     { label: 'Espace',          sub: 'Locataire' },
};

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
  // Effacer le badge quand on est déjà sur la page vérifications
  const [open, setOpen]           = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tooltip, setTooltip]     = useState<{ label: string; top: number } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const visibleVerifCount = pathname.includes('/verifications') ? 0 : pendingVerifCount;
  const { signOut } = useClerk();
  const { getToken } = useAuth();

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
                const info = SPACE_LABEL[key] ?? { label: 'Mon espace', sub: '' };
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
            aria-label="Fermer le menu"
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
                    <Image src={userAvatar} alt="Photo de profil" fill className="object-cover" />
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
                    <Image src={userAvatar} alt="Photo de profil" fill className="object-cover" />
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
            title={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
            className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 h-7 w-7 items-center justify-center rounded-full border border-line bg-card shadow-md text-sub hover:border-gold/60 hover:text-gold-dark transition-all"
          >
            <i className={`fa-solid fa-chevron-${collapsed ? 'right' : 'left'} text-[10px]`} />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
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
            title={collapsed ? 'Retour au site' : undefined}
            onMouseEnter={(e) => {
              if (!collapsed) return;
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({ label: 'Retour au site', top: rect.top + rect.height / 2 });
            }}
            onMouseLeave={() => setTooltip(null)}
            className={`flex items-center rounded-xl px-2.5 py-2 text-sm font-medium text-sub hover:text-text transition-colors
              ${collapsed ? 'justify-center gap-0' : 'gap-3'}
            `}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <i className="fa-solid fa-arrow-left text-sm" />
            </span>
            {!collapsed && 'Retour au site'}
          </Link>
          <button
            onClick={() => void signOut({ redirectUrl: '/sign-in' })}
            title={collapsed ? 'Se déconnecter' : undefined}
            onMouseEnter={(e) => {
              if (!collapsed) return;
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({ label: 'Se déconnecter', top: rect.top + rect.height / 2 });
            }}
            onMouseLeave={() => setTooltip(null)}
            className={`flex w-full items-center rounded-xl px-2.5 py-2 text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors
              ${collapsed ? 'justify-center gap-0' : 'gap-3'}
            `}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <i className="fa-solid fa-right-from-bracket text-sm" />
            </span>
            {!collapsed && 'Se déconnecter'}
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
            aria-label="Ouvrir le menu"
          >
            <i className="fa-solid fa-bars" />
          </button>
          <Link href="/">
            <Image src="/images/LOGO.png" alt="AlloAppart" width={120} height={34} className="h-8 w-auto" />
          </Link>
          <NotificationBell userId={userId} />
        </header>

        {/* Top bar desktop */}
        <header className="hidden lg:flex h-14 shrink-0 items-center justify-end gap-3 border-b border-line bg-card px-6">
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
