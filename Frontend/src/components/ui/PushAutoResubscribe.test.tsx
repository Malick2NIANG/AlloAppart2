import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import PushAutoResubscribe from './PushAutoResubscribe';

const getToken = vi.fn();
let isSignedIn = true;

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ isSignedIn, getToken }),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
}));

const subscribeToPush = vi.fn();
vi.mock('@/lib/push', async () => {
  const actual = await vi.importActual<typeof import('@/lib/push')>('@/lib/push');
  return { ...actual, subscribeToPush: (...args: unknown[]) => subscribeToPush(...args) };
});

describe('PushAutoResubscribe (lot « notifications push ») — jamais de demande de permission au chargement', () => {
  beforeEach(() => {
    isSignedIn = true;
    getToken.mockReset().mockResolvedValue('token-123');
    subscribeToPush.mockReset().mockResolvedValue(undefined);
    localStorage.clear();
    // @ts-expect-error -- stub minimal pour ce test, nettoyé par le suivant
    delete window.Notification;
    // @ts-expect-error -- idem
    delete window.PushManager;
    // @ts-expect-error -- idem (navigator.serviceWorker)
    delete navigator.serviceWorker;
  });

  function stubSupport(permission: NotificationPermission) {
    Object.defineProperty(window, 'Notification', {
      value: { permission },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'PushManager', { value: class {}, writable: true, configurable: true });
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, writable: true, configurable: true });
  }

  it('ne fait RIEN par défaut (pas de réglage local, pas de permission) — jamais requestPermission appelé', async () => {
    stubSupport('default');
    render(<PushAutoResubscribe />);
    await new Promise((r) => setTimeout(r, 50));
    expect(subscribeToPush).not.toHaveBeenCalled();
  });

  it('permission accordée mais réglage local absent : ne se réabonne pas (l\'utilisateur n\'a jamais activé sur CET appareil)', async () => {
    stubSupport('granted');
    render(<PushAutoResubscribe />);
    await new Promise((r) => setTimeout(r, 50));
    expect(subscribeToPush).not.toHaveBeenCalled();
  });

  it('réglage local activé mais permission non accordée (default) : ne se réabonne pas', async () => {
    localStorage.setItem('allo-push-device-enabled', '1');
    stubSupport('default');
    render(<PushAutoResubscribe />);
    await new Promise((r) => setTimeout(r, 50));
    expect(subscribeToPush).not.toHaveBeenCalled();
  });

  it('permission accordée ET réglage local activé : se réabonne silencieusement, sans prompt', async () => {
    localStorage.setItem('allo-push-device-enabled', '1');
    stubSupport('granted');
    render(<PushAutoResubscribe />);
    await waitFor(() => expect(subscribeToPush).toHaveBeenCalledWith('token-123', 'fr'));
  });

  it('non connecté : ne fait rien même avec permission + réglage activés', async () => {
    isSignedIn = false;
    localStorage.setItem('allo-push-device-enabled', '1');
    stubSupport('granted');
    render(<PushAutoResubscribe />);
    await new Promise((r) => setTimeout(r, 50));
    expect(subscribeToPush).not.toHaveBeenCalled();
  });
});
