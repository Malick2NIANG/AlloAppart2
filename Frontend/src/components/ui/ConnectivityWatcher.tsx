'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { isClerkRuntimeError } from '@clerk/nextjs/errors';
import { useToast } from './Toast';

const PROBE_INTERVAL_MS = 10_000;
const PROBE_TIMEOUT_MS = 4_000;

/**
 * Extrait l'origine de la Frontend API Clerk depuis la clé publique
 * (`pk_test_<base64>` / `pk_live_<base64>`, où le base64 décode vers
 * `<host>$`, ex. `diverse-grouper-74.clerk.accounts.dev$`). Toujours un hôte
 * externe réel — jamais `localhost` — quel que soit l'environnement (dev ou
 * prod), contrairement à notre propre origine ou à `NEXT_PUBLIC_API_URL`
 * (qui pointe vers `localhost:4000` en dev). C'est précisément ce qui en fait
 * une cible de sonde fiable (voir doc du composant ci-dessous).
 */
function getClerkFrontendApiOrigin(): string | null {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const match = key ? /^pk_(?:test|live)_(.+)$/.exec(key) : null;
  if (!match) return null;
  try {
    const host = atob(match[1]).replace(/\$+$/, '');
    return host ? `https://${host}` : null;
  } catch {
    return null;
  }
}

const PROBE_ORIGIN = getClerkFrontendApiOrigin();

/**
 * Composant sans rendu, monté une seule fois à la racine (voir app/layout.tsx).
 *
 * ⚠️ `navigator.onLine` et les événements `online`/`offline` du navigateur ne
 * sont PAS fiables pour détecter une vraie coupure : sur Windows notamment,
 * dès qu'une autre interface réseau reste "active" (carte virtuelle Docker
 * Desktop, VPN, Hyper-V…) — précisément le genre d'environnement de ce projet
 * — `navigator.onLine` continue de répondre `true` même wifi coupé, et
 * l'événement `offline` ne se déclenche jamais. On les garde comme signal
 * rapide quand ils fonctionnent, mais la source de vérité est une **sonde
 * active** : une requête réseau réelle vers un hôte externe, relancée
 * périodiquement, dont l'échec est le seul signal fiable de coupure réelle
 * quel que soit l'OS/navigateur.
 *
 * ⚠️ Piège corrigé : la première version de cette sonde ciblait `/favicon.svg`
 * (même origine que l'app). En développement, cette origine est `localhost`,
 * toujours joignable en boucle locale même wifi totalement coupé — la sonde
 * "réussissait" donc systématiquement, produisant un faux toast "connexion
 * rétablie" juste après un vrai échec Clerk détecté par ailleurs. La cible
 * doit être un hôte externe réel ; on utilise ici l'origine de la Frontend
 * API Clerk elle-même (dérivée de la clé publique, jamais `localhost`, et
 * directement pertinente puisque c'est cet hôte qu'on cherche à protéger).
 *
 * Trois sources alimentent le même état "hors ligne" (dédupliquées via
 * `offlineRef`, un seul toast par coupure, un seul au retour) :
 * 1. Sonde active périodique (toutes les 10s) + immédiate au montage et au
 *    retour au premier plan de l'onglet — la source fiable.
 * 2. Événements navigateur `online`/`offline` — signal rapide en complément,
 *    quand le navigateur les déclenche correctement.
 * 3. Erreurs réseau Clerk interceptées via `error`/`unhandledrejection` (le
 *    rejet vient d'une promesse interne à Clerk, pas d'un rendu React — un
 *    ErrorBoundary React ne le capturerait pas), sous deux formes :
 *    - Chargement initial : `ClerkRuntimeError` avec
 *      `code: "failed_to_load_clerk_js"`.
 *    - En cours de session (ex. `.../sessions/.../touch` périodique) :
 *      `Error` générique au message `"ClerkJS: Network error at ..."` (pas
 *      de `code` distinctif — détecté par préfixe de message).
 *
 *    ⚠️ En dev (`next dev`), l'overlay plein écran "Runtime ClerkRuntimeError"
 *    de Next.js peut malgré tout s'afficher par-dessus le toast : Next
 *    enregistre ses propres écouteurs `error`/`unhandledrejection` pour son
 *    overlay de développement, indépendamment de tout `preventDefault()` posé
 *    ici (ça n'empêche pas les AUTRES écouteurs de s'exécuter), et ce,
 *    sciemment — Next ne fournit aucune option pour désactiver cet overlay.
 *    Il n'existe pas du tout en production (`next build && next start`) :
 *    c'est uniquement là que le comportement "toast propre" doit être vérifié.
 */
export default function ConnectivityWatcher() {
  const t = useTranslations('connectivity');
  const { toast } = useToast();
  const offlineRef = useRef(false);
  const latestRef = useRef({ t, toast });

  // Garde `latestRef` à jour à chaque rendu sans faire dépendre l'effet
  // d'abonnement ci-dessous de `t`/`toast` (nouvelles références à chaque
  // rendu) — évite de désabonner/réabonner les listeners globaux en boucle.
  useEffect(() => {
    latestRef.current = { t, toast };
  });

  useEffect(() => {
    const markOffline = (message: string) => {
      if (offlineRef.current) return;
      offlineRef.current = true;
      latestRef.current.toast.error(message);
    };

    const markOnline = () => {
      if (!offlineRef.current) return;
      offlineRef.current = false;
      latestRef.current.toast.success(latestRef.current.t('backOnline'));
    };

    const probeConnectivity = async () => {
      // Sans origine externe dérivable (clé Clerk absente/malformée — ne
      // devrait pas arriver en pratique), on ne peut pas sonder de façon
      // fiable : on n'invente pas de faux positif/négatif, on s'appuie alors
      // uniquement sur les événements navigateur et la détection Clerk.
      if (!PROBE_ORIGIN) return;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      try {
        // `no-cors` : on ne lit jamais la réponse (opaque, y compris pour un
        // 404/403) — seul l'échec réseau (DNS, connexion refusée, timeout)
        // fait rejeter la promesse, ce qui est le seul signal qui nous
        // intéresse ici.
        await fetch(`${PROBE_ORIGIN}/?_=${Date.now()}`, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal,
        });
        markOnline();
      } catch {
        markOffline(latestRef.current.t('offline'));
      } finally {
        clearTimeout(timeoutId);
      }
    };

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

    const handleError = (event: ErrorEvent) => {
      if (isClerkNetworkIssue(event.error)) {
        event.preventDefault();
        markOffline(latestRef.current.t('authLoadFailed'));
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isClerkNetworkIssue(event.reason)) {
        event.preventDefault();
        markOffline(latestRef.current.t('authLoadFailed'));
      }
    };

    const handleOffline = () => markOffline(latestRef.current.t('offline'));

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void probeConnectivity();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', markOnline);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Sonde immédiate au montage (couvre aussi le cas "page rechargée sans
    // réseau", où l'événement `offline` ne se déclencherait jamais puisqu'il
    // n'y a pas de transition à détecter) puis en continu.
    void probeConnectivity();
    const intervalId = setInterval(() => void probeConnectivity(), PROBE_INTERVAL_MS);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', markOnline);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, []);

  return null;
}
