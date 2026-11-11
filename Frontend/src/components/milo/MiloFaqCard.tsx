'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { MiloFaqResult } from './types';
import { FAQ_LINKS } from './faqLinks';

interface Props {
  faq: MiloFaqResult;
  /** Reprend le texte tapé tel quel pour forcer une recherche classique
   * (bouton « Lancer une recherche à la place », correction d'une mauvaise
   * interprétation) — jamais de nouvel appel Milo, juste /listings?q=. */
  onSearchInstead: () => void;
  onClose: () => void;
  className?: string;
}

/**
 * Carte de réponse Milo FAQ (lot « Milo FAQ ») — composant partagé UNIQUE,
 * utilisé par MiloSearchBar (hero, /listings, footer, feuille mobile) et
 * par le header PC (NavbarClient) : jamais de duplication de ce rendu.
 * Reste sur la page courante, ne change jamais l'URL (règle 5).
 */
export default function MiloFaqCard({ faq, onSearchInstead, onClose, className = '' }: Props) {
  const t = useTranslations('miloFaq');
  const cardRef = useRef<HTMLDivElement>(null);

  // Focus déplacé sur la carte À SON APPARITION seulement (montage, deps
  // vides) — jamais ré-exécuté à chaque re-rendu du parent (MiloSearchBar
  // re-rend à chaque frappe), sans quoi `cardRef.current?.focus()` revolerait
  // le focus au clavier en boucle et bloquerait toute saisie dans le champ
  // juste après (bug trouvé en test : "AFTER RETYPE, input value = contact",
  // jamais mis à jour).
  useEffect(() => { cardRef.current?.focus(); }, []);

  // Échap la referme, comme les autres surfaces Milo (sheet/dropdown) — ce
  // listener, lui, peut se ré-attacher sans risque à chaque changement de
  // `onClose` (n'affecte jamais le focus).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const href = FAQ_LINKS[faq.id];
  // `faq.answerKey` est une donnée venue du Backend (liste fermée de sujets
  // + "unknown") — toujours résolue contre le namespace miloFaq, jamais du
  // texte libre.
  const text = t(faq.answerKey as Parameters<typeof t>[0]);

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      className={`rounded-xl border border-gold/30 bg-gold-pale/60 px-4 py-3 text-sm text-gold-dark outline-none dark:border-gold/20 dark:bg-gold-pale/10 ${className}`}
    >
      <div className="flex items-start gap-2">
        <i className="fa-solid fa-circle-info mt-0.5 shrink-0 text-xs" aria-hidden />
        <p className="flex-1">{text}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('closeLabel')}
          className="tap-target -mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gold-dark/70 transition-colors hover:text-gold-dark"
        >
          <i className="fa-solid fa-xmark text-sm" aria-hidden />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 pl-5">
        {href && (
          <Link
            href={href}
            className="text-xs font-semibold underline underline-offset-2 hover:text-gold-dark/80"
          >
            {t('linkLabel')}
          </Link>
        )}
        <button
          type="button"
          onClick={onSearchInstead}
          className="tap-target text-xs font-semibold underline underline-offset-2 hover:text-gold-dark/80"
        >
          {t('searchInsteadLabel')}
        </button>
      </div>
    </div>
  );
}
