import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MiloSearchBar from './MiloSearchBar';
import { classifyMiloQuery } from '@/lib/milo';
import { NearMeProvider, useNearMe } from '@/components/listings/NearMeContext';

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, params?: Record<string, unknown>) =>
    params ? `${ns}.${key}(${JSON.stringify(params)})` : `${ns}.${key}`,
  useLocale: () => 'fr',
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/lib/milo', () => ({
  classifyMiloQuery: vi.fn(),
}));

afterEach(() => {
  push.mockClear();
  vi.mocked(classifyMiloQuery).mockReset();
  // @ts-expect-error -- nettoyage d'un navigator.geolocation ajouté par un test
  delete navigator.geolocation;
});

// Lot « raccourci » (vérification confidentialité) — sonde de test qui
// affiche lat/lng de NearMeContext, pour vérifier QUE la position y arrive
// bien (en mémoire), jamais dans l'URL.
function ContextProbe() {
  const { lat, lng } = useNearMe();
  return <span data-testid="near-me-probe">{lat ?? 'null'}/{lng ?? 'null'}</span>;
}

function renderBar() {
  return render(
    <NearMeProvider>
      <ContextProbe />
      <MiloSearchBar placeholder="p" ariaLabel="a" clearLabel="c" />
    </NearMeProvider>,
  );
}

async function submitText(user: ReturnType<typeof userEvent.setup>, text: string) {
  const input = screen.getByRole('textbox');
  await user.type(input, text);
  await user.keyboard('{Enter}');
}

describe('MiloSearchBar — « près de moi » (lot « raccourci »)', () => {
  it('nearMe détecté : affiche la carte d\'invite, ne navigue jamais tout seul', async () => {
    vi.mocked(classifyMiloQuery).mockResolvedValue({
      kind: 'nearMe',
      params: new URLSearchParams({ milo: '1' }),
    });
    const user = userEvent.setup();
    renderBar();

    await submitText(user, 'studio pres de moi');

    expect(await screen.findByText('miloFaq.nearMePrompt')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('clic « Activer ma position » : succès → position dans NearMeContext (arrondie à 3 décimales), JAMAIS dans l\'URL de /listings', async () => {
    vi.mocked(classifyMiloQuery).mockResolvedValue({
      kind: 'nearMe',
      params: new URLSearchParams({ milo: '1' }),
    });
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({ coords: { latitude: 14.69284321, longitude: -17.46771999 } } as GeolocationPosition);
    });
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      writable: true,
      configurable: true,
    });
    const user = userEvent.setup();
    renderBar();

    await submitText(user, 'studio pres de moi');
    await user.click(await screen.findByText('miloFaq.nearMeActivate'));

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const url = push.mock.calls[0][0] as string;
    // Vérification confidentialité : jamais lat/lng dans l'adresse de /listings.
    expect(url).not.toMatch(/[?&]lat=/);
    expect(url).not.toMatch(/[?&]lng=/);
    expect(url).toBe('/listings?milo=1');
    // La position EST bien arrivée — mais seulement dans le contexte React.
    expect(screen.getByTestId('near-me-probe')).toHaveTextContent('14.693/-17.468');
    // La carte se referme après l'activation.
    expect(screen.queryByText('miloFaq.nearMePrompt')).not.toBeInTheDocument();
  });

  it('permission refusée : message clair, jamais de navigation, la recherche normale reste possible', async () => {
    vi.mocked(classifyMiloQuery).mockResolvedValue({
      kind: 'nearMe',
      params: new URLSearchParams({ milo: '1' }),
    });
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    });
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      writable: true,
      configurable: true,
    });
    const user = userEvent.setup();
    renderBar();

    await submitText(user, 'studio pres de moi');
    await user.click(await screen.findByText('miloFaq.nearMeActivate'));

    expect(await screen.findByText('listings.nearMeDenied')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByTestId('near-me-probe')).toHaveTextContent('null/null');
    // La recherche normale reste disponible : le bouton de repli est toujours là.
    expect(screen.getByText('miloFaq.searchInsteadLabel')).toBeInTheDocument();
  });

  it('« Lancer une recherche à la place » navigue sans jamais demander la position', async () => {
    vi.mocked(classifyMiloQuery).mockResolvedValue({
      kind: 'nearMe',
      params: new URLSearchParams({ milo: '1' }),
    });
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      writable: true,
      configurable: true,
    });
    const user = userEvent.setup();
    renderBar();

    await submitText(user, 'studio pres de moi');
    await user.click(await screen.findByText('miloFaq.searchInsteadLabel'));

    expect(getCurrentPosition).not.toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push.mock.calls[0][0]).not.toContain('lat=');
  });

  it('géolocalisation indisponible (détection de support) : message clair, pas de crash', async () => {
    vi.mocked(classifyMiloQuery).mockResolvedValue({
      kind: 'nearMe',
      params: new URLSearchParams({ milo: '1' }),
    });
    // Pas de navigator.geolocation défini du tout.
    const user = userEvent.setup();
    renderBar();

    await submitText(user, 'studio pres de moi');
    await user.click(await screen.findByText('miloFaq.nearMeActivate'));

    expect(await screen.findByText('listings.nearMeUnsupported')).toBeInTheDocument();
  });
});
