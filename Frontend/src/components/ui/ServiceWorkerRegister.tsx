'use client';

import { useEffect } from 'react';

/**
 * Enregistre /sw.js uniquement en production — jamais en développement,
 * pour éviter tout cache parasite pendant le dev (HMR, rebuilds). En dev,
 * désinscrit un éventuel service worker resté enregistré depuis une build
 * de production testée localement, pour ne pas servir de contenu périmé.
 * Ne rend rien (composant purement effectuel).
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    } else {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => { void registration.unregister(); });
      }).catch(() => {});
    }
  }, []);

  return null;
}
