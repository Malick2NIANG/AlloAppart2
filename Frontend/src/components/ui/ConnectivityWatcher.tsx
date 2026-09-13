'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { isClerkRuntimeError } from '@clerk/nextjs/errors';
import { useToast } from './Toast';

/**
 * Composant sans rendu, monté une seule fois à la racine (voir app/layout.tsx).
 *
 * Deux choses surveillées :
 * 1. La connectivité réseau du navigateur (`online`/`offline`) — toast dès
 *    que la connexion tombe, et à la reconnexion.
 * 2. Les échecs de chargement du script Clerk (`ClerkRuntimeError` avec
 *    `code: "failed_to_load_clerk_js"`), qui surviennent typiquement quand
 *    la connexion coupe pendant le chargement initial de l'app. Sans ça,
 *    l'utilisateur se retrouve face à une erreur brute (visible en dev via
 *    l'overlay Next.js "Runtime ClerkRuntimeError") ou une app silencieusement
 *    cassée en prod. On intercepte via les événements globaux `error` /
 *    `unhandledrejection` (le rejet vient d'une promesse interne à Clerk,
 *    pas d'un rendu React — un ErrorBoundary React ne le capturerait pas) et
 *    on affiche un toast clair à la place.
 */
export default function ConnectivityWatcher() {
  const t = useTranslations('connectivity');
  const { toast } = useToast();
  const clerkWarnedRef = useRef(false);
  const latestRef = useRef({ t, toast });

  // Garde `latestRef` à jour à chaque rendu sans faire dépendre l'effet
  // d'abonnement ci-dessous de `t`/`toast` (nouvelles références à chaque
  // rendu) — évite de désabonner/réabonner les listeners globaux en boucle.
  useEffect(() => {
    latestRef.current = { t, toast };
  });

  useEffect(() => {
    const notifyClerkLoadFailure = () => {
      if (clerkWarnedRef.current) return;
      clerkWarnedRef.current = true;
      latestRef.current.toast.error(latestRef.current.t('authLoadFailed'));
    };

    const handleOffline = () => {
      latestRef.current.toast.error(latestRef.current.t('offline'));
    };

    const handleOnline = () => {
      latestRef.current.toast.success(latestRef.current.t('backOnline'));
      // Une reconnexion peut permettre à Clerk de réussir un futur essai ;
      // on réarme l'avertissement pour ne pas rater un nouvel échec.
      clerkWarnedRef.current = false;
    };

    const handleError = (event: ErrorEvent) => {
      if (isClerkRuntimeError(event.error) && event.error.code === 'failed_to_load_clerk_js') {
        event.preventDefault();
        notifyClerkLoadFailure();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isClerkRuntimeError(event.reason) && event.reason.code === 'failed_to_load_clerk_js') {
        event.preventDefault();
        notifyClerkLoadFailure();
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
