import { api } from './api';

export type PushUiState =
  | 'unsupported'
  | 'ios-not-installed'
  | 'denied'
  | 'default'
  | 'enabled';

export interface PushEnvironment {
  /** `serviceWorker` + `PushManager` + `Notification` tous présents. */
  supported: boolean;
  permission: NotificationPermission;
  isIOS: boolean;
  isStandalone: boolean;
}

/**
 * Résout l'état à afficher — fonction PURE, testable sans navigateur. L'ordre
 * compte : un iPhone non installé est signalé AVANT « non supporté » (Safari
 * en onglet normal n'expose souvent pas PushManager du tout, même sur iOS
 * 16.4+ — ce serait sinon confondu avec un appareil réellement incapable).
 */
export function resolvePushUiState(env: PushEnvironment): PushUiState {
  if (env.isIOS && !env.isStandalone) return 'ios-not-installed';
  if (!env.supported) return 'unsupported';
  if (env.permission === 'denied') return 'denied';
  if (env.permission === 'granted') return 'enabled';
  return 'default';
}

/** iPhone/iPod uniquement — le texte du lot ne parle que d'iPhone (iPad,
 * souvent identifié comme "Mac" avec écran tactile depuis iPadOS 13, est hors
 * périmètre explicite ici). */
export function detectIsIOS(userAgent: string): boolean {
  return /iPhone|iPod/.test(userAgent);
}

/** `navigator.standalone` (Safari) OU `display-mode: standalone` (générique,
 * y compris PWA installée via Chrome/Android — vérifié par robustesse même
 * si le lot ne cible qu'iPhone). */
export function detectIsStandalone(
  nav: { standalone?: boolean },
  matchMedia: ((query: string) => { matches: boolean }) | undefined,
): boolean {
  if (nav.standalone === true) return true;
  if (typeof matchMedia === 'function') {
    return matchMedia('(display-mode: standalone)').matches;
  }
  return false;
}

export function isPushSupported(
  nav: unknown,
  win: unknown,
): boolean {
  return (
    !!nav &&
    typeof nav === 'object' &&
    'serviceWorker' in nav &&
    !!win &&
    typeof win === 'object' &&
    'PushManager' in win &&
    'Notification' in win
  );
}

/** Format requis par `PushManager.subscribe({ applicationServerKey })` — la
 * clé VAPID publique arrive en base64 URL-safe depuis le Backend. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/** Réglage PAR APPAREIL (jamais par compte — un même compte peut avoir un
 * appareil coupé et un autre actif) : mémorise seulement que CET appareil a
 * déjà été activé une fois, pour savoir s'il faut se réabonner silencieusement
 * au retour (permission déjà accordée) — jamais pour décider d'afficher une
 * demande de permission. */
const PUSH_DEVICE_ENABLED_KEY = 'allo-push-device-enabled';

export function isPushEnabledOnThisDevice(): boolean {
  try {
    return localStorage.getItem(PUSH_DEVICE_ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setPushEnabledOnThisDevice(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(PUSH_DEVICE_ENABLED_KEY, '1');
    else localStorage.removeItem(PUSH_DEVICE_ENABLED_KEY);
  } catch {
    // Stockage indisponible (navigation privée, quota) — tant pis, pas bloquant.
  }
}

interface SubscriptionKeysJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** S'abonne : clé VAPID publique (Backend) → permission navigateur →
 * `pushManager.subscribe()` → envoi de l'abonnement au Backend. Ne doit être
 * appelé QUE sur un geste utilisateur (jamais au chargement) — la demande de
 * permission par le navigateur l'exige de toute façon pour la plupart des
 * navigateurs modernes, mais l'appelant (le composant Réglages) est
 * responsable de ne déclencher ceci qu'au clic. */
export async function subscribeToPush(
  token: string,
  locale: string,
): Promise<void> {
  const { publicKey } = await api.get<{ publicKey: string | null }>(
    '/push/vapid-public-key',
    token,
  );
  if (!publicKey) {
    throw new Error('Notifications push indisponibles (clés VAPID absentes côté serveur).');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permission refusée.');
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    // Cast : lib.dom généralise Uint8Array<ArrayBufferLike>, PushManager
    // attend un buffer concret — toujours un vrai ArrayBuffer à l'exécution.
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });
  const json = subscription.toJSON() as SubscriptionKeysJson;

  await api.post(
    '/push/subscribe',
    {
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent.slice(0, 200),
      locale,
    },
    token,
  );
  setPushEnabledOnThisDevice(true);
}

/** Désabonne CET appareil uniquement — à la déconnexion (téléphone partagé)
 * et au clic manuel « Couper sur cet appareil ». Silencieux si aucun
 * abonnement actif (déjà désabonné, support absent) : jamais d'erreur. */
export async function unsubscribeFromPush(token?: string): Promise<void> {
  setPushEnabledOnThisDevice(false);
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription().catch(() => null);
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => {});
  if (token) {
    await api.delete('/push/subscribe', token, { endpoint }).catch(() => {});
  }
}
