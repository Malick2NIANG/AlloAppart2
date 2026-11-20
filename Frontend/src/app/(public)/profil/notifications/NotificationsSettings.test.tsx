import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationsSettings from './NotificationsSettings';

const getToken = vi.fn();
let isSignedIn = true;

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ isSignedIn, getToken }),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (key: string) => key,
}));

const subscribeToPush = vi.fn();
const unsubscribeFromPush = vi.fn();
vi.mock('@/lib/push', async () => {
  const actual = await vi.importActual<typeof import('@/lib/push')>('@/lib/push');
  return {
    ...actual,
    subscribeToPush: (...args: unknown[]) => subscribeToPush(...args),
    unsubscribeFromPush: (...args: unknown[]) => unsubscribeFromPush(...args),
  };
});

const apiGet = vi.fn();
const apiPatch = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    patch: (...args: unknown[]) => apiPatch(...args),
  },
}));

function stubEnvironment(opts: {
  permission: NotificationPermission;
  supported?: boolean;
  isIOS?: boolean;
  standalone?: boolean;
}) {
  const { permission, supported = true, isIOS = false, standalone = false } = opts;
  if (supported) {
    Object.defineProperty(window, 'Notification', {
      value: { permission },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'PushManager', { value: class {}, writable: true, configurable: true });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: () => Promise.resolve(undefined) },
      writable: true,
      configurable: true,
    });
  } else {
    // @ts-expect-error -- nettoyage volontaire pour simuler l'absence de support
    delete window.Notification;
    // @ts-expect-error -- idem
    delete window.PushManager;
  }
  Object.defineProperty(navigator, 'userAgent', {
    value: isIOS ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' : 'Mozilla/5.0 (Windows NT 10.0)',
    configurable: true,
  });
  Object.defineProperty(navigator, 'standalone', { value: standalone, configurable: true });
}

describe('NotificationsSettings (lot « notifications push »)', () => {
  beforeEach(() => {
    isSignedIn = true;
    getToken.mockReset().mockResolvedValue('token-123');
    subscribeToPush.mockReset().mockResolvedValue(undefined);
    unsubscribeFromPush.mockReset().mockResolvedValue(undefined);
    apiGet.mockReset().mockResolvedValue({ messages: true, bookings: true, payments: true, listings: true });
    apiPatch.mockReset().mockResolvedValue(undefined);
  });

  it('non connecté : invite à se connecter, aucune détection navigateur', () => {
    isSignedIn = false;
    render(<NotificationsSettings />);
    expect(screen.getByText('signInRequired')).toBeInTheDocument();
  });

  it('non supporté : message calme, aucun bouton d\'activation', async () => {
    stubEnvironment({ permission: 'default', supported: false });
    render(<NotificationsSettings />);
    expect(await screen.findByText('unsupportedTitle')).toBeInTheDocument();
    expect(screen.queryByText('activateButton')).not.toBeInTheDocument();
  });

  it('iPhone non installé : instructions dédiées, aucun bouton d\'activation', async () => {
    stubEnvironment({ permission: 'default', isIOS: true, standalone: false });
    render(<NotificationsSettings />);
    expect(await screen.findByText('iosTitle')).toBeInTheDocument();
    expect(screen.queryByText('activateButton')).not.toBeInTheDocument();
  });

  it('iPhone installé (standalone) : traité normalement, bouton d\'activation présent', async () => {
    stubEnvironment({ permission: 'default', isIOS: true, standalone: true });
    render(<NotificationsSettings />);
    expect(await screen.findByText('activateButton')).toBeInTheDocument();
  });

  it('refusé (bloquées) : message d\'explication, aucun bouton d\'activation', async () => {
    stubEnvironment({ permission: 'denied' });
    render(<NotificationsSettings />);
    expect(await screen.findByText('deniedTitle')).toBeInTheDocument();
    expect(screen.queryByText('activateButton')).not.toBeInTheDocument();
  });

  it('par défaut : bouton « Activer » visible, clic déclenche subscribeToPush', async () => {
    stubEnvironment({ permission: 'default' });
    const user = userEvent.setup();
    render(<NotificationsSettings />);
    const button = await screen.findByText('activateButton');
    await user.click(button);
    await waitFor(() => expect(subscribeToPush).toHaveBeenCalledWith('token-123', 'fr'));
  });

  it('accordé et abonné : réglages par catégorie visibles, pas de bouton « Activer »', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: () =>
          Promise.resolve({
            pushManager: { getSubscription: () => Promise.resolve({ endpoint: 'https://x' }) },
          }),
      },
      writable: true,
      configurable: true,
    });
    stubEnvironment({ permission: 'granted' });
    // stubEnvironment écrase navigator.serviceWorker avec une registration
    // vide — on la redéfinit APRÈS pour simuler un abonnement déjà actif.
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: () =>
          Promise.resolve({
            pushManager: { getSubscription: () => Promise.resolve({ endpoint: 'https://x' }) },
          }),
      },
      writable: true,
      configurable: true,
    });

    render(<NotificationsSettings />);
    expect(await screen.findByText('categoriesTitle')).toBeInTheDocument();
    expect(screen.queryByText('activateButton')).not.toBeInTheDocument();
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/push/preferences', 'token-123'));
  });

  it('« Couper sur cet appareil » appelle unsubscribeFromPush', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: () =>
          Promise.resolve({
            pushManager: { getSubscription: () => Promise.resolve({ endpoint: 'https://x' }) },
          }),
      },
      writable: true,
      configurable: true,
    });
    stubEnvironment({ permission: 'granted' });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: () =>
          Promise.resolve({
            pushManager: { getSubscription: () => Promise.resolve({ endpoint: 'https://x' }) },
          }),
      },
      writable: true,
      configurable: true,
    });

    const user = userEvent.setup();
    render(<NotificationsSettings />);
    const button = await screen.findByText('disableDeviceButton');
    await user.click(button);
    await waitFor(() => expect(unsubscribeFromPush).toHaveBeenCalledWith('token-123'));
  });
});
