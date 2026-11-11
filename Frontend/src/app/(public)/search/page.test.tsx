import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import SearchPage from './page';

// Lot « loupe du header » — /search garde sa route (liens existants) mais ne
// rend plus ses propres résultats : redirection via Milo, même repli que
// tout autre point d'entrée.

const replace = vi.fn();
let searchParamsValue = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParamsValue,
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (k: string) => k,
}));

const resolveMiloRedirectParams = vi.fn();
vi.mock('@/lib/milo', async () => {
  const actual = await vi.importActual<typeof import('@/lib/milo')>('@/lib/milo');
  return { ...actual, resolveMiloRedirectParams: (...args: unknown[]) => resolveMiloRedirectParams(...args) };
});

describe('/search — redirection Milo (lot « loupe du header »)', () => {
  beforeEach(() => {
    replace.mockReset();
    resolveMiloRedirectParams.mockReset();
    searchParamsValue = new URLSearchParams();
  });

  it('q vide → redirige vers /listings nu, Milo jamais appelé', async () => {
    render(<SearchPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/listings'));
    expect(resolveMiloRedirectParams).not.toHaveBeenCalled();
  });

  it('q présent, compris → redirige vers /listings avec les paramètres Milo', async () => {
    searchParamsValue = new URLSearchParams({ q: 'studio mermoz' });
    resolveMiloRedirectParams.mockResolvedValue(new URLSearchParams({ region: 'Dakar', milo: '1', miloLang: 'fr' }));
    render(<SearchPage />);

    await waitFor(() => expect(resolveMiloRedirectParams).toHaveBeenCalledWith('studio mermoz', 'fr'));
    await waitFor(() => expect(replace).toHaveBeenCalledWith(expect.stringContaining('/listings?region=Dakar')));
  });

  it('Milo indisponible → repli q brut vers /listings, comme les autres points d\'entrée', async () => {
    searchParamsValue = new URLSearchParams({ q: 'villa almadies' });
    resolveMiloRedirectParams.mockResolvedValue(new URLSearchParams({ q: 'villa almadies' }));
    render(<SearchPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/listings?q=villa+almadies'));
  });
});
