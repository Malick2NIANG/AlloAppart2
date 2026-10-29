import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import MiloSearchBar, { type MiloSearchBarHandle } from './MiloSearchBar';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next-intl', () => ({ useLocale: () => 'fr' }));

const parseQuery = vi.fn();
vi.mock('@/lib/milo', async () => {
  const actual = await vi.importActual<typeof import('@/lib/milo')>('@/lib/milo');
  return { ...actual, parseQuery: (...args: unknown[]) => parseQuery(...args) };
});

describe('MiloSearchBar', () => {
  beforeEach(() => {
    push.mockReset();
    parseQuery.mockReset();
  });

  it('envoi : requête comprise → navigue vers /listings avec les strictFilters sérialisés + milo=1', async () => {
    parseQuery.mockResolvedValue({
      detectedLanguage: 'fr', languageConfidence: 1, languageMethod: 'dictionary',
      strictFilters: { region: 'Dakar', cityContains: 'Mermoz', minRooms: 3, maxRooms: 3 },
      softPreferences: [], unmatchedTokens: [], ambiguities: [], understood: true,
    });
    const user = userEvent.setup();
    render(<MiloSearchBar placeholder="p" ariaLabel="Recherche Milo" />);
    await user.type(screen.getByRole('textbox'), 'F3 à Mermoz');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const url = push.mock.calls[0][0] as string;
    expect(url.startsWith('/listings?')).toBe(true);
    expect(url).toContain('region=Dakar');
    expect(url).toContain('cityContains=Mermoz');
    expect(url).toContain('milo=1');
    expect(url).toContain('miloLang=fr');
  });

  it('repli : non compris → /listings?q=<texte>, sans paramètre milo', async () => {
    parseQuery.mockResolvedValue({
      detectedLanguage: 'fr', languageConfidence: 0, languageMethod: 'default',
      strictFilters: {}, softPreferences: [], unmatchedTokens: ['bla'], ambiguities: [], understood: false,
    });
    const user = userEvent.setup();
    render(<MiloSearchBar placeholder="p" ariaLabel="Recherche Milo" />);
    await user.type(screen.getByRole('textbox'), 'bla bla bla');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain('/listings?q=bla');
    expect(url).toContain('miloMiss=1');
    expect(url).not.toContain('milo=1');
  });

  it('repli silencieux : délai dépassé / erreur réseau (parseQuery renvoie null) → /listings?q=<texte> brut', async () => {
    parseQuery.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<MiloSearchBar placeholder="p" ariaLabel="Recherche Milo" />);
    await user.type(screen.getByRole('textbox'), 'villa Almadies');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/listings?q=villa%20Almadies');
  });

  it("pas de double envoi : un clic pendant le chargement n'appelle pas parseQuery deux fois", async () => {
    let resolve!: (v: unknown) => void;
    parseQuery.mockReturnValue(new Promise((r) => { resolve = r; }));
    const user = userEvent.setup();
    render(<MiloSearchBar placeholder="p" ariaLabel="Recherche Milo" />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'F3 Dakar');
    const button = screen.getByRole('button');
    await user.click(button);
    await user.click(button); // second clic pendant le chargement — ignoré
    expect(parseQuery).toHaveBeenCalledTimes(1);
    resolve({ detectedLanguage: 'fr', languageConfidence: 1, languageMethod: 'dictionary', strictFilters: {}, softPreferences: ['near_sea'], unmatchedTokens: [], ambiguities: [], understood: true });
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  });

  it('fillAndSubmit (ref, pastilles exemples) remplit le champ ET lance la recherche', async () => {
    parseQuery.mockResolvedValue({
      detectedLanguage: 'en', languageConfidence: 1, languageMethod: 'dictionary',
      strictFilters: { region: 'Dakar' }, softPreferences: [], unmatchedTokens: [], ambiguities: [], understood: true,
    });
    const ref = createRef<MiloSearchBarHandle>();
    render(<MiloSearchBar ref={ref} placeholder="p" ariaLabel="Recherche Milo" />);
    ref.current?.fillAndSubmit('2 bedrooms in Almadies');
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(parseQuery).toHaveBeenCalledWith('2 bedrooms in Almadies', 'fr');
  });
});
