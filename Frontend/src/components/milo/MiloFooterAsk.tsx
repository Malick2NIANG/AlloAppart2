'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import MiloSearchBar from './MiloSearchBar';

interface Props {
  title: string;
  subtitle: string;
}

/**
 * Bloc « Demander à Milo » du pied de page : un bouton qui déplie la barre
 * Milo, avec une croix pour la refermer (même parcours que sur /listings et
 * dans le menu mobile). Les libellés du bouton et de la barre viennent du
 * namespace `listings` (déjà utilisés ailleurs) ; le titre et le sous-titre
 * sont passés par le pied de page (Server Component).
 */
export default function MiloFooterAsk({ title, subtitle }: Props) {
  const t = useTranslations('listings');
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-10 rounded-2xl border border-gold/30 bg-gold-pale/60 p-5 max-md:mb-8 max-md:p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-base font-bold text-text">
            <i className="fa-solid fa-wand-magic-sparkles text-gold-dark" aria-hidden />
            {title}
          </p>
          <p className="mt-1 text-sm text-sub">{subtitle}</p>
        </div>

        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="tap-target flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-full border border-gold/40 bg-card px-4 text-sm font-medium text-gold-dark transition-colors hover:bg-gold/20 md:self-auto"
          >
            <i className="fa-solid fa-wand-magic-sparkles text-xs" aria-hidden />
            {t('askMiloButton')}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 flex items-center gap-2">
          <MiloSearchBar
            size="compact"
            autoFocus
            className="min-w-0 flex-1"
            placeholder={t('askMiloButton')}
            ariaLabel={t('askMiloAriaLabel')}
            clearLabel={t('askMiloClear')}
            onSubmitted={() => setOpen(false)}
          />
          {/* Croix : referme la barre et ré-affiche le bouton. */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('askMiloClose')}
            className="tap-target flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-sub transition-colors hover:border-gold hover:text-text"
          >
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
