'use client';

import { createContext, useContext, useMemo, useState, useTransition } from 'react';

interface LocaleTransitionContextValue {
  /** true pendant le changement de langue (attente du re-render serveur). */
  pending: boolean;
  /** Enrobe l'action de changement de langue dans une transition React
   *  partagée — permet à `LocaleTransitionOverlay` (monté une seule fois,
   *  à la racine) de savoir quand afficher son skeleton, quel que soit
   *  l'endroit d'où `LanguageSwitcher` est rendu (navbar publique, header
   *  du dashboard, etc.). */
  run: (action: () => Promise<void> | void) => void;
  /** Un shell avec sa propre mise en page (ex. DashboardShell : sidebar +
   *  header + zone de travail) se déclare ici pour afficher SON skeleton
   *  fidèle à sa mise en page à la place du skeleton générique de la
   *  racine — évite d'avoir les deux superposés. */
  hasCustomOverlay: boolean;
  setHasCustomOverlay: (v: boolean) => void;
}

const LocaleTransitionContext = createContext<LocaleTransitionContextValue | null>(null);

export function LocaleTransitionProvider({ children }: { children: React.ReactNode }) {
  const [pending, startTransition] = useTransition();
  const [hasCustomOverlay, setHasCustomOverlay] = useState(false);

  const value = useMemo<LocaleTransitionContextValue>(() => ({
    pending,
    run: (action) => startTransition(action),
    hasCustomOverlay,
    setHasCustomOverlay,
  }), [pending, hasCustomOverlay]);

  return (
    <LocaleTransitionContext.Provider value={value}>
      {children}
    </LocaleTransitionContext.Provider>
  );
}

export function useLocaleTransition(): LocaleTransitionContextValue {
  const ctx = useContext(LocaleTransitionContext);
  if (!ctx) {
    // Filet de sécurité si jamais utilisé hors provider — ne bloque pas le
    // changement de langue, juste pas de skeleton (comportement pré-fix).
    return { pending: false, run: (action) => { void action(); }, hasCustomOverlay: false, setHasCustomOverlay: () => {} };
  }
  return ctx;
}
