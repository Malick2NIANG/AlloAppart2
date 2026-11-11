'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { classifyMiloQuery } from '@/lib/milo';
import type { MiloFaqResult } from './types';
import MiloFaqCard from './MiloFaqCard';

const ROTATION_MS = 3500;
const MAX_LENGTH = 300; // miroir de ParseQueryDto.text @MaxLength(300) — Backend/src/milo/dto/parse-query.dto.ts
const MIN_SUBMIT_LENGTH = 2;

interface Props {
  placeholder: string;
  ariaLabel: string;
  /** Étiquette du bouton « effacer » (croix) — FR/EN via l'appelant (next-intl). */
  clearLabel: string;
  initialValue?: string;
  autoFocus?: boolean;
  size?: 'hero' | 'compact';
  className?: string;
  /** Lot 5b : le tiroir /listings referme la barre après envoi. */
  onSubmitted?: () => void;
  /**
   * Lot 6.0 — accueil uniquement (`size="hero"`) : phrases qui alternent
   * dans le placeholder quand le champ est vide et sans focus. Calque
   * décoratif aria-hidden, l'étiquette accessible (`ariaLabel`) reste
   * statique — cf. commentaire sur le rendu plus bas.
   */
  rotatingPhrases?: readonly string[];
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Barre de recherche en langage naturel Milo — réutilisée sur l'accueil
 * (hero) et sur /listings (bouton « Demander à Milo »), cf.
 * PLAN_SEARCH_V0.md § 2.d : « déplie la même barre ».
 *
 * Honnêteté (Milo.md) : Milo comprend UNE recherche décrite en une phrase,
 * il ne converse pas — un seul champ, un seul envoi, pas de tour-par-tour.
 */
export default function MiloSearchBar({
  placeholder,
  ariaLabel,
  clearLabel,
  initialValue = '',
  autoFocus = false,
  size = 'hero',
  className = '',
  onSubmitted,
  rotatingPhrases,
}: Props) {
  const router = useRouter();
  const siteLocale = useLocale() as 'fr' | 'en';
  const [text, setText] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [faqResult, setFaqResult] = useState<MiloFaqResult | null>(null);
  const inputId = useId();
  const isHero = size === 'hero';

  // Rotation du placeholder (lot 6.0, hero uniquement) : s'arrête au focus,
  // dès qu'il y a du texte, ou si prefers-reduced-motion (phrase fixe,
  // jamais de minuteur lancé dans ce cas).
  useEffect(() => {
    if (!isHero || !rotatingPhrases || rotatingPhrases.length < 2) return;
    if (focused || text || prefersReducedMotion()) return;
    const timer = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % rotatingPhrases.length);
    }, ROTATION_MS);
    return () => clearInterval(timer);
  }, [isHero, rotatingPhrases, focused, text]);

  const submit = async (override?: string) => {
    const trimmed = (override ?? text).trim();
    // Pas de double envoi, pas de requête trop courte (< 2 caractères après trim).
    if (trimmed.length < MIN_SUBMIT_LENGTH || loading) return;
    setLoading(true);
    setFaqResult(null);

    try {
      // Logique partagée (lot « loupe du header », étendue lot « Milo FAQ »)
      // — mêmes replis/paramètres pour tous les points d'entrée Milo.
      const classification = await classifyMiloQuery(trimmed, siteLocale);
      if (classification.kind === 'faq') {
        // Reste sur la page, jamais de navigation — la carte s'affiche sous
        // la barre (règle 5 : jamais de changement d'URL pour une FAQ).
        setFaqResult(classification.faq);
        return;
      }
      router.push(`/listings?${classification.params.toString()}`);
      onSubmitted?.();
    } finally {
      setLoading(false);
    }
  };

  // Bouton « Lancer une recherche à la place » de la carte FAQ : ignore
  // Milo, force une recherche classique avec le même texte — jamais un
  // second appel Milo (corrige une mauvaise interprétation sans deviner
  // à nouveau).
  const searchInstead = () => {
    router.push(`/listings?q=${encodeURIComponent(text.trim())}`);
    setFaqResult(null);
    onSubmitted?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (faqResult) {
        setFaqResult(null);
        return;
      }
      setText('');
    }
  };

  const canSubmit = !loading && text.trim().length >= MIN_SUBMIT_LENGTH;

  return (
    // La className de l'appelant portait AVANT sur le <form> lui-même (ex.
    // `flex-1 min-w-0` dans un parent flex, ListingsFilters/NavbarClient) —
    // elle reste sur ce conteneur englobant pour ne rien changer au
    // dimensionnement existant ; le <form> garde ses propres classes de
    // base, inchangées, la carte FAQ s'empile juste en dessous.
    <div className={className}>
    <form
      role="search"
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      className={`group flex w-full items-center gap-3 rounded-full border shadow-lg transition-all duration-200 ${
        isHero
          ? 'h-14 border-black/5 bg-white/90 px-5 shadow-black/5 backdrop-blur-sm focus-within:shadow-xl focus-within:ring-2 focus-within:ring-gold/60 md:h-16 md:max-w-[680px] md:mx-auto dark:border-white/10 dark:bg-card/90'
          : 'border-line bg-card px-4 py-3'
      }`}
    >
      <i className={`fa-solid fa-wand-magic-sparkles shrink-0 text-gold-dark ${isHero ? '' : 'text-sm'}`} aria-hidden />
      <label htmlFor={inputId} className="sr-only">{ariaLabel}</label>

      <div className="relative min-w-0 flex-1">
        <input
          id={inputId}
          type="text"
          inputMode="search"
          autoFocus={autoFocus}
          value={text}
          maxLength={MAX_LENGTH}
          readOnly={loading}
          aria-busy={loading}
          onChange={(e) => { setText(e.target.value); if (faqResult) setFaqResult(null); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // Hero avec rotation : le placeholder natif reste vide, le calque
          // aria-hidden ci-dessous porte le texte visible — un screen
          // reader ne doit annoncer que l'étiquette statique (`ariaLabel`),
          // jamais une phrase qui change toutes les 3,5 s.
          placeholder={isHero && rotatingPhrases?.length ? '' : placeholder}
          className="w-full min-w-0 bg-transparent text-left text-[16px] text-text outline-none"
          aria-label={ariaLabel}
        />
        {isHero && rotatingPhrases && rotatingPhrases.length > 0 && !text && !focused && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center overflow-hidden text-[16px] text-sub/70"
          >
            <span key={phraseIndex} className="animate-fadeSwap truncate">
              {rotatingPhrases[phraseIndex % rotatingPhrases.length]}
            </span>
          </span>
        )}
      </div>

      {text && !loading && (
        <button
          type="button"
          onClick={() => setText('')}
          aria-label={clearLabel}
          className="tap-target flex shrink-0 items-center justify-center rounded-full text-sub transition-colors hover:text-text"
        >
          <i className="fa-solid fa-xmark text-sm" aria-hidden />
        </button>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        aria-label={ariaLabel}
        className={`tap-target flex shrink-0 items-center justify-center rounded-full bg-gold text-gray-900 transition-all duration-200 hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 ${
          isHero ? 'h-10 w-10 md:h-11 md:w-11' : 'h-9 w-9'
        }`}
      >
        {loading ? (
          <i className="fa-solid fa-circle-notch animate-spin text-sm" aria-hidden />
        ) : (
          <i className="fa-solid fa-arrow-right text-sm" aria-hidden />
        )}
      </button>
    </form>
    {faqResult && (
      <MiloFaqCard
        faq={faqResult}
        onSearchInstead={searchInstead}
        onClose={() => setFaqResult(null)}
        className={`mt-2 ${isHero ? 'md:max-w-[680px] md:mx-auto' : ''}`}
      />
    )}
    </div>
  );
}
