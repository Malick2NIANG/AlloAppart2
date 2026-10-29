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
