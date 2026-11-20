import { describe, it, expect } from 'vitest';
import {
  resolvePushUiState,
  detectIsIOS,
  detectIsStandalone,
  isPushSupported,
  urlBase64ToUint8Array,
} from './push';

describe('resolvePushUiState (lot « notifications push »)', () => {
  it('non supporté : aucune demande de permission possible', () => {
    expect(
      resolvePushUiState({ supported: false, permission: 'default', isIOS: false, isStandalone: false }),
    ).toBe('unsupported');
  });

  it('par défaut (jamais demandé) : bouton « Activer »', () => {
    expect(
      resolvePushUiState({ supported: true, permission: 'default', isIOS: false, isStandalone: false }),
    ).toBe('default');
  });

  it('accordé : activées', () => {
    expect(
      resolvePushUiState({ supported: true, permission: 'granted', isIOS: false, isStandalone: false }),
    ).toBe('enabled');
  });

  it('refusé : bloquées par le navigateur', () => {
    expect(
      resolvePushUiState({ supported: true, permission: 'denied', isIOS: false, isStandalone: false }),
    ).toBe('denied');
  });

  it('iPhone non installé : message dédié, même si "supported" est vrai', () => {
    expect(
      resolvePushUiState({ supported: true, permission: 'default', isIOS: true, isStandalone: false }),
    ).toBe('ios-not-installed');
  });

  it('iPhone installé (standalone) : traité comme un navigateur normal', () => {
    expect(
      resolvePushUiState({ supported: true, permission: 'granted', isIOS: true, isStandalone: true }),
    ).toBe('enabled');
  });

  it('iPhone non installé prime sur "non supporté" (cas réel : Safari en onglet n\'expose pas PushManager)', () => {
    expect(
      resolvePushUiState({ supported: false, permission: 'default', isIOS: true, isStandalone: false }),
    ).toBe('ios-not-installed');
  });
});

describe('detectIsIOS', () => {
  it('iPhone : détecté', () => {
    expect(detectIsIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
  });

  it('Android : non détecté', () => {
    expect(detectIsIOS('Mozilla/5.0 (Linux; Android 14)')).toBe(false);
  });

  it('desktop : non détecté', () => {
    expect(detectIsIOS('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
  });
});

describe('detectIsStandalone', () => {
  it('navigator.standalone (Safari iOS) : vrai', () => {
    expect(detectIsStandalone({ standalone: true }, undefined)).toBe(true);
  });

  it('display-mode: standalone (générique) : vrai', () => {
    expect(detectIsStandalone({}, (q) => ({ matches: q === '(display-mode: standalone)' }))).toBe(true);
  });

  it('ni l\'un ni l\'autre : faux', () => {
    expect(detectIsStandalone({ standalone: false }, () => ({ matches: false }))).toBe(false);
    expect(detectIsStandalone({}, undefined)).toBe(false);
  });
});

describe('isPushSupported', () => {
  it('tout présent : supporté', () => {
    expect(
      isPushSupported({ serviceWorker: {} }, { PushManager: class {}, Notification: class {} }),
    ).toBe(true);
  });

  it('PushManager absent : non supporté', () => {
    expect(isPushSupported({ serviceWorker: {} }, { Notification: class {} })).toBe(false);
  });

  it('serviceWorker absent : non supporté', () => {
    expect(isPushSupported({}, { PushManager: class {}, Notification: class {} })).toBe(false);
  });

  it('nav/win absents ou invalides : non supporté, jamais d\'exception', () => {
    expect(isPushSupported(null, null)).toBe(false);
    expect(isPushSupported(undefined, undefined)).toBe(false);
  });
});

describe('urlBase64ToUint8Array', () => {
  it('décode une clé VAPID base64 URL-safe en Uint8Array de la bonne longueur', () => {
    // "AAAA" en base64 standard = 3 octets nuls.
    const result = urlBase64ToUint8Array('AAAA');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(3);
  });

  it('gère les caractères URL-safe (-, _) sans lever d\'exception', () => {
    expect(() => urlBase64ToUint8Array('BBBB-_')).not.toThrow();
  });
});
