'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useLocaleTransition } from './LocaleTransition';
import { SkeletonLine } from './Skeleton';

/**
 * Skeleton du site public (navbar + contenu), affiché pendant le changement
 * de langue à la place du skeleton générique de la racine — cf. le
 * DashboardSkeletonOverlay équivalent pour le dashboard. Monté une seule
 * fois dans (public)/layout.tsx ; se déclare auprès du provider partagé
 * (LocaleTransition) pour que l'overlay générique s'efface.
 *
 * Le contenu (sous la navbar) varie selon la page — reproduit la structure
 * réelle des pages les plus visitées (accueil, listes, fiches détail,
 * vitrine agence, pages de texte) plutôt qu'un unique gabarit générique.
 */

function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-line ${className}`} />;
}

/* ── Navbar — même structure que NavbarClient.tsx (logo, barre de recherche,
   liens, actions droite selon connecté/non connecté) ── */
function NavbarSkeleton({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="border-b border-line glass">
      <div className="aa-container">
        <div className="flex h-20 items-center gap-3 lg:gap-4">
          <Pulse className="h-9 w-32 shrink-0 rounded-lg" />

          <div className="hidden md:flex flex-1 items-center gap-3 rounded-full border border-line bg-card px-4 py-2.5">
            <Pulse className="h-4 w-full max-w-xs rounded-full" />
          </div>

          <div className="hidden lg:flex items-center gap-2 shrink-0 px-1">
            <Pulse className="h-4 w-20 rounded-full" />
            <Pulse className="h-4 w-16 rounded-full" />
          </div>

          <div className="ml-auto flex items-center gap-1.5 lg:gap-2 shrink-0">
            <Pulse className="h-9 w-16 rounded-full" />
            <Pulse className="h-9 w-9 rounded-full" />
            {signedIn ? (
              <div className="hidden lg:flex items-center gap-1.5">
                <Pulse className="h-9 w-9 rounded-full" />
                <Pulse className="h-9 w-9 rounded-full" />
                <Pulse className="h-9 w-9 rounded-full" />
              </div>
            ) : (
              <div className="hidden lg:flex items-center gap-2">
                <Pulse className="h-9 w-24 rounded-full" />
                <Pulse className="h-9 w-28 rounded-full" />
              </div>
            )}
            <Pulse className="lg:hidden h-11 w-11 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Accueil : héro plein écran + rangée de stats + grille d'annonces ── */
function HeroSkeleton() {
  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center gap-5 bg-linear-to-br from-slate-800 to-slate-950 px-4 py-24 text-center">
      <Pulse className="h-11 w-full max-w-lg bg-white/15" />
      <Pulse className="h-11 w-2/3 max-w-sm bg-white/15" />
      <Pulse className="mt-2 h-4 w-full max-w-md bg-white/10" />
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Pulse className="h-12 w-40 rounded-full bg-white/20" />
        <Pulse className="h-12 w-48 rounded-full bg-white/10" />
      </div>
    </section>
  );
}

function StatsRowSkeleton() {
  return (
    <section className="border-t border-line bg-bg px-4 py-14">
      <div className="aa-container grid grid-cols-1 gap-8 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-3 px-8 py-4">
            <Pulse className="h-9 w-20" />
            <Pulse className="h-3 w-24" />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Grille de cartes (annonces / agences) — accueil, /listings, /agences,
   /regions/[slug], /favoris, /search partagent tous cette forme ── */
function CardsGridSkeleton({ count = 8, title = true }: { count?: number; title?: boolean }) {
  return (
    <section className="bg-bg px-4 py-14">
      <div className="aa-container">
        {title && (
          <div className="mb-8 space-y-2">
            <Pulse className="h-7 w-64 max-w-full" />
            <Pulse className="h-4 w-80 max-w-full" />
          </div>
        )}
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-line">
              <Pulse className="h-56 w-full rounded-none" />
              <div className="space-y-2.5 p-4">
                <Pulse className="h-4 w-3/4" />
                <Pulse className="h-3 w-1/2" />
                <Pulse className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Fiche détail : /listings/[id], /bookings/[id] — galerie + panneau
   latéral (infos + CTA) ── */
function DetailPageSkeleton() {
  return (
    <main className="px-4 py-10">
      <div className="aa-container grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Pulse className="h-96 w-full rounded-2xl" />
          <Pulse className="h-6 w-2/3" />
          <Pulse className="h-4 w-1/3" />
          <div className="space-y-2 pt-2">
            <SkeletonLine width="100%" />
            <SkeletonLine width="92%" />
            <SkeletonLine width="96%" />
            <SkeletonLine width="80%" />
          </div>
        </div>
        <div className="h-fit space-y-4 rounded-2xl border border-line p-5">
          <Pulse className="h-7 w-1/2" />
          <Pulse className="h-10 w-full rounded-xl" />
          <Pulse className="h-10 w-full rounded-xl" />
          <Pulse className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </main>
  );
}

/* ── Vitrine agence : /agences/[slug] — bandeau héro compact (logo, nom,
   stats) puis grille d'annonces, cf. AgenceClientShell.tsx ── */
function VitrineSkeleton() {
  return (
    <>
      <section className="flex flex-col items-center gap-3 bg-linear-to-br from-slate-900 to-slate-950 px-5 py-10 text-center">
        <Pulse className="h-16 w-16 rounded-2xl bg-white/20" />
        <Pulse className="h-5 w-48 bg-white/20" />
        <Pulse className="h-3 w-64 max-w-full bg-white/10" />
      </section>
      <CardsGridSkeleton count={6} title={false} />
    </>
  );
}

/* ── Pages de texte : /cgu, /confidentialite, /cookies, /a-propos,
   /plan-du-site — titre + longues lignes de prose ── */
function ProseDocSkeleton() {
  return (
    <main className="px-4 py-16">
      <div className="mx-auto max-w-3xl space-y-4">
        <Pulse className="h-8 w-1/2" />
        <div className="space-y-2.5 pt-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonLine key={i} width={i % 3 === 2 ? '65%' : '100%'} />
          ))}
        </div>
      </div>
    </main>
  );
}

/* ── Repli générique — pages transactionnelles moins visitées (messages,
   profil, favoris vide, publier, onboarding, paiement, vérification…) ── */
function GenericSkeleton() {
  return (
    <main className="px-4 py-14">
      <div className="aa-container space-y-6">
        <div className="space-y-2">
          <Pulse className="h-7 w-64 max-w-full" />
          <Pulse className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Pulse key={i} className="h-32 w-full" />)}
        </div>
      </div>
    </main>
  );
}

const PROSE_ROUTES = ['/cgu', '/confidentialite', '/cookies', '/a-propos', '/plan-du-site'];
const GRID_ROUTES  = ['/listings', '/favoris', '/search'];

function ContentSkeleton({ pathname }: { pathname: string }) {
  if (pathname === '/') {
    return (
      <>
        <HeroSkeleton />
        <StatsRowSkeleton />
        <CardsGridSkeleton count={8} />
      </>
    );
  }
  if (pathname === '/agences') return <CardsGridSkeleton count={8} />;
  if (/^\/agences\/[^/]+$/.test(pathname)) return <VitrineSkeleton />;
  if (PROSE_ROUTES.includes(pathname)) return <ProseDocSkeleton />;
  if (GRID_ROUTES.includes(pathname) || pathname.startsWith('/regions/')) {
    return <CardsGridSkeleton count={6} />;
  }
  if (/^\/listings\/[^/]+$/.test(pathname) || /^\/bookings\/[^/]+$/.test(pathname)) {
    return <DetailPageSkeleton />;
  }
  return <GenericSkeleton />;
}

export default function PublicSkeletonOverlay() {
  const { pending, setHasCustomOverlay } = useLocaleTransition();
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    setHasCustomOverlay(true);
    return () => setHasCustomOverlay(false);
  }, [setHasCustomOverlay]);

  if (!pending) return null;

  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-[999] overflow-hidden bg-bg">
      <NavbarSkeleton signedIn={!!isSignedIn} />
      <div className="max-h-[calc(100vh-5rem)] overflow-hidden">
        <ContentSkeleton pathname={pathname} />
      </div>
    </div>
  );
}
