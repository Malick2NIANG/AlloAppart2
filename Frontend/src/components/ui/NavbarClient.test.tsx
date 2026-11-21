import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavbarClient from './NavbarClient';
import { NearMeProvider } from '@/components/listings/NearMeContext';

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
vi.mock('./LanguageSwitcher', () => ({ default: () => null, FlagIcon: () => null }));
vi.mock('./LanguageToggle', () => ({ default: () => null }));

const classifyMiloQuery = vi.fn();
vi.mock('@/lib/milo', async () => {
  const actual = await vi.importActual<typeof import('@/lib/milo')>('@/lib/milo');
  return { ...actual, classifyMiloQuery: (...args: unknown[]) => classifyMiloQuery(...args) };
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
    classifyMiloQuery.mockReset();
  });

  it('PC : une phrase non vide passe par Milo (classifyMiloQuery), jamais un q/minPrice direct', async () => {
    classifyMiloQuery.mockResolvedValue({ kind: 'redirect', params: new URLSearchParams({ region: 'Dakar', milo: '1', miloLang: 'fr' }) });
    const user = userEvent.setup();
    render(<NearMeProvider><NavbarClient locale="fr" labels={LABELS} /></NearMeProvider>);

    const input = screen.getByPlaceholderText('Localité');
    await user.type(input, 'studio mermoz');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(classifyMiloQuery).toHaveBeenCalledWith('studio mermoz', 'fr'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringContaining('/listings?region=Dakar')));
  });

  it('PC : min/max saisis sont fusionnés par-dessus le résultat Milo, jamais perdus', async () => {
    classifyMiloQuery.mockResolvedValue({ kind: 'redirect', params: new URLSearchParams({ region: 'Dakar', milo: '1', miloLang: 'fr' }) });
    const user = userEvent.setup();
    render(<NearMeProvider><NavbarClient locale="fr" labels={LABELS} /></NearMeProvider>);

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
    classifyMiloQuery.mockResolvedValue({ kind: 'redirect', params: new URLSearchParams({ q: 'studio mermoz' }) });
    const user = userEvent.setup();
    render(<NearMeProvider><NavbarClient locale="fr" labels={LABELS} /></NearMeProvider>);

    await user.type(screen.getByPlaceholderText('Localité'), 'studio mermoz');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(push).toHaveBeenCalledWith('/listings?q=studio+mermoz'));
  });

  it('PC : champ vide → comportement direct inchangé, Milo jamais appelé', async () => {
    const user = userEvent.setup();
    render(<NearMeProvider><NavbarClient locale="fr" labels={LABELS} /></NearMeProvider>);
    await user.type(screen.getByPlaceholderText('Min'), '50000');
    await user.keyboard('{Enter}');

    expect(classifyMiloQuery).not.toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/listings?minPrice=50000'));
  });

  it('PC : une question FAQ affiche la carte sous la barre, jamais de navigation', async () => {
    classifyMiloQuery.mockResolvedValue({
      kind: 'faq',
      faq: { id: 'tarifs_abonnements', answerKey: 'tarifs_abonnements', confidence: 0.75 },
      detectedLanguage: 'fr',
    });
    const user = userEvent.setup();
    render(<NearMeProvider><NavbarClient locale="fr" labels={LABELS} /></NearMeProvider>);
    await user.type(screen.getByPlaceholderText('Localité'), 'abonnement');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('PC : « lancer une recherche à la place » navigue vers /listings?q=', async () => {
    classifyMiloQuery.mockResolvedValue({
      kind: 'faq',
      faq: { id: 'unknown', answerKey: 'unknown', confidence: 0.3 },
      detectedLanguage: 'fr',
    });
    const user = userEvent.setup();
    render(<NearMeProvider><NavbarClient locale="fr" labels={LABELS} /></NearMeProvider>);
    await user.type(screen.getByPlaceholderText('Localité'), 'comment ca marche');
    await user.keyboard('{Enter}');
    await screen.findByRole('status');

    await user.click(screen.getByText('searchInsteadLabel'));
    expect(push).toHaveBeenCalledWith('/listings?q=comment%20ca%20marche');
  });

  it('mobile : la loupe ouvre une feuille avec le MiloSearchBar compact (plus de lien direct vers /search)', async () => {
    const user = userEvent.setup();
    const { container } = render(<NearMeProvider><NavbarClient locale="fr" labels={LABELS} /></NearMeProvider>);

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
    const { container } = render(<NearMeProvider><NavbarClient locale="fr" labels={LABELS} /></NearMeProvider>);
    const loupe = container.querySelector('button[aria-label="Rechercher"]') as HTMLElement;
    await user.click(loupe);
    await waitFor(() => expect(screen.getAllByRole('search').length).toBeGreaterThan(0));

    await user.click(screen.getAllByRole('button', { name: 'Fermer la recherche' })[0]);
    await waitFor(() => expect(screen.queryByRole('search')).not.toBeInTheDocument());
  });

  describe('lot « footer mobile limité » — section « Informations » du tiroir', () => {
    it('le tiroir mobile contient les liens FAQ/Tarifs/Plan du site/Confidentialité/CGU/Cookies/Contact, sans doubler Agences/À propos', async () => {
      const user = userEvent.setup();
      render(<NearMeProvider><NavbarClient locale="fr" labels={LABELS} /></NearMeProvider>);
      await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));

      expect(screen.getByRole('link', { name: /navFaq/ })).toHaveAttribute('href', '/aide');
      expect(screen.getByRole('link', { name: /navTarifs/ })).toHaveAttribute('href', '/tarifs');
      expect(screen.getByRole('link', { name: /navSitemap/ })).toHaveAttribute('href', '/plan-du-site');
      expect(screen.getByRole('link', { name: /privacy/ })).toHaveAttribute('href', '/confidentialite');
      expect(screen.getByRole('link', { name: /terms/ })).toHaveAttribute('href', '/cgu');
      expect(screen.getByRole('link', { name: /cookies/ })).toHaveAttribute('href', '/cookies');
      expect(screen.getByRole('link', { name: 'Agences' })).toHaveAttribute('href', '/agences');
      expect(screen.getByRole('link', { name: 'À propos' })).toHaveAttribute('href', '/a-propos');
      // Un seul lien par destination : aucun doublon de /agences ou /a-propos.
      expect(screen.getAllByRole('link', { name: 'Agences' })).toHaveLength(1);
      expect(screen.getAllByRole('link', { name: 'À propos' })).toHaveLength(1);
    });

    it('les liens tel:/mailto: reprennent les coordonnées du footer', async () => {
      const user = userEvent.setup();
      render(<NearMeProvider><NavbarClient locale="fr" labels={LABELS} /></NearMeProvider>);
      await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));

      expect(screen.getByRole('link', { name: /\+221 78 132 15 95/ })).toHaveAttribute('href', 'tel:+221781321595');
      expect(screen.getByRole('link', { name: /alloappart221@gmail\.com/ })).toHaveAttribute('href', 'mailto:alloappart221@gmail.com');
    });

    it('un clic sur un lien d\'information referme le tiroir', async () => {
      const user = userEvent.setup();
      render(<NearMeProvider><NavbarClient locale="fr" labels={LABELS} /></NearMeProvider>);
      await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
      await user.click(screen.getByRole('link', { name: /navFaq/ }));
      expect(screen.queryByRole('link', { name: /navFaq/ })).not.toBeInTheDocument();
    });
  });

  describe('lot « recette » — en-tête au-dessus de la bannière cookies/barre de contact quand le menu est ouvert', () => {
    it("menu fermé : l'en-tête reste à z-50, pas de z-[80]", () => {
      const { container } = render(<NearMeProvider><NavbarClient locale="fr" labels={LABELS} /></NearMeProvider>);
      const header = container.querySelector('header');
      expect(header?.className).toContain('z-50');
      expect(header?.className).not.toContain('z-[80]');
    });

    it('menu ouvert : le z-[80] est appliqué (passe au-dessus de la bannière cookies z-60 et de la barre de contact z-70)', async () => {
      const user = userEvent.setup();
      const { container } = render(<NearMeProvider><NavbarClient locale="fr" labels={LABELS} /></NearMeProvider>);
      await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));

      const header = container.querySelector('header');
      expect(header?.className).toContain('z-[80]');
    });

    it('menu refermé : le z-[80] est retiré, retour à z-50 seul', async () => {
      const user = userEvent.setup();
      const { container } = render(<NearMeProvider><NavbarClient locale="fr" labels={LABELS} /></NearMeProvider>);
      await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
      expect(container.querySelector('header')?.className).toContain('z-[80]');

      await user.click(screen.getByRole('button', { name: 'Fermer le menu' }));
      expect(container.querySelector('header')?.className).not.toContain('z-[80]');
    });
  });
});
