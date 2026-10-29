import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListingsFilters from './ListingsFilters';

const push = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

let siteLocale: 'fr' | 'en' = 'fr';
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => siteLocale,
}));

describe('ListingsFilters — pastilles Milo (lot 5b)', () => {
  beforeEach(() => {
    push.mockReset();
    siteLocale = 'fr';
    params = new URLSearchParams();
  });

  it('affiche une pastille par équipement Milo (amenities CSV) et par critère cityContains/beds', () => {
    params = new URLSearchParams({
      cityContains: 'Mermoz', minBeds: '2', maxBeds: '2', amenities: 'wifi,clim',
      milo: '1', miloLang: 'fr', miloText: 'F3 a Mermoz',
    });
    render(<ListingsFilters limit={6} locale="fr" />);
    // Chaque pastille existe en double dans le DOM de test (rangée ≥768px +
    // rangée <768px, toutes deux présentes sous jsdom — seule une media query
    // CSS réelle les distingue visuellement) : getAllByText, pas getByText.
    expect(screen.getAllByText('Mermoz').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2 chambres').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Wi-Fi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Climatisation').length).toBeGreaterThan(0);
  });

  it('retirer la pastille équipement wifi met à jour l’URL sans elle, en gardant clim', async () => {
    params = new URLSearchParams({ amenities: 'wifi,clim', milo: '1', miloLang: 'fr' });
    const user = userEvent.setup();
    render(<ListingsFilters limit={6} locale="fr" />);
    const wifiChip = screen.getAllByText('Wi-Fi')[0].closest('span')!;
    await user.click(wifiChip.querySelector('button')!);
    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain('amenities=clim');
    expect(url).not.toContain('wifi');
    expect(url).toContain('milo=1'); // le contexte Milo n'est pas perdu par un simple retrait de pastille
  });

  it('bandeau "Milo a compris" en langue détectée (EN) même si le site est en FR', () => {
    siteLocale = 'fr';
    params = new URLSearchParams({ milo: '1', miloLang: 'en' });
    render(<ListingsFilters region="Dakar" limit={6} locale="fr" />);
    expect(screen.getByText(/Milo understood:/)).toBeInTheDocument();
  });

  it('langue non supportée → répond dans la langue du site (FR) avec la notice explicite', () => {
    siteLocale = 'en';
    params = new URLSearchParams({ milo: '1', miloLang: 'unsupported' });
    render(<ListingsFilters region="Dakar" limit={6} locale="fr" />);
    // siteLocale next-intl = 'en' ici, donc resolveMiloLocale('unsupported','en') = 'en'
    expect(screen.getByText(/doesn't understand this language yet/)).toBeInTheDocument();
  });

  it('bandeau "non compris" (miloMiss) invite à reformuler', () => {
    params = new URLSearchParams({ q: 'xyz', miloMiss: '1', miloLang: 'fr' });
    render(<ListingsFilters q="xyz" limit={6} locale="fr" />);
    expect(screen.getByText(/Milo n'a pas compris cette recherche/)).toBeInTheDocument();
  });

  it('bouton "Demander à Milo" ouvre la barre pré-remplie avec miloText (reformuler)', async () => {
    params = new URLSearchParams({ milo: '1', miloLang: 'fr', miloText: 'F3 a Mermoz' });
    const user = userEvent.setup();
    render(<ListingsFilters region="Dakar" limit={6} locale="fr" />);
    await user.click(screen.getByText('askMiloButton'));
    expect(screen.getByDisplayValue('F3 a Mermoz')).toBeInTheDocument();
  });
});

describe('ListingsFilters — pastilles de préférence floue (lot 6a)', () => {
  beforeEach(() => {
    push.mockReset();
    siteLocale = 'fr';
    params = new URLSearchParams();
  });

  it('affiche une pastille distincte « Milo classe en priorité : … » par préférence', () => {
    params = new URLSearchParams({ prefs: 'near_sea,quiet' });
    render(<ListingsFilters limit={6} locale="fr" />);
    expect(screen.getAllByText(/Milo classe en priorité :/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/proche de la mer/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/au calme/).length).toBeGreaterThan(0);
  });

  it('retirer une pastille de préférence met à jour l’URL sans elle, sans toucher aux autres paramètres', async () => {
    params = new URLSearchParams({ prefs: 'near_sea,quiet', region: 'Dakar' });
    const user = userEvent.setup();
    render(<ListingsFilters region="Dakar" limit={6} locale="fr" />);
    const chip = screen.getAllByText(/proche de la mer/)[0].closest('span')!;
    await user.click(chip.querySelector('button')!);
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain('prefs=quiet');
    expect(url).not.toContain('near_sea');
    expect(url).toContain('region=Dakar');
  });

  it('identifiant inconnu dans prefs (URL manipulée à la main) : aucune pastille, pas de crash', () => {
    params = new URLSearchParams({ prefs: 'bogus' });
    render(<ListingsFilters limit={6} locale="fr" />);
    expect(screen.queryByText(/Milo classe en priorité :/)).not.toBeInTheDocument();
  });

  it('message honnête quand prefsMatched=false : aucune pastille de filtre, juste le message', () => {
    params = new URLSearchParams({ prefs: 'near_sea' });
    render(<ListingsFilters limit={6} locale="fr" prefsMatched={false} />);
    expect(screen.getAllByText(/Aucune annonce ne mentionne/).length).toBeGreaterThan(0);
  });

  it('prefsMatched=true : pas de message honnête affiché', () => {
    params = new URLSearchParams({ prefs: 'near_sea' });
    render(<ListingsFilters limit={6} locale="fr" prefsMatched={true} />);
    expect(screen.queryByText(/Aucune annonce ne mentionne/)).not.toBeInTheDocument();
  });
});
