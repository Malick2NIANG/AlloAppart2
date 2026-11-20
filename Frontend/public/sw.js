// Service worker AlloAppart — écrit à la main, aucune bibliothèque.
//
// RÈGLE D'OR (lot 0d) : aucun cache hors-ligne des pages connectées, des
// pages HTML (hors /offline) ni de l'API — jamais. Risque à éviter : servir
// à un utilisateur des données périmées ou celles d'un autre compte.
//
// Ne traite QUE les requêtes GET de même origine (cf. getCacheStrategy) :
//   - cache-first   : /_next/static/*, /icons/*, polices (mêmes règles)
//   - navigate      : documents HTML — réseau uniquement, repli sur /offline
//                     (pré-cachée à l'installation) si le réseau échoue
//   - network-only  : tout le reste — API, Clerk, Soketi/WebSocket,
//                     Cloudinary, OpenStreetMap, POST, requêtes avec
//                     Authorization, toute autre origine — jamais intercepté
//                     ni mis en cache, passe directement au réseau natif.

const CACHE_VERSION = 'alloappart-v1';
const STATIC_CACHE = CACHE_VERSION + '-static';
const OFFLINE_URL = '/offline';
const PRECACHE_URLS = [OFFLINE_URL];

/**
 * Détermine la stratégie à appliquer à une requête. Fonction PURE (aucun
 * accès à `self`/`caches`/`fetch`) — testable isolément avec Vitest, sans
 * contexte service worker. `selfOrigin` est injectable pour les tests ;
 * dans le vrai service worker, on passe `self.location.origin`.
 *
 * @param {{ url: string, method: string, isNavigate?: boolean }} request
 * @param {string} selfOrigin
 * @returns {'network-only' | 'navigate' | 'cache-first'}
 */
function getCacheStrategy(request, selfOrigin) {
  const method = (request && request.method) || 'GET';
  if (method !== 'GET') return 'network-only';

  let url;
  try {
    url = new URL(request.url, selfOrigin);
  } catch {
    return 'network-only';
  }

  if (!selfOrigin || url.origin !== selfOrigin) return 'network-only';
  // API Backend — jamais mis en cache, même même origine (proxy éventuel).
  if (url.pathname.startsWith('/api/')) return 'network-only';
  if (request.isNavigate) return 'navigate';
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(woff2?|ttf|otf)$/i.test(url.pathname)
  ) {
    return 'cache-first';
  }
  return 'network-only';
}

/**
 * Lot « notifications push » — la cloche (Soketi, app ouverte) suffit déjà
 * quand une fenêtre de l'app est visible au premier plan : jamais de
 * doublon. Fonction PURE — `clientsList` est le résultat déjà résolu de
 * `clients.matchAll()`, jamais appelé ici.
 *
 * @param {Array<{ visibilityState?: string }>} clientsList
 * @returns {boolean}
 */
function shouldShowPushNotification(clientsList) {
  return !clientsList.some((c) => c.visibilityState === 'visible');
}

/**
 * Chemin interne UNIQUEMENT — jamais une URL absolue/externe, même si la
 * charge utile est corrompue ou falsifiée. Repli sur `/` si invalide, absent,
 * ou résolu vers une autre origine. Fonction PURE (testable sans `self`).
 *
 * @param {unknown} url
 * @param {string} selfOrigin
 * @returns {string}
 */
function resolvePushNotificationUrl(url, selfOrigin) {
  if (typeof url !== 'string' || !url) return '/';
  try {
    const resolved = new URL(url, selfOrigin);
    if (resolved.origin !== selfOrigin) return '/';
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return '/';
  }
}

// Exposé pour Vitest (environnement Node — pas de `self` de service worker).
// Ignoré par le navigateur, qui charge ce fichier comme un script classique
// sans système de modules (pas de `module` global dans ce contexte).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getCacheStrategy,
    shouldShowPushNotification,
    resolvePushNotificationUrl,
    CACHE_VERSION,
    STATIC_CACHE,
    OFFLINE_URL,
  };
}

// ── Cycle de vie du service worker — ignoré hors contexte SW (ex. tests). ──
if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches
        .open(STATIC_CACHE)
        .then((cache) => cache.addAll(PRECACHE_URLS))
        .then(() => self.skipWaiting()),
    );
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
        .then(() => self.clients.claim()),
    );
  });

  self.addEventListener('fetch', (event) => {
    const request = event.request;
    const strategy = getCacheStrategy(
      { url: request.url, method: request.method, isNavigate: request.mode === 'navigate' },
      self.location.origin,
    );

    if (strategy === 'network-only') {
      // Ne pas appeler respondWith() : laisse le navigateur gérer la
      // requête nativement (API, Clerk, Soketi, Cloudinary, OSM, POST...).
      return;
    }

    if (strategy === 'navigate') {
      event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
      return;
    }

    // cache-first
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
  });

  // Lot « notifications push » — charge utile neutre JSON { title, body, url,
  // tag } (jamais de contenu de message, de montant ni d'adresse — cf.
  // PushService côté Backend, seule source de ces notifications). Une
  // fenêtre de l'app déjà visible/au premier plan a déjà la cloche (Soketi) :
  // jamais de doublon ici.
  self.addEventListener('push', (event) => {
    if (!event.data) return;
    let payload;
    try {
      payload = event.data.json();
    } catch {
      return;
    }
    if (!payload || typeof payload.title !== 'string') return;

    const url = resolvePushNotificationUrl(payload.url, self.location.origin);

    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientsList) => {
          if (!shouldShowPushNotification(clientsList)) return;
          return self.registration.showNotification(payload.title, {
            body: typeof payload.body === 'string' ? payload.body : '',
            tag: typeof payload.tag === 'string' ? payload.tag : undefined,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-monochrome-512.png',
            data: { url },
          });
        }),
    );
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = resolvePushNotificationUrl(
      event.notification.data && event.notification.data.url,
      self.location.origin,
    );

    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientsList) => {
          const target = new URL(url, self.location.origin).href;
          const already = clientsList.find((c) => c.url === target);
          if (already && 'focus' in already) return already.focus();

          const anyClient = clientsList[0];
          if (anyClient && 'navigate' in anyClient && 'focus' in anyClient) {
            return anyClient.focus().then(() => anyClient.navigate(url));
          }
          return self.clients.openWindow(url);
        }),
    );
  });
}
