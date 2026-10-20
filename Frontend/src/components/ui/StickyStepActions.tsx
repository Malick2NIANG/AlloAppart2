'use client';

interface StickyStepActionsProps {
  /** Bouton(s) d'action (ex. un bouton icône "Précédent" + un bouton principal). */
  children: React.ReactNode;
  /** Message de validation/API à afficher juste au-dessus des boutons. */
  error?: string | null;
}

/**
 * Barre d'actions collée en bas d'un stepper, sous 768px uniquement
 * (`md:hidden`). Le conteneur parent doit être `max-md:flex max-md:flex-col
 * max-md:min-h-dvh` (voir /publier/page.tsx) : la barre devient alors le
 * dernier enfant d'une colonne flex pleine hauteur et se comporte en pied de
 * page "collant" (position: sticky — pas fixed) qui reste au-dessus du
 * clavier virtuel, contrairement à `position: fixed` dont le comportement
 * est peu fiable face au clavier sur mobile Safari/Chrome. Réutilisable par
 * /publier et, lot 6, le stepper d'édition bailleur.
 */
export default function StickyStepActions({ children, error }: StickyStepActionsProps) {
  return (
    <div className="sticky bottom-0 z-40 mt-6 border-t border-line bg-card/95 pb-[calc(var(--safe-bottom,0)+0.75rem)] pt-3 backdrop-blur md:hidden">
      {error && (
        <p className="mb-2.5 flex items-center gap-1.5 text-xs text-red-500">
          <i className="fa-solid fa-circle-exclamation shrink-0" /> {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        {children}
      </div>
    </div>
  );
}
