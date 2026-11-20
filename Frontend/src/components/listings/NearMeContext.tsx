'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Lot « raccourci » (vérification confidentialité) — la position de
 * l'utilisateur ne doit JAMAIS transiter par l'adresse de /listings (ni
 * donc par l'historique, un lien copié/partagé, ou un aperçu OG). Elle vit
 * uniquement ici, dans un état React monté au-dessus du routeur
 * (RootLayout) : elle survit à une navigation client-side (d'où la barre
 * Milo peut activer « près de moi » sur l'accueil puis pousser vers
 * /listings sans jamais mettre lat/lng dans l'URL de destination), mais
 * JAMAIS à un rechargement complet de page — ni sessionStorage ni
 * localStorage, exactement ce qui est demandé.
 */
interface NearMeState {
  /** true seulement une fois une position confirmée — jamais vrai sans lat/lng. */
  active: boolean;
  lat: number | null;
  lng: number | null;
  setPosition: (lat: number, lng: number) => void;
  clear: () => void;
}

const NearMeContext = createContext<NearMeState | null>(null);

export function NearMeProvider({ children }: { children: ReactNode }) {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const value = useMemo<NearMeState>(() => ({
    active: lat !== null && lng !== null,
    lat,
    lng,
    setPosition: (newLat: number, newLng: number) => { setLat(newLat); setLng(newLng); },
    clear: () => { setLat(null); setLng(null); },
  }), [lat, lng]);

  return <NearMeContext.Provider value={value}>{children}</NearMeContext.Provider>;
}

export function useNearMe(): NearMeState {
  const ctx = useContext(NearMeContext);
  if (!ctx) throw new Error('useNearMe doit être appelé sous NearMeProvider');
  return ctx;
}
