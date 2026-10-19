import { describe, expect, it } from 'vitest';
// sw.js exporte via `module.exports` (script classique côté navigateur,
// pas de système de modules) — Vite/Vitest interop le lit en CJS ici.
import { getCacheStrategy } from './sw.js';

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
