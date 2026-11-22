'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface Props {
  /** Repli si aucun historique same-origin (lien partagé, nouvel onglet, arrivée directe). */
  fallbackHref?: string;
  /**
   * `true` (défaut) : la barre mobile est toujours visible — réservé aux
   * pages sans AUCUNE autre navigation (ex. /tarifs, /publier non connecté).
   * `false` : comme le lien PC, la barre mobile n'apparaît elle aussi que
   * depuis une carte FAQ (?from=aide) — pour les pages qui ont déjà une
   * navigation principale (onglets du bas, barre latérale) et où un bouton
   * retour permanent ferait doublon ; seul le retour vers la question FAQ
   * ouverte manque réellement.
   */
  mobileAlways?: boolean;
}

/**
 * Lot « boutons retour » (culs-de-sac FAQ/aide) — composant partagé UNIQUE,
 * posé sur les pages sans navigation de retour claire. Même style pilule
 * que le bouton retour déjà utilisé par /a-propos, /cookies, /plan-du-site
 * (aucune nouvelle variante visuelle, aucune duplication de ce motif) :
 * - mobile (<768px) : toujours visible sur une page listée comme cul-de-sac,
 *   quelle que soit l'origine — style app, navigation de sous-page normale.
 * - PC (≥768px) : UNIQUEMENT quand on arrive depuis une carte FAQ (marqueur
 *   ?from=aide) — sinon le PC reste strictement inchangé (aucun rendu,
 *   aucun saut de mise en page).
 *
 * Destination : `router.back()` si l'historique vient du même site
 * (document.referrer same-origin, seul signal fiable côté client qu'une
 * vraie page du site précède celle-ci dans l'onglet) ; sinon repli vers
 * `/aide` (avec le sujet d'origine si connu) ou vers `fallbackHref`.
 */
export default function BackButton({ fallbackHref = '/', mobileAlways = true }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromAide = searchParams.get('from') === 'aide';
  const sujet = searchParams.get('sujet');
  const t = useTranslations('backButton');
  const label = fromAide ? t('backToAide') : t('back');

  const handleClick = () => {
    if (hasSameOriginHistory()) {
      router.back();
      return;
    }
    if (fromAide) {
      router.push(sujet ? `/aide?sujet=${encodeURIComponent(sujet)}` : '/aide');
      return;
    }
    router.push(fallbackHref);
  };

  // `display` n'est jamais dans ce socle : chaque variant pose ses propres
  // utilitaires `hidden`/`inline-flex` (préfixés et non préfixés) — les
  // mélanger dans un socle commun fait gagner l'utilitaire non préfixé le
  // plus bas dans la feuille de styles générée par Tailwind, QUEL QUE SOIT
  // l'écran (bug constaté : les deux boutons restaient visibles ensemble
  // en mobile tant que le socle contenait lui-même `inline-flex`).
  const pillClassName =
    'tap-target mb-8 items-center gap-2 rounded-full border border-line px-4 py-1.5 text-xs font-medium text-sub hover:border-gold/50 hover:text-gold-text transition-all';

  if (!mobileAlways && !fromAide) return null;

  return (
    <>
      {(mobileAlways || fromAide) && (
        <button type="button" onClick={handleClick} aria-label={label} className={`${pillClassName} inline-flex md:hidden`}>
          <i className="fa-solid fa-arrow-left text-[10px]" aria-hidden />
          {label}
        </button>
      )}
      {fromAide && (
        <button type="button" onClick={handleClick} aria-label={label} className={`${pillClassName} hidden md:inline-flex`}>
          <i className="fa-solid fa-arrow-left text-[10px]" aria-hidden />
          {label}
        </button>
      )}
    </>
  );
}

function hasSameOriginHistory(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  if (!document.referrer) return false;
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}
