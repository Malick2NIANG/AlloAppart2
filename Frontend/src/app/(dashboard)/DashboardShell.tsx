'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface Props {
  userName: string;
  navItems: NavItem[];
  children: React.ReactNode;
}

export default function DashboardShell({ userName, navItems, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="flex min-h-screen bg-bg">

      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-card transition-transform duration-300 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Logo + fermeture */}
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <Link href="/" className="shrink-0">
            <Image src="/images/LOGO.png" alt="AlloAppart" width={140} height={40} className="h-10 w-auto" />
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-sub hover:bg-bg transition"
            aria-label="Fermer le menu"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Utilisateur */}
        <div className="border-b border-line px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-pale">
              <i className="fa-solid fa-user text-gold-dark text-sm" />
            </div>
            <p className="text-sm font-semibold text-text truncate">{userName}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                      active ? 'bg-gold-pale text-gold-dark' : 'text-sub hover:bg-bg hover:text-text'
                    }`}
                  >
                    <i className={`${item.icon} w-4 text-center text-sm`} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Retour site */}
        <div className="border-t border-line px-3 py-4">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sub hover:bg-bg hover:text-text transition"
          >
            <i className="fa-solid fa-arrow-left w-4 text-center text-sm" />
            Retour au site
          </Link>
        </div>
      </aside>

      {/* ── Contenu principal ── */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Top bar mobile */}
        <header className="flex h-16 items-center justify-between border-b border-line bg-card px-4 lg:hidden">
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

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
