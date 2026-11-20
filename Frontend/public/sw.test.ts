import { describe, expect, it } from 'vitest';
// sw.js exporte via `module.exports` (script classique côté navigateur,
// pas de système de modules) — Vite/Vitest interop le lit en CJS ici.
import { getCacheStrategy, shouldShowPushNotification, resolvePushNotificationUrl } from './sw.js';

const ORIGIN = 'http://localhost:3000';

describe('getCacheStrategy', () => {
  it('API Backend (/api/v1/...) — jamais mis en cache', () => {
    expect(getCacheStrategy({ url: `${ORIGIN}/api/v1/listings`, method: 'GET' }, ORIGIN)).toBe('network-only');
  });

  it('URL Clerk (autre origine) — jamais mis en cache', () => {
    expect(
      getCacheStrategy({ url: 'https://diverse-grouper-74.clerk.accounts.dev/v1/client', method: 'GET' }, ORIGIN),
    ).toBe('network-only');
  });

  it('navigation (document HTML) — réseau avec repli /offline', () => {
    expect(getCacheStrategy({ url: `${ORIGIN}/listings`, method: 'GET', isNavigate: true }, ORIGIN)).toBe('navigate');
  });

  it('asset /_next/static — cache-first', () => {
    expect(
      getCacheStrategy({ url: `${ORIGIN}/_next/static/chunks/main.js`, method: 'GET' }, ORIGIN),
    ).toBe('cache-first');
  });

  it('requête POST (même URL API) — jamais mis en cache', () => {
    expect(getCacheStrategy({ url: `${ORIGIN}/api/v1/listings`, method: 'POST' }, ORIGIN)).toBe('network-only');
  });

  it('autre origine (ex. Cloudinary, OpenStreetMap, Soketi) — jamais mis en cache', () => {
    expect(getCacheStrategy({ url: 'https://res.cloudinary.com/demo/image.jpg', method: 'GET' }, ORIGIN)).toBe('network-only');
  });

  it('bonus : icônes et polices — cache-first', () => {
    expect(getCacheStrategy({ url: `${ORIGIN}/icons/icon-192.png`, method: 'GET' }, ORIGIN)).toBe('cache-first');
    expect(getCacheStrategy({ url: `${ORIGIN}/_next/static/media/inter.woff2`, method: 'GET' }, ORIGIN)).toBe('cache-first');
  });

  it('bonus : page normale autre que /_next/static (sans isNavigate) — jamais mis en cache', () => {
    expect(getCacheStrategy({ url: `${ORIGIN}/listings`, method: 'GET' }, ORIGIN)).toBe('network-only');
  });
});

describe('shouldShowPushNotification (lot « notifications push »)', () => {
  it('aucune fenêtre visible : affiche la notification', () => {
    expect(shouldShowPushNotification([])).toBe(true);
    expect(shouldShowPushNotification([{ visibilityState: 'hidden' }])).toBe(true);
  });

  it('une fenêtre visible (même parmi plusieurs) : n\'affiche pas — la cloche suffit', () => {
    expect(shouldShowPushNotification([{ visibilityState: 'visible' }])).toBe(false);
    expect(
      shouldShowPushNotification([{ visibilityState: 'hidden' }, { visibilityState: 'visible' }]),
    ).toBe(false);
  });
});

describe('resolvePushNotificationUrl (lot « notifications push »)', () => {
  it('chemin interne valide : renvoyé tel quel (pathname + query + hash)', () => {
    expect(resolvePushNotificationUrl('/bookings/abc', ORIGIN)).toBe('/bookings/abc');
    expect(resolvePushNotificationUrl('/messages?room=room1', ORIGIN)).toBe('/messages?room=room1');
  });

  it('URL absolue vers une autre origine : repli sur "/"', () => {
    expect(resolvePushNotificationUrl('https://evil.example/phish', ORIGIN)).toBe('/');
  });

  it('URL protocole-relative vers une autre origine : repli sur "/"', () => {
    expect(resolvePushNotificationUrl('//evil.example/phish', ORIGIN)).toBe('/');
  });

  it('absent, vide ou type invalide : repli sur "/"', () => {
    expect(resolvePushNotificationUrl(undefined, ORIGIN)).toBe('/');
    expect(resolvePushNotificationUrl('', ORIGIN)).toBe('/');
    expect(resolvePushNotificationUrl(42, ORIGIN)).toBe('/');
  });

  it('URL malformée : repli sur "/", jamais d\'exception', () => {
    expect(resolvePushNotificationUrl('http://', ORIGIN)).toBe('/');
  });
});
