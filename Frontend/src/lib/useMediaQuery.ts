'use client';

import { useSyncExternalStore } from 'react';

function subscribeFactory(query: string) {
  return (callback: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', callback);
    return () => mql.removeEventListener('change', callback);
  };
}

const getServerSnapshot = () => false;

/** SSR-safe : rendu serveur = `false`, corrigé au montage (hydratation). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribeFactory(query),
    () => window.matchMedia(query).matches,
    getServerSnapshot,
  );
}

/** Seuil « mode application » partagé par la messagerie mobile (lot messagerie). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
