'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { isClerkRuntimeError } from '@clerk/nextjs/errors';
import { useToast } from './Toast';

/**
 * Composant sans rendu, monté une seule fois à la racine (voir app/layout.tsx).
 *
 * Trois choses surveillées :
 * 1. La connectivité réseau du navigateur (`online`/`offline`) — toast dès
 *    que la connexion tombe, et à la reconnexion.
 * 2. L'état déjà hors-ligne au montage (ex. page rechargée sans réseau) —
 *    sans ça, l'événement `offline` ne se déclencherait jamais puisqu'il n'y
 *    a pas de transition à détecter, et l'utilisateur ne verrait rien tant
 *    qu'il ne coupe/rétablit pas la connexion une nouvelle fois.
 * 3. Les erreurs réseau de Clerk, sous deux formes distinctes selon quand
 *    elles surviennent :
 *    - Au chargement initial : `ClerkRuntimeError` avec
 *      `code: "failed_to_load_clerk_js"` (le script `clerk.browser.js` n'a
 *      pas pu être récupéré).
 *    - En cours de session : Clerk fait périodiquement des appels réseau en
 *      arrière-plan pour maintenir la session active (ex. endpoint
 *      `.../sessions/.../touch`) ; si l'un échoue (pas de connexion réelle,
 *      même si le navigateur se croit "en ligne" — ex. wifi connecté mais
 *      routeur sans accès internet), Clerk lève une `Error` simple au
 *      message `"ClerkJS: Network error at ... - TypeError: Failed to
 *      fetch..."` (pas de `code` distinctif ici, contrairement au cas
 *      précédent — on détecte via le préfixe du message).
 *    Dans les deux cas on intercepte via les événements globaux
 *    `error`/`unhandledrejection` (le rejet vient d'une promesse interne à
 *    Clerk, pas d'un rendu React — un ErrorBoundary React ne le
 *    capturerait pas) et on affiche un toast clair à la place.
 *
 *    ⚠️ En dev (`next dev`), l'overlay plein écran "Runtime ClerkRuntimeError"
 *    de Next.js peut malgré tout s'afficher par-dessus : Next enregistre ses
 *    propres écouteurs `error`/`unhandledrejection` pour son overlay de
 *    développement, indépendamment de tout `preventDefault()` posé ici (ça
 *    n'empêche pas les AUTRES écouteurs de s'exécuter), et ce, sciemment —
 *    Next ne fournit aucune option pour désactiver cet overlay, précisément
 *    pour qu'aucune erreur ne puisse être masquée pendant le développement.
 *    Cet overlay n'existe pas du tout en production (`next build && next
 *    start`) : c'est uniquement là que le comportement "toast propre, pas
 *    d'écran d'erreur" doit être vérifié.
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
    // Reconnaît les deux formes d'erreur réseau Clerk (voir doc ci-dessus) :
    // l'échec de chargement du script (ClerkRuntimeError avec code dédié) et
    // l'échec d'un appel réseau en cours de session (Error générique, pas de
    // code — seul le préfixe de message identifie la source Clerk).
    const isClerkNetworkIssue = (err: unknown): boolean => {
      if (isClerkRuntimeError(err) && err.code === 'failed_to_load_clerk_js') return true;
      if (err instanceof Error && err.message.startsWith('ClerkJS:') && /network error/i.test(err.message)) {
        return true;
      }
      return false;
    };

    const notifyClerkNetworkIssue = () => {
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
      if (isClerkNetworkIssue(event.error)) {
        event.preventDefault();
        notifyClerkNetworkIssue();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isClerkNetworkIssue(event.reason)) {
        event.preventDefault();
        notifyClerkNetworkIssue();
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Si l'app démarre (ou ce composant se monte) alors que la connexion est
    // déjà coupée — ex. page rechargée sans réseau — l'événement `offline`
    // ne se déclenchera pas puisqu'il n'y a pas de transition à détecter.
    // On signale donc l'état immédiatement, sans attendre un rechargement ou
    // une future coupure. Différé en microtâche (plutôt qu'un appel
    // synchrone ici) pour rester après la passe de montage de l'effet.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      queueMicrotask(handleOffline);
    }

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
