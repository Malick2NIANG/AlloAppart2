import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavbarClient from './NavbarClient';

// Lot « loupe du header » — la barre PC garde son JSX (q/min/max/bouton)
// inchangé, seul le comportement de soumission change (Milo partagé) ;
// la loupe mobile ouvre désormais une feuille avec le même MiloSearchBar.

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((k: string) => k, { raw: () => ({}) }),
  useLocale: () => 'fr',
}));
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ isSignedIn: false, getToken: vi.fn() }),
  useClerk: () => ({ signOut: vi.fn() }),
  useUser: () => ({ user: null }),
}));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
vi.mock('./NotificationBell', () => ({ default: () => null }));
vi.mock('./ThemeToggle', () => ({ default: () => null }));
vi.mock('./LanguageSwitcher', () => ({ default: () => null }));

const resolveMiloRedirectParams = vi.fn();
vi.mock('@/lib/milo', async () => {
  const actual = await vi.importActual<typeof import('@/lib/milo')>('@/lib/milo');
  return { ...actual, resolveMiloRedirectParams: (...args: unknown[]) => resolveMiloRedirectParams(...args) };
});

const LABELS = {
  listings: 'Annonces', search: 'Rechercher', mySpace: 'Mon espace', login: 'Connexion', register: "S'inscrire",
  openMenu: 'Ouvrir le menu', closeMenu: 'Fermer le menu', searchPlaceholder: 'Ville, quartier...',
  allListings: 'Toutes les annonces', byType: 'Par type', discover: 'Découvrir', demoMode: 'Mode démo',
  signOut: 'Déconnexion', messages: 'Messages', favorites: 'Favoris', profileLabel: 'Mon profil',
  security: 'Sécurité', localityPlaceholder: 'Localité', mobileSearchPlaceholder: 'Quartier, ville, mot-clé…',
  agencies: 'Agences', about: 'À propos', closeSearch: 'Fermer la recherche',
};

describe('NavbarClient — recherche du header (lot « loupe du header »)', () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    resolveMiloRedirectParams.mockReset();
  });

  it('PC : une phrase non vide passe par Milo (resolveMiloRedirectParams), jamais un q/minPrice direct', async () => {
    resolveMiloRedirectParams.mockResolvedValue(new URLSearchParams({ region: 'Dakar', milo: '1', miloLang: 'fr' }));
    const user = userEvent.setup();
    render(<NavbarClient locale="fr" labels={LABELS} />);

    const input = screen.getByPlaceholderText('Localité');
    await user.type(input, 'studio mermoz');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(resolveMiloRedirectParams).toHaveBeenCalledWith('studio mermoz', 'fr'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringContaining('/listings?region=Dakar')));
  });

  it('PC : min/max saisis sont fusionnés par-dessus le résultat Milo, jamais perdus', async () => {
    resolveMiloRedirectParams.mockResolvedValue(new URLSearchParams({ region: 'Dakar', milo: '1', miloLang: 'fr' }));
    const user = userEvent.setup();
    render(<NavbarClient locale="fr" labels={LABELS} />);

    await user.type(screen.getByPlaceholderText('Localité'), 'studio mermoz');
    await user.type(screen.getByPlaceholderText('Min'), '100000');
    await user.type(screen.getByPlaceholderText('Max'), '300000');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain('region=Dakar');
    expect(url).toContain('minPrice=100000');
    expect(url).toContain('maxPrice=300000');
  });

  it('PC : repli silencieux (Milo indisponible) → q brut + min/max, comme avant', async () => {
    resolveMiloRedirectParams.mockResolvedValue(new URLSearchParams({ q: 'studio mermoz' }));
    const user = userEvent.setup();
    render(<NavbarClient locale="fr" labels={LABELS} />);

    await user.type(screen.getByPlaceholderText('Localité'), 'studio mermoz');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(push).toHaveBeenCalledWith('/listings?q=studio+mermoz'));
  });

  it('PC : champ vide → comportement direct inchangé, Milo jamais appelé', async () => {
    const user = userEvent.setup();
    render(<NavbarClient locale="fr" labels={LABELS} />);
    await user.type(screen.getByPlaceholderText('Min'), '50000');
    await user.keyboard('{Enter}');

    expect(resolveMiloRedirectParams).not.toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/listings?minPrice=50000'));
  });

  it('mobile : la loupe ouvre une feuille avec le MiloSearchBar compact (plus de lien direct vers /search)', async () => {
    const user = userEvent.setup();
    const { container } = render(<NavbarClient locale="fr" labels={LABELS} />);

    expect(screen.queryByRole('link', { name: 'Rechercher' })).not.toBeInTheDocument();
    const loupe = container.querySelector('button[aria-label="Rechercher"]') as HTMLElement;
    expect(loupe).toBeTruthy();
    await user.click(loupe);

    // BottomSheet rend deux copies du contenu (mobile + modale desktop,
    // bascule par CSS seul — cf. BottomSheet.tsx) : jsdom ne filtre pas sur
    // la largeur, les deux existent dans le DOM en même temps.
    await waitFor(() => expect(screen.getAllByRole('search').length).toBeGreaterThan(0));
  });

  it('mobile : la croix de la feuille referme la recherche', async () => {
    const user = userEvent.setup();
    const { container } = render(<NavbarClient locale="fr" labels={LABELS} />);
    const loupe = container.querySelector('button[aria-label="Rechercher"]') as HTMLElement;
    await user.click(loupe);
    await waitFor(() => expect(screen.getAllByRole('search').length).toBeGreaterThan(0));

    await user.click(screen.getAllByRole('button', { name: 'Fermer la recherche' })[0]);
    await waitFor(() => expect(screen.queryByRole('search')).not.toBeInTheDocument());
  });
});
