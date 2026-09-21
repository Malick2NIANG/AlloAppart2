'use client';

import { createContext, useContext, useMemo } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ToastContextValue {
  // `durationMs` optionnel : surcharge la durée d'affichage par défaut
  // (voir AUTO_DISMISS_MS dans ToastProvider) pour ce toast précis.
  addToast: (type: ToastType, message: string, durationMs?: number) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

// Bug réel corrigé ici : ce hook recréait un littéral objet `{ toast: {...} }`
// à CHAQUE appel, même quand `ctx` ne changeait pas — n'importe quel composant
// mettant `toast` dans un tableau de dépendances useCallback/useEffect (comme
// espace/reports/page.tsx::load) voyait donc cette dépendance changer à
// chaque rendu, ce qui re-déclenchait l'effet à l'infini. Observé concrètement
// sur la page Signalements admin : spinner de chargement bloqué en boucle +
// toast d'erreur empilé indéfiniment ("Erreur lors du chargement des
// signalements" répété des dizaines de fois). Mémoïsé sur `ctx` (lui-même
// désormais stable, voir ToastProvider.tsx) pour casser la boucle à la racine
// plutôt que de corriger un seul appelant.
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return useMemo(() => ({
    toast: {
      success: (message: string, durationMs?: number) => ctx.addToast('success', message, durationMs),
      error:   (message: string, durationMs?: number) => ctx.addToast('error',   message, durationMs),
      info:    (message: string, durationMs?: number) => ctx.addToast('info',    message, durationMs),
    },
  }), [ctx]);
}
