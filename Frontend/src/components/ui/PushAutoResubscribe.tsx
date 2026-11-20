'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useLocale } from 'next-intl';
import { isPushEnabledOnThisDevice, isPushSupported, subscribeToPush } from '@/lib/push';

/**
 * Lot « notifications push » — au retour (rechargement, réouverture de
 * l'app), ne se réabonne QUE si la permission navigateur est déjà accordée
 * ET que ce réglage a déjà été activé sur CET appareil : jamais de nouvelle
 * demande de permission ici (ce composant ne rend rien et ne déclenche
 * aucune UI), jamais si l'utilisateur a coupé le réglage. Silencieux en cas
 * d'échec — l'utilisateur peut toujours réactiver depuis les réglages.
 */
export default function PushAutoResubscribe() {
  const { isSignedIn, getToken } = useAuth();
  const locale = useLocale();

  useEffect(() => {
    if (!isSignedIn) return;
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (!isPushEnabledOnThisDevice()) return;
    if (!isPushSupported(navigator, window)) return;

    void (async () => {
      const token = await getToken().catch(() => null);
      if (!token) return;
      await subscribeToPush(token, locale).catch(() => {});
    })();
  }, [isSignedIn, getToken, locale]);

  return null;
}
