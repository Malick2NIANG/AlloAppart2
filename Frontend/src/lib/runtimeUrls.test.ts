import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getApiBaseUrl, getRealtimeConfig } from './runtimeUrls';

function setHostname(hostname: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, hostname },
    writable: true,
  });
}

describe('runtimeUrls', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000/api/v1';
    process.env.NEXT_PUBLIC_SOKETI_APP_KEY = 'test-key';
    process.env.NEXT_PUBLIC_SOKETI_HOST = 'localhost';
    process.env.NEXT_PUBLIC_SOKETI_PORT = '6001';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  describe('hôte localhost — comportement inchangé', () => {
    it('getApiBaseUrl renvoie la variable d\'environnement', () => {
      setHostname('localhost');
      expect(getApiBaseUrl()).toBe('http://localhost:4000/api/v1');
    });

    it('getRealtimeConfig renvoie la config Soketi locale (pas de TLS)', () => {
      setHostname('localhost');
      expect(getRealtimeConfig()).toEqual({
        key: 'test-key',
        host: 'localhost',
        port: 6001,
        useTLS: false,
      });
    });
  });

  describe('hôte de tunnel — URLs dérivées', () => {
    it('getApiBaseUrl pointe vers le port 4000 du même tunnel', () => {
      setHostname('tv1lkfcn-3000.eun1.devtunnels.ms');
      expect(getApiBaseUrl()).toBe(
        'https://tv1lkfcn-4000.eun1.devtunnels.ms/api/v1',
      );
    });

    it('getRealtimeConfig pointe vers le port 6001 du même tunnel, en TLS', () => {
      setHostname('tv1lkfcn-3000.eun1.devtunnels.ms');
      expect(getRealtimeConfig()).toEqual({
        key: 'test-key',
        host: 'tv1lkfcn-6001.eun1.devtunnels.ms',
        port: 443,
        useTLS: true,
      });
    });

    it('fonctionne aussi quand window.location est déjà sur le port API (4000)', () => {
      setHostname('tv1lkfcn-4000.eun1.devtunnels.ms');
      expect(getApiBaseUrl()).toBe(
        'https://tv1lkfcn-4000.eun1.devtunnels.ms/api/v1',
      );
    });

    it('sans sous-région explicite (<id>-3000.devtunnels.ms)', () => {
      setHostname('tv1lkfcn-3000.devtunnels.ms');
      expect(getApiBaseUrl()).toBe('https://tv1lkfcn-4000.devtunnels.ms/api/v1');
    });
  });

  describe('hôte quelconque (prod, IP LAN) — comportement inchangé', () => {
    it('domaine de production', () => {
      setHostname('alloappart.sn');
      expect(getApiBaseUrl()).toBe('http://localhost:4000/api/v1');
    });

    it('IP LAN (test téléphone)', () => {
      setHostname('192.168.1.9');
      expect(getApiBaseUrl()).toBe('http://localhost:4000/api/v1');
      expect(getRealtimeConfig().useTLS).toBe(false);
    });

    it('un hôte qui ne se termine pas par devtunnels.ms ne matche pas', () => {
      setHostname('tv1lkfcn-3000.eun1.devtunnels.ms.attacker.example');
      expect(getApiBaseUrl()).toBe('http://localhost:4000/api/v1');
    });
  });

  describe('côté serveur (pas de window)', () => {
    it('getApiBaseUrl retombe sur la variable d\'environnement', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error -- simule l'absence de `window` côté serveur
      delete globalThis.window;
      try {
        expect(getApiBaseUrl()).toBe('http://localhost:4000/api/v1');
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });
});
