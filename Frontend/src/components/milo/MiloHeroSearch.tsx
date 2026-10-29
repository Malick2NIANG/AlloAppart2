'use client';

import { useLocale, useTranslations } from 'next-intl';
import MiloSearchBar from './MiloSearchBar';
import { MILO_EXAMPLES } from './examples';

/**
 * Hero accueil (lot 5a, finitions lot 6.0) : remplace le bouton
 * « Rechercher » (PC) et la barre blanche de recherche mobile — cf.
 * PLAN_SEARCH_V0.md § 2.d. Les pastilles d'exemples cliquables du lot 5a
 * ont été retirées (lot 6.0) : les mêmes phrases alternent désormais dans
 * le placeholder de la barre (rotatingPhrases), jamais cliquables.
 */
export default function MiloHeroSearch() {
  const t = useTranslations('home');
  const locale = useLocale() as 'fr' | 'en';
  const rotatingPhrases = MILO_EXAMPLES[locale] ?? MILO_EXAMPLES.fr;

  return (
    <div className="w-full">
      <MiloSearchBar
        size="hero"
        placeholder={t('miloPlaceholder')}
        ariaLabel={t('miloAriaLabel')}
        clearLabel={t('miloClear')}
        rotatingPhrases={rotatingPhrases}
      />
      {/* Ligne d'aide discrète (lot 6.0) : jamais de promesse de conversation. */}
      <p className="mt-3 text-center text-xs text-gray-300/80">
        {t('miloHelpLine')}
      </p>
    </div>
  );
}
