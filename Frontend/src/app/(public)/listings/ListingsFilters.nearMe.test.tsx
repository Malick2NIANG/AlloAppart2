import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListingsFilters from './ListingsFilters';
import { NearMeProvider, useNearMe } from '@/components/listings/NearMeContext';

const push = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'fr',
}));

function ContextProbe() {
  const { lat, lng, active } = useNearMe();
  return <span data-testid="near-me-probe">{active ? `${lat}/${lng}` : 'inactive'}</span>;
}

function renderFilters() {
  return render(
    <NearMeProvider>
      <ContextProbe />
      <ListingsFilters limit={6} locale="fr" />
    </NearMeProvider>,
  );
}

describe('ListingsFilters — « Près de moi » (lot « raccourci », vérif confidentialité)', () => {
  beforeEach(() => {
    push.mockReset();
    params = new URLSearchParams();
    // @ts-expect-error -- nettoyage d'un navigator.geolocation ajouté par un test
    delete navigator.geolocation;
  });

  it('clic « Près de moi » : succès → position dans NearMeContext (arrondie à 3 décimales), JAMAIS dans l\'URL poussée', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({ coords: { latitude: 14.69284321, longitude: -17.46771999 } } as GeolocationPosition);
    });
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition }, writable: true, configurable: true,
    });
    const user = userEvent.setup();
    renderFilters();

    await user.click(screen.getAllByText('nearMeButton')[0]);

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const url = push.mock.calls[0][0] as string;
    expect(url).not.toMatch(/[?&]lat=/);
    expect(url).not.toMatch(/[?&]lng=/);
    expect(screen.getByTestId('near-me-probe')).toHaveTextContent('14.693/-17.468');
  });

  it('puce « Près de moi » visible et supprimable une fois actif, sans jamais toucher l\'URL', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({ coords: { latitude: 14.7, longitude: -17.4 } } as GeolocationPosition);
    });
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition }, writable: true, configurable: true,
    });
    const user = userEvent.setup();
    renderFilters();

    await user.click(screen.getAllByText('nearMeButton')[0]);
    await waitFor(() => expect(screen.getByTestId('near-me-probe')).toHaveTextContent('14.7/-17.4'));

    const chip = screen.getAllByText('nearMeChip')[0].closest('span')!;
    await user.click(chip.querySelector('button')!);

    expect(screen.getByTestId('near-me-probe')).toHaveTextContent('inactive');
    // Supprimer la puce ne pousse jamais lat/lng non plus (aucun appel push
    // n'a eu lieu pour l'activation — push() n'est appelé que pour {page:'1'}).
    for (const call of push.mock.calls) {
      expect(String(call[0])).not.toMatch(/[?&]lat=/);
    }
  });

  it('permission refusée : NearMeContext reste inactif, message clair affiché', async () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    });
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition }, writable: true, configurable: true,
    });
    const user = userEvent.setup();
    renderFilters();

    await user.click(screen.getAllByText('nearMeButton')[0]);

    expect((await screen.findAllByText('nearMeDenied'))[0]).toBeInTheDocument();
    expect(screen.getByTestId('near-me-probe')).toHaveTextContent('inactive');
    expect(push).not.toHaveBeenCalled();
  });
});
