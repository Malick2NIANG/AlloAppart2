'use client';

import { useLocaleTransition } from './LocaleTransition';
import { SkeletonLine } from './Skeleton';

/**
 * Recouvre l'écran d'un skeleton pendant le changement de langue — sans ça,
 * l'ancien contenu reste figé jusqu'à ce que le nouveau payload serveur
 * (retraduit) arrive, puis bascule d'un coup : perçu comme un à-coup /
 * "coupure" plutôt qu'un chargement. Ici on montre explicitement qu'un
 * chargement est en cours, ce qui rend la transition lisible au lieu de
 * brutale. Monté une seule fois à la racine (cf. app/layout.tsx) ; se pilote
 * via le contexte partagé LocaleTransition, déclenché par LanguageSwitcher.
 */
export default function LocaleTransitionOverlay() {
  const { pending, hasCustomOverlay } = useLocaleTransition();
  // Le dashboard affiche son propre skeleton (sidebar + header + zone de
  // travail, cf. DashboardShell) — celui-ci ne doit alors pas se superposer.
  if (!pending || hasCustomOverlay) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[999] flex items-center justify-center bg-bg/80 backdrop-blur-sm transition-opacity"
    >
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-spinner fa-spin text-gold-dark text-sm" />
          <div className="h-3 w-24 animate-pulse rounded-full bg-line" />
        </div>
        <SkeletonLine width="80%" />
        <SkeletonLine width="100%" />
        <SkeletonLine width="60%" />
      </div>
    </div>
  );
}
