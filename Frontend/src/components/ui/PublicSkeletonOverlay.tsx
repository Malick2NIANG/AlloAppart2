'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useLocaleTransition } from './LocaleTransition';
import {
  HeroSkeleton, StatsRowSkeleton, CardsSectionSkeleton, ListingDetailSkeleton,
  VitrineSkeleton, ProseDocSkeleton,
} from './Skeleton';

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

/* HeroSkeleton, StatsRowSkeleton, CardsSectionSkeleton (ex-CardsGridSkeleton),
   VitrineSkeleton : importés de Skeleton.tsx (un seul endroit définit ces
   gabarits, réutilisés ici ET par loading.tsx — lot skeletons). Les 2
   gabarits ci-dessous gardent un wrapper <main>/padding local propre à cet
   overlay plein écran (loading.tsx n'en a pas besoin, le <main> du layout
   suffit), d'où une fine enveloppe locale autour des pièces importées. */
function DetailPageSkeleton() {
  return (
    <main className="px-4 py-10">
      <div className="aa-container">
        <ListingDetailSkeleton />
      </div>
    </main>
  );
}

function ProseDocWrapperSkeleton() {
  return (
    <main className="px-4 py-16">
      <ProseDocSkeleton />
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
        <CardsSectionSkeleton count={8} />
      </>
    );
  }
  if (pathname === '/agences') return <CardsSectionSkeleton count={8} />;
  if (/^\/agences\/[^/]+$/.test(pathname)) return <VitrineSkeleton />;
  if (PROSE_ROUTES.includes(pathname)) return <ProseDocWrapperSkeleton />;
  if (GRID_ROUTES.includes(pathname) || pathname.startsWith('/regions/')) {
    return <CardsSectionSkeleton count={6} />;
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
