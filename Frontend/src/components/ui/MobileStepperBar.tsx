'use client';

import { computeStepProgress } from '@/lib/stepperProgress';

interface MobileStepperBarProps {
  /** Étape courante, 0-indexée. */
  current: number;
  /** Nombre total d'étapes (ex. 6 pour /publier : 5 champs + récapitulatif). */
  total: number;
  /** Titre de l'étape courante (ex. "Type & titre"). */
  title: string;
  /** Texte déjà formaté ("Étape 2 sur 6"), laissé à l'appelant pour l'i18n. */
  stepLabel: string;
  isFirstStep: boolean;
  /** Revenir à l'étape précédente — ignoré si `isFirstStep`. */
  onBack: () => void;
  /** Quitter le formulaire — appelé uniquement si `isFirstStep`. */
  onQuit: () => void;
  quitLabel: string;
  backLabel: string;
}

/**
 * En-tête compact collé en haut d'un stepper, sous 768px uniquement
 * (`md:hidden`) : bouton retour/quitter 44px, "Étape X sur Y", titre de
 * l'étape, barre de progression. Remplace les pastilles d'étapes qui
 * débordent (`StepIndicator`) sur mobile sans toucher à son rendu ≥768px.
 * Réutilisable par /publier et, lot 6, le stepper d'édition bailleur.
 */
export default function MobileStepperBar({
  current, total, title, stepLabel, isFirstStep, onBack, onQuit, quitLabel, backLabel,
}: MobileStepperBarProps) {
  const progress = computeStepProgress(current, total);
  return (
    <div className="sticky top-0 z-40 border-b border-line bg-card/95 pt-[calc(var(--safe-top,0)+0.625rem)] pb-2.5 backdrop-blur md:hidden">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={isFirstStep ? onQuit : onBack}
          aria-label={isFirstStep ? quitLabel : backLabel}
          className="tap-target shrink-0 text-sub hover:text-text transition-colors"
        >
          <i className={`fa-solid ${isFirstStep ? 'fa-xmark' : 'fa-arrow-left'} text-base`} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sub">{stepLabel}</p>
          <p className="truncate text-sm font-bold text-text">{title}</p>
        </div>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-gold transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
