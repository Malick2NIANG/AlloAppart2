'use client';

import { useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import MiloSearchBar, { type MiloSearchBarHandle } from './MiloSearchBar';
import { MILO_EXAMPLES } from './examples';

/**
 * Hero accueil (lot 5a) : remplace le bouton « Rechercher » (PC) et la barre
 * blanche de recherche mobile — cf. PLAN_SEARCH_V0.md § 2.d. Les pastilles
 * d'exemples remplissent ET lancent la recherche en un clic (via la ref
 * exposée par MiloSearchBar), sans dupliquer la logique d'envoi.
 */
export default function MiloHeroSearch() {
  const t = useTranslations('home');
  const locale = useLocale() as 'fr' | 'en';
  const barRef = useRef<MiloSearchBarHandle>(null);
  const examples = MILO_EXAMPLES[locale] ?? MILO_EXAMPLES.fr;

  return (
    <div className="w-full">
      <MiloSearchBar
        ref={barRef}
        size="hero"
        placeholder={t('miloPlaceholder')}
        mobilePlaceholder={t('miloPlaceholderMobile')}
        ariaLabel={t('miloAriaLabel')}
      />
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => barRef.current?.fillAndSubmit(example)}
            className="tap-target rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
