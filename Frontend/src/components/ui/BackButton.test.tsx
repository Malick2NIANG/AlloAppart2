import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BackButton from './BackButton';

const back = vi.fn();
const push = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back, push }),
  useSearchParams: () => params,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

function setReferrer(value: string) {
  Object.defineProperty(document, 'referrer', { value, configurable: true });
}

describe('BackButton (lot « boutons retour »)', () => {
  beforeEach(() => {
    back.mockReset();
    push.mockReset();
    params = new URLSearchParams();
    setReferrer('');
  });

  it('historique same-origin disponible : router.back(), jamais router.push', async () => {
    setReferrer(`${window.location.origin}/aide`);
    const user = userEvent.setup();
    render(<BackButton />);
    await user.click(screen.getByRole('button', { name: 'back' }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('aucun historique same-origin, pas de marqueur : repli vers "/" par défaut', async () => {
    setReferrer('https://exemple-externe.com/');
    const user = userEvent.setup();
    render(<BackButton />);
    await user.click(screen.getByRole('button', { name: 'back' }));
    expect(back).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/');
  });

  it('repli personnalisé via fallbackHref quand fourni', async () => {
    const user = userEvent.setup();
    render(<BackButton fallbackHref="/espace" />);
    await user.click(screen.getByRole('button', { name: 'back' }));
    expect(push).toHaveBeenCalledWith('/espace');
  });

  it('marqueur ?from=aide, aucun historique : repli vers /aide?sujet=<id>', async () => {
    params = new URLSearchParams({ from: 'aide', sujet: 'tarifs_abonnements' });
    const user = userEvent.setup();
    render(<BackButton />);
    await user.click(screen.getAllByRole('button', { name: 'backToAide' })[0]);
    expect(push).toHaveBeenCalledWith('/aide?sujet=tarifs_abonnements');
  });

  it('marqueur ?from=aide sans sujet, aucun historique : repli vers /aide nu', async () => {
    params = new URLSearchParams({ from: 'aide' });
    const user = userEvent.setup();
    render(<BackButton />);
    await user.click(screen.getAllByRole('button', { name: 'backToAide' })[0]);
    expect(push).toHaveBeenCalledWith('/aide');
  });

  it('?from=aide : le lien PC discret est aussi rendu (en plus de la barre mobile)', () => {
    params = new URLSearchParams({ from: 'aide' });
    render(<BackButton />);
    expect(screen.getAllByRole('button', { name: 'backToAide' })).toHaveLength(2);
  });

  it('sans ?from=aide : aucun lien PC — seule la barre mobile existe (mobileAlways par défaut)', () => {
    render(<BackButton />);
    expect(screen.getAllByRole('button', { name: 'back' })).toHaveLength(1);
  });

  it('mobileAlways=false et pas de ?from=aide : ne rend absolument rien', () => {
    const { container } = render(<BackButton mobileAlways={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('mobileAlways=false mais ?from=aide présent : la barre mobile réapparaît quand même', () => {
    params = new URLSearchParams({ from: 'aide' });
    render(<BackButton mobileAlways={false} />);
    expect(screen.getAllByRole('button', { name: 'backToAide' })).toHaveLength(2);
  });
});
