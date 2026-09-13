'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { isClerkRuntimeError } from '@clerk/nextjs/errors';
import { useToast } from './Toast';

const PROBE_URL = '/favicon.svg';
const PROBE_INTERVAL_MS = 10_000;
const PROBE_TIMEOUT_MS = 4_000;

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
 * active** : une requête réseau réelle (même origine, `/favicon.svg`),
 * relancée périodiquement, dont l'échec est le seul signal fiable de coupure
 * réelle quel que soit l'OS/navigateur.
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      try {
        await fetch(`${PROBE_URL}?_=${Date.now()}`, {
          method: 'HEAD',
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
