'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import SubscriptionAlert from '@/components/ui/SubscriptionAlert';

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

interface Props {
  userName: string;
  roles: string[];
  navItems: NavItem[];
  isProAgence?: boolean;
  userRole?: DominantRole | null;
  children: React.ReactNode;
}

export default function DashboardShell({ userName, roles, navItems, isProAgence = false, userRole, children }: Props) {
  const [open, setOpen]           = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tooltip, setTooltip]     = useState<{ label: string; top: number } | null>(null);
  const pathname = usePathname();

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

        {/* ── Logo ── */}
        <div className="relative flex h-16 shrink-0 items-center justify-center border-b border-line">
          {collapsed ? (
            <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-pale">
              <i className="fa-solid fa-house text-gold-dark text-base" />
            </Link>
          ) : (
            <Link href="/" className="shrink-0">
              <Image src="/images/LOGO.png" alt="AlloAppart" width={160} height={46} className="h-12 w-auto" priority />
            </Link>
          )}
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
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-pale">
                <i className="fa-solid fa-user text-gold-dark text-sm" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text truncate">{userName}</p>
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
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-pale">
                <i className="fa-solid fa-user text-gold-dark text-sm" />
              </div>
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
                    {/* Icône avec fond animé Framer Motion */}
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                      {active && (
                        <motion.span
                          layoutId="nav-active-bg"
                          className="absolute inset-0 rounded-lg bg-gold-pale"
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        />
                      )}
                      <i className={`relative z-10 ${item.icon} text-sm`} />
                    </span>
                    {!collapsed && item.label}
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
          <div className="w-9" />
        </header>

        {isProAgence && <SubscriptionAlert />}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
