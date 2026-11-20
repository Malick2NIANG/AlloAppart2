'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  /** Déclenche navigator.geolocation.getCurrentPosition — jamais appelé
   * ailleurs qu'au clic sur CE bouton (règle 5, Milo.md : pas de permission
   * sans geste utilisateur). */
  onActivate: () => void;
  /** Repli explicite : poursuit la recherche sans jamais demander la
   * position (filtres éventuels — type, équipements — conservés). */
  onSearchWithoutLocation: () => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  className?: string;
}

/**
 * Carte « près de moi » (lot « raccourci ») — même principe que
 * MiloFaqCard : reste sur la page, ne change jamais l'URL toute seule,
 * aucun fil de messages. Milo ne demande jamais la position lui-même ;
 * cette carte n'est qu'une invite, l'activation reste un geste explicite.
 */
export default function MiloNearMeCard({
  onActivate, onSearchWithoutLocation, onClose, loading, error, className = '',
}: Props) {
  const t = useTranslations('miloFaq');
  const cardRef = useRef<HTMLDivElement>(null);

  // Focus à l'apparition seulement (montage) — même précaution que
  // MiloFaqCard (jamais à chaque re-rendu, sans quoi le focus reviendrait
  // ici en boucle pendant que loading/error changent).
  useEffect(() => { cardRef.current?.focus(); }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      className={`rounded-xl border border-gold/30 bg-gold-pale/60 px-4 py-3 text-sm text-gold-dark outline-none dark:border-gold/20 dark:bg-gold-pale/10 ${className}`}
    >
      <div className="flex items-start gap-2">
        <i className="fa-solid fa-location-crosshairs mt-0.5 shrink-0 text-xs" aria-hidden />
        <p className="flex-1">{error ?? t('nearMePrompt')}</p>
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
        <button
          type="button"
          onClick={onActivate}
          disabled={loading}
          aria-busy={loading}
          className="tap-target rounded-full bg-gold-dark px-3 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-60"
        >
          {loading ? (
            <><i className="fa-solid fa-spinner fa-spin mr-1" aria-hidden />{t('nearMeLoading')}</>
          ) : t('nearMeActivate')}
        </button>
        <button
          type="button"
          onClick={onSearchWithoutLocation}
          className="tap-target text-xs font-semibold underline underline-offset-2 hover:text-gold-dark/80"
        >
          {t('searchInsteadLabel')}
        </button>
      </div>
    </div>
  );
}
