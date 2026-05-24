'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import { useState, useEffect, useRef } from 'react';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import type { Locale } from '@/i18n/config';
import { api } from '@/lib/api';
import type { MessageRoom, User } from '@/types';

interface Labels {
  listings: string; search: string;
  mySpace: string;  login: string;  register: string;
  openMenu: string; closeMenu: string;
  searchPlaceholder: string;
}

interface Props { locale: Locale; labels: Labels; }

type DropdownKey = 'listings' | 'regions' | 'profile';
type DemoRole    = 'visitor' | 'locataire' | 'bailleur' | 'dual' | 'admin' | 'agent';

const LISTING_TYPES = [
  { key: 'APPARTEMENT', icon: 'fa-building',      fr: 'Appartements', en: 'Apartments'  },
  { key: 'STUDIO',      icon: 'fa-bed',            fr: 'Studios',      en: 'Studios'     },
  { key: 'VILLA',       icon: 'fa-house-user',     fr: 'Villas',       en: 'Villas'      },
  { key: 'BUREAU',      icon: 'fa-briefcase',      fr: 'Bureaux',      en: 'Offices'     },
  { key: 'CHAMBRE',     icon: 'fa-door-open',      fr: 'Chambres',     en: 'Rooms'       },
];



/* Demo users */
const DEMO_USERS: Record<Exclude<DemoRole, 'visitor'>, { name: string; initials: string; email: string }> = {
  locataire: { name: 'Mamadou Diallo',  initials: 'MD', email: 'mamadou@demo.sn'  },
  bailleur:  { name: 'Binta Sarr',      initials: 'BS', email: 'binta@demo.sn'    },
  dual:      { name: 'Ousmane Thiaw',   initials: 'OT', email: 'ousmane@demo.sn'  },
  admin:     { name: 'Modou Kane',      initials: 'MK', email: 'admin@demo.sn'    },
  agent:     { name: 'Awa Diop',        initials: 'AD', email: 'agent@demo.sn'    },
};

