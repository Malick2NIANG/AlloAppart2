'use client';

import { forwardRef, useId, useImperativeHandle, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { parseQuery, strictFiltersToParams } from '@/lib/milo';

const MOBILE_QUERY = '(max-width: 640px)';

function subscribe(callback: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}
function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}
/** SSR-safe : rendu serveur = `false` (placeholder complet), corrigé au montage. */
function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

interface Props {
  placeholder: string;
  mobilePlaceholder?: string;
  ariaLabel: string;
  initialValue?: string;
  autoFocus?: boolean;
  size?: 'hero' | 'compact';
  className?: string;
  /** Lot 5b : le tiroir /listings referme la barre après envoi. */
  onSubmitted?: () => void;
}

/** Exposé via ref — utilisé par les pastilles d'exemples (lot 5a) pour
 * remplir ET lancer la recherche en un clic, sans dupliquer la logique
 * d'envoi hors du composant. */
export interface MiloSearchBarHandle {
  fillAndSubmit: (text: string) => void;
}

/**
 * Barre de recherche en langage naturel Milo — réutilisée à l'identique sur
 * l'accueil (hero) et sur /listings (bouton « Demander à Milo »), cf.
 * PLAN_SEARCH_V0.md § 2.d : « déplie la même barre ».
 *
 * Honnêteté (Milo.md) : Milo comprend UNE recherche décrite en une phrase,
 * il ne converse pas — un seul champ, un seul envoi, pas de tour-par-tour.
 */
const MiloSearchBar = forwardRef<MiloSearchBarHandle, Props>(function MiloSearchBar({
  placeholder,
  mobilePlaceholder,
  ariaLabel,
  initialValue = '',
  autoFocus = false,
  size = 'hero',
  className = '',
  onSubmitted,
}, ref) {
  const router = useRouter();
  const siteLocale = useLocale() as 'fr' | 'en';
  const [text, setText] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const inputId = useId();
  const isMobile = useIsMobile();
  const effectivePlaceholder = isMobile && mobilePlaceholder ? mobilePlaceholder : placeholder;

  const submit = async (override?: string) => {
    const trimmed = (override ?? text).trim();
    if (!trimmed || loading) return; // pas de double envoi, pas de requête vide
    setLoading(true);

    try {
      const result = await parseQuery(trimmed, siteLocale);

      if (!result) {
        // Repli silencieux : délai dépassé (4 s) ou erreur réseau/HTTP.
        router.push(`/listings?q=${encodeURIComponent(trimmed)}`);
        return;
      }

      if (!result.understood) {
        // « Non compris » : repli sur q, avec un signal discret (miloMiss)
        // pour que /listings affiche le message dédié plutôt qu'une simple
        // recherche texte classique silencieuse (PLAN § 2.d, parcours 5).
        const params = new URLSearchParams({ q: trimmed, miloMiss: '1', miloLang: result.detectedLanguage });
        router.push(`/listings?${params.toString()}`);
        return;
      }

      const params = new URLSearchParams(strictFiltersToParams(result.strictFilters));
      params.set('milo', '1');
      params.set('miloLang', result.detectedLanguage);
      params.set('miloText', trimmed);
      if (result.unmatchedTokens.length > 0) params.set('miloUnmatched', result.unmatchedTokens.join(','));
      // softPreferences conservées mais ignorées pour l'instant (lot 6).
      if (result.softPreferences.length > 0) params.set('prefs', result.softPreferences.join(','));
      router.push(`/listings?${params.toString()}`);
    } finally {
      setLoading(false);
      onSubmitted?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  };

  useImperativeHandle(ref, () => ({
    fillAndSubmit: (value: string) => {
      setText(value);
      void submit(value);
    },
  }));

  const isHero = size === 'hero';

  return (
    <div
      className={`flex w-full items-center gap-3 rounded-full border shadow-lg transition-colors ${
        isHero
          ? 'border-white/20 bg-white/95 px-5 py-3.5 dark:bg-card/95'
          : 'border-line bg-card px-4 py-3'
      } ${className}`}
    >
      <i className={`fa-solid fa-wand-magic-sparkles shrink-0 ${isHero ? 'text-gold-dark' : 'text-gold-dark text-sm'}`} aria-hidden />
      <label htmlFor={inputId} className="sr-only">{ariaLabel}</label>
      <input
        id={inputId}
        type="text"
        inputMode="search"
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={loading}
        placeholder={effectivePlaceholder}
        className={`min-w-0 flex-1 bg-transparent text-left outline-none placeholder:text-sub/70 ${
          isHero ? 'text-[16px] font-medium text-text' : 'text-[16px] text-text'
        }`}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={loading || !text.trim()}
        aria-label={ariaLabel}
        className={`tap-target flex shrink-0 items-center justify-center rounded-full bg-gold text-gray-900 transition-colors disabled:opacity-40 ${
          isHero ? 'h-11 w-11' : 'h-9 w-9'
        }`}
      >
        {loading ? (
          <i className="fa-solid fa-circle-notch animate-spin text-sm" aria-hidden />
        ) : (
          <i className="fa-solid fa-arrow-right text-sm" aria-hidden />
        )}
      </button>
    </div>
  );
});

export default MiloSearchBar;