export default function NavbarClient({ locale, labels }: Props) {
  const { isSignedIn, getToken } = useAuth();
  const { signOut }    = useClerk();
  const { user }       = useUser();
  const pathname       = usePathname();
  const router         = useRouter();
  const searchParams   = useSearchParams();

  const [scrolled,       setScrolled]       = useState(false);
  const [mobileOpen,     setMobileOpen]     = useState(false);
  const [searchVal,      setSearchVal]      = useState('');
  const [minPrice,       setMinPrice]       = useState('');
  const [maxPrice,       setMaxPrice]       = useState('');
  const [openDropdown,   setOpenDropdown]   = useState<DropdownKey | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<'listings' | null>(null);
  const [demoRole,       setDemoRole]       = useState<DemoRole>('visitor');
  const [unreadCount,    setUnreadCount]    = useState(0);
  const [messagesHref,   setMessagesHref]   = useState<string | null>(null);

  const navRef  = useRef<HTMLDivElement>(null);
  const authRef = useRef<HTMLDivElement>(null);

  /* ── Labels locaux ───────────────────────────────────────── */
  const L = locale === 'en'
    ? { allListings: 'All listings', byType: 'By type', popularRegions: 'Popular regions', discover: 'Discover', mySpace: 'My Space' }
    : { allListings: 'Toutes les annonces', byType: 'Par type', popularRegions: 'Régions populaires', discover: 'Découvrir', mySpace: 'Espace' };

  /* ── Demo mode ───────────────────────────────────────────── */
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const stored = localStorage.getItem('aa_demo_role') as DemoRole | null;
    if (stored && ['visitor', 'locataire', 'bailleur', 'dual', 'admin', 'agent'].includes(stored)) setDemoRole(stored);
    const onDemoChange = (e: CustomEvent<DemoRole>) => setDemoRole(e.detail);
    window.addEventListener('aa-demo-change', onDemoChange as EventListener);
    return () => window.removeEventListener('aa-demo-change', onDemoChange as EventListener);
  }, []);

  /* ── Effective auth (real OR demo) ──────────────────────── */
  const effectiveSignedIn = isSignedIn || (demoRole !== 'visitor');
  const isDemo            = !isSignedIn && demoRole !== 'visitor';
  const demoData          = isDemo ? DEMO_USERS[demoRole as Exclude<DemoRole, 'visitor'>] : null;

  const userInitials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?'
    : demoData?.initials ?? '';
  const userName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.emailAddresses[0]?.emailAddress
    : demoData?.name ?? '';
  const userEmail = user
    ? user.emailAddresses[0]?.emailAddress
    : demoData?.email ?? '';

  /* ── Messages: href + unread count ─────────────────────── */
  useEffect(() => {
    if (!isSignedIn) return;
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const [me, rooms] = await Promise.all([
          api.get<User>('/auth/me', token),
          api.get<MessageRoom[]>('/messages/rooms', token),
        ]);
        const noMessages = me.roles.includes('ADMIN') || me.roles.includes('AGENT_TERRAIN');
        const href = noMessages
          ? null
          : me.roles.includes('BAILLEUR')
            ? '/bailleur/messages'
            : '/locataire/messages';
        setMessagesHref(href);
        const count = rooms.filter((r) => r.messages?.[0] && !r.messages[0].readAt).length;
        setUnreadCount(count);
      } catch {}
    });
  }, [isSignedIn, getToken]);

  /* ── Scroll ──────────────────────────────────────────────── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Click-outside dropdowns ─────────────────────────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideNav  = navRef.current?.contains(target) ?? false;
      const insideAuth = authRef.current?.contains(target) ?? false;
      if (!insideNav && !insideAuth) setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Sync search bar ─────────────────────────────────────── */
  useEffect(() => {
    if (!pathname.startsWith('/listings')) return;
    setSearchVal(searchParams.get('q') ?? '');
    setMinPrice(searchParams.get('min') ?? '');
    setMaxPrice(searchParams.get('max') ?? '');
  }, [searchParams, pathname]);

  /* ── Handlers ────────────────────────────────────────────── */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchVal.trim()) params.set('q', searchVal.trim());
    if (minPrice)         params.set('min', minPrice);
    if (maxPrice)         params.set('max', maxPrice);
    router.push(`/listings?${params.toString()}`);
  };

  const toggleDropdown = (key: DropdownKey) =>
    setOpenDropdown((prev) => (prev === key ? null : key));

  const handleSignOut = async () => {
    setOpenDropdown(null);
    if (isDemo) {
      localStorage.setItem('aa_demo_role', 'visitor');
      window.dispatchEvent(new CustomEvent('aa-demo-change', { detail: 'visitor' }));
      router.push('/');
      return;
    }
    await signOut({ redirectUrl: '/' });
  };

  const spaceHref = '/espace';

  /* ── Sub-components ──────────────────────────────────────── */
  const ListingsDropdown = () => (
    <div className="absolute top-full left-0 mt-2 w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-line rounded-2xl shadow-xl p-2 z-50">
      <Link href="/listings" onClick={() => setOpenDropdown(null)}
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-text hover:bg-gold-pale hover:text-gold-dark transition">
        <i className="fa-solid fa-list text-gold-dark text-xs w-4" />{L.allListings}
      </Link>
      <div className="border-t border-line my-1.5" />
      <p className="px-3 py-1 text-[11px] text-sub font-medium uppercase tracking-wide">{L.byType}</p>
      {LISTING_TYPES.map((type) => (
        <Link key={type.key} href={`/listings?type=${type.key}`} onClick={() => setOpenDropdown(null)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-text hover:bg-gold-pale hover:text-gold-dark transition">
          <i className={`fa-solid ${type.icon} text-gold-dark text-xs w-4`} />
          {locale === 'en' ? type.en : type.fr}
        </Link>
      ))}
    </div>
  );


  const ProfileDropdown = () => (
    <div className="absolute top-full right-0 mt-2 w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-line rounded-2xl shadow-xl p-2 z-50">
      {/* User info */}
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-text truncate">{userName}</p>
        <p className="text-xs text-sub truncate">{userEmail}</p>
        {isDemo && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            <i className="fa-solid fa-flask text-[9px]" /> Mode démo
          </span>
        )}
      </div>
      <div className="border-t border-line my-1" />

      {/* Settings */}
      {[
        { href: '/profil',          icon: 'fa-solid fa-user-circle',   label: locale === 'en' ? 'Profile'  : 'Mon profil' },
        { href: '/profil/securite', icon: 'fa-solid fa-shield-halved', label: locale === 'en' ? 'Security' : 'Sécurité'   },
      ].map((item) => (
        <Link key={item.href} href={item.href} onClick={() => setOpenDropdown(null)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-text hover:bg-gold-pale hover:text-gold-dark transition">
          <i className={`${item.icon} text-gold-dark text-xs w-4 text-center`} />
          {item.label}
        </Link>
      ))}

      <div className="border-t border-line my-1" />

      {/* Déconnexion */}
      <button onClick={handleSignOut}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition">
        <i className="fa-solid fa-right-from-bracket text-xs w-4 text-center" />
        Déconnexion
      </button>
    </div>
  );

  /* ── RENDER ──────────────────────────────────────────────── */
  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 glass ${
      scrolled ? 'shadow-[0_10px_25px_-20px_rgba(0,0,0,0.35)] border-b border-line' : 'border-b border-transparent'
    }`}>

      {/* Ligne dorée au scroll */}
      <div aria-hidden
        className={`absolute bottom-0 left-0 h-0.5 bg-linear-to-r from-gold/60 via-gold-dark/80 to-transparent transition-opacity duration-300 ${scrolled ? 'opacity-100' : 'opacity-0'}`}
        style={{ width: '60%' }}
      />

      <div className="aa-container">
        <div className="flex h-20 items-center gap-3 lg:gap-4">

          {/* ── Logo ─────────────────────────────────────────────── */}
          <Link href="/" aria-label="AlloAppart" className="shrink-0">
            <Image src="/images/LOGO.png" alt="AlloAppart" width={300} height={85}
              className="h-20 w-auto" priority />
          </Link>

          {/* ── Search pill ──────────────────────────────────────── */}
          <form onSubmit={handleSearch}
            className="hidden md:flex flex-1 items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 rounded-full border border-[rgba(250,204,21,0.35)] bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300 min-w-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <i className="fa-solid fa-location-dot text-gold-dark text-sm opacity-80 shrink-0" />
              <input name="q" type="text" value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Localité"
                className="min-w-0 flex-1 bg-transparent text-sm text-text placeholder:text-sub outline-none" />
            </div>
            <span className="hidden lg:block h-5 w-px bg-gray-200 dark:bg-white/15 shrink-0" />
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <i className="fa-solid fa-coins text-gold-dark text-xs opacity-80" />
              <input name="min" type="number" min="0" value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)} placeholder="Min"
                className="w-16 bg-transparent text-sm text-text placeholder:text-sub outline-none" />
            </div>
            <span className="hidden lg:block h-5 w-px bg-gray-200 dark:bg-white/15 shrink-0" />
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <i className="fa-solid fa-sack-dollar text-gold-dark text-xs opacity-80" />
              <input name="max" type="number" min="0" value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max"
                className="w-16 bg-transparent text-sm text-text placeholder:text-sub outline-none" />
            </div>
            <button type="submit"
              className="ml-1 flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-full bg-gold hover:bg-[#fddb4f] text-gray-900 font-semibold text-sm shadow-sm hover:shadow hover:scale-[1.02] transition-all duration-300 shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1C1C1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <span className="hidden lg:inline">{labels.search}</span>
            </button>
          </form>

          {/* ── Nav (lg+) ────────────────────────────────────────── */}
          <nav ref={navRef} className="hidden lg:flex items-center gap-1 shrink-0 relative">

            {/* Découvrir */}
            <div className="relative">
              <button onClick={() => toggleDropdown('listings')}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 ${pathname.startsWith('/listings') ? 'text-gold-dark' : 'text-text/85 hover:text-gold-dark'}`}>
                {L.discover}
                <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${openDropdown === 'listings' ? 'rotate-180' : ''}`} />
              </button>
              {openDropdown === 'listings' && <ListingsDropdown />}
            </div>

            {/* Espace — visible uniquement si connecté */}
            {effectiveSignedIn && (
              <Link href={spaceHref}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                  pathname.startsWith('/espace') || pathname.startsWith('/onboarding')
                    ? 'text-gold-dark'
                    : 'text-text/85 hover:text-gold-dark'
                }`}>
                <i className="fa-solid fa-grip-vertical text-[11px]" />
                {L.mySpace}
              </Link>
            )}
          </nav>

          {/* ── Actions droite ────────────────────────────────────── */}
          <div className="ml-auto flex items-center gap-1.5 lg:gap-2 shrink-0">
            <LanguageSwitcher currentLocale={locale} />
            <ThemeToggle />

            {effectiveSignedIn ? (
              /* ── CONNECTÉ ── */
              <div ref={authRef} className="hidden lg:flex items-center gap-1 relative">

                {/* Messages — hidden for ADMIN/AGENT_TERRAIN (null href) */}
                {messagesHref !== null && (
                  <Link href={messagesHref}
                    className="relative flex h-9 w-9 items-center justify-center rounded-full text-text/70 hover:bg-card hover:text-gold-dark transition">
                    <i className="fa-solid fa-comment-dots text-[17px]" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4.25 w-4.25 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>
                )}

                {/* Favoris */}
                <Link href="/espace"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-text/70 hover:bg-card hover:text-red-500 transition">
                  <i className="fa-solid fa-heart text-[17px]" />
                </Link>

                {/* Avatar + dropdown */}
                <div className="relative ml-1">
                  <button onClick={() => toggleDropdown('profile')}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-bold text-xs transition-all duration-200 ${
                      openDropdown === 'profile'
                        ? 'border-gold bg-gold text-gray-900'
                        : 'border-gold/50 bg-gold-pale text-gold-dark hover:border-gold'
                    }`}>
                    {userInitials}
                  </button>
                  {openDropdown === 'profile' && <ProfileDropdown />}
                </div>
              </div>
            ) : (
              /* ── VISITEUR ── */
              <div className="hidden lg:flex items-center gap-2">
                <Link href="/sign-in"
                  className="rounded-full border border-[rgba(250,204,21,0.60)] px-4 py-2 text-sm font-semibold text-text transition hover:bg-[rgba(250,204,21,0.10)] hover:scale-105">
                  {labels.login}
                </Link>
                <Link href="/sign-up" className="btn-gold py-2! px-4! text-sm!">
                  {labels.register}
                </Link>
              </div>
            )}

            {/* Burger mobile */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? labels.closeMenu : labels.openMenu}
              aria-expanded={mobileOpen}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-line hover:bg-card transition"
            >
              <i className={`fa-solid ${mobileOpen ? 'fa-xmark' : 'fa-bars'} text-sub`} />
            </button>
          </div>

        </div>
      </div>

      {/* ── Drawer mobile ─────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden glass border-t border-line px-4 pb-5 pt-3">

          {/* Recherche */}
          <form onSubmit={handleSearch} className="mb-3 grid gap-2 p-3 rounded-2xl border border-line bg-white/90 dark:bg-slate-800/90">
            <input type="text" name="q" value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Quartier, ville, mot-clé…"
              className="w-full rounded-lg border border-line bg-gray-50 dark:bg-slate-700 px-3 py-2 text-sm text-text placeholder:text-sub outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" name="min" min="0" value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)} placeholder="Min FCFA"
                className="rounded-lg border border-line bg-gray-50 dark:bg-slate-700 px-3 py-2 text-sm text-text placeholder:text-sub outline-none" />
              <input type="number" name="max" min="0" value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max FCFA"
                className="rounded-lg border border-line bg-gray-50 dark:bg-slate-700 px-3 py-2 text-sm text-text placeholder:text-sub outline-none" />
            </div>
            <button type="submit" className="w-full btn-gold rounded-xl px-4 py-2.5 font-medium justify-center">
              {labels.search}
            </button>
          </form>

          {/* Nav mobile */}
          <nav className="flex flex-col gap-1">

            {/* Découvrir */}
            <div>
              <button onClick={() => setMobileExpanded((p) => p === 'listings' ? null : 'listings')}
                className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-sub hover:bg-card hover:text-text transition">
                {L.discover}
                <i className={`fa-solid fa-chevron-down text-xs transition-transform duration-200 ${mobileExpanded === 'listings' ? 'rotate-180' : ''}`} />
              </button>
              {mobileExpanded === 'listings' && (
                <div className="ml-4 mt-1 flex flex-col gap-0.5">
                  <Link href="/listings" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-text hover:bg-gold-pale hover:text-gold-dark transition">
                    <i className="fa-solid fa-list text-gold-dark text-xs w-4" />{L.allListings}
                  </Link>
                  {LISTING_TYPES.map((type) => (
                    <Link key={type.key} href={`/listings?type=${type.key}`} onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-text hover:bg-gold-pale hover:text-gold-dark transition">
                      <i className={`fa-solid ${type.icon} text-gold-dark text-xs w-4`} />
                      {locale === 'en' ? type.en : type.fr}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Espace — visible uniquement si connecté */}
            {effectiveSignedIn && (
              <Link href={spaceHref} onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-sub hover:bg-card hover:text-text transition">
                <i className="fa-solid fa-grip-vertical text-gold-dark text-xs w-4" />{L.mySpace}
              </Link>
            )}
          </nav>

          {/* Auth mobile */}
          <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
            {effectiveSignedIn ? (
              <>
                {/* User info */}
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-card">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-gold/50 bg-gold-pale text-xs font-bold text-gold-dark">
                    {userInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{userName}</p>
                    <p className="text-xs text-sub truncate">{userEmail}</p>
                  </div>
                </div>

                {/* Messages — hidden for ADMIN/AGENT_TERRAIN (null href) */}
                {messagesHref !== null && (
                  <Link href={messagesHref}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-text hover:bg-card transition">
                    <span className="flex items-center gap-3">
                      <i className="fa-solid fa-comment-dots text-gold-dark w-4" /> Messages
                    </span>
                    {unreadCount > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>
                )}

                {/* Favoris */}
                <Link href="/espace" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-text hover:bg-card transition">
                  <i className="fa-solid fa-heart text-red-400 w-4" /> Favoris
                </Link>

                <div className="border-t border-line pt-2 mt-1 flex flex-col gap-1">
                  {[
                    { href: '/profil',          icon: 'fa-solid fa-user-circle',   label: locale === 'en' ? 'Profile'  : 'Mon profil' },
                    { href: '/profil/securite', icon: 'fa-solid fa-shield-halved', label: locale === 'en' ? 'Security' : 'Sécurité'   },
                  ].map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-text hover:bg-gold-pale hover:text-gold-dark transition">
                      <i className={`${item.icon} text-gold-dark text-xs w-4`} />{item.label}
                    </Link>
                  ))}
                </div>

                <button onClick={() => { setMobileOpen(false); handleSignOut(); }}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition">
                  <i className="fa-solid fa-right-from-bracket w-4 text-xs" /> Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link href="/sign-in" onClick={() => setMobileOpen(false)} className="btn-outline justify-center text-text">
                  {labels.login}
                </Link>
                <Link href="/sign-up" onClick={() => setMobileOpen(false)} className="btn-gold justify-center">
                  {labels.register}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
