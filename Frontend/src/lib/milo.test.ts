import { describe, it, expect, vi, afterEach } from 'vitest';
import { strictFiltersToParams, resolveMiloRedirectParams } from './milo';

describe('strictFiltersToParams', () => {
  it('sérialise amenities en CSV, comme les filtres manuels existants', () => {
    const params = strictFiltersToParams({ amenities: ['wifi', 'clim'] });
    expect(params.amenities).toBe('wifi,clim');
  });

  it('nombres convertis en chaînes, champs absents omis', () => {
    const params = strictFiltersToParams({ minBeds: 2, maxBeds: 2, region: 'Dakar' });
    expect(params).toEqual({ minBeds: '2', maxBeds: '2', region: 'Dakar' });
    expect(params.maxPrice).toBeUndefined();
  });

  it('objet vide → aucun paramètre', () => {
    expect(strictFiltersToParams({})).toEqual({});
  });
});

describe('resolveMiloRedirectParams — logique partagée (lot « loupe du header »)', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('compris → strictFilters sérialisés + milo=1 + miloLang + miloText', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        detectedLanguage: 'fr', languageConfidence: 1, languageMethod: 'dictionary',
        strictFilters: { region: 'Dakar', minBeds: 2, maxBeds: 2 },
        softPreferences: [], unmatchedTokens: [], ambiguities: [], understood: true,
      }),
    }) as unknown as typeof fetch;

    const params = await resolveMiloRedirectParams('F3 à Dakar', 'fr');
    expect(params.get('region')).toBe('Dakar');
    expect(params.get('minBeds')).toBe('2');
    expect(params.get('milo')).toBe('1');
    expect(params.get('miloLang')).toBe('fr');
    expect(params.get('miloText')).toBe('F3 à Dakar');
  });

  it('non compris → q + miloMiss=1 + miloLang, jamais milo=1', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        detectedLanguage: 'fr', languageConfidence: 0, languageMethod: 'default',
        strictFilters: {}, softPreferences: [], unmatchedTokens: ['bla'], ambiguities: [], understood: false,
      }),
    }) as unknown as typeof fetch;

    const params = await resolveMiloRedirectParams('bla bla bla', 'fr');
    expect(params.get('q')).toBe('bla bla bla');
    expect(params.get('miloMiss')).toBe('1');
    expect(params.get('milo')).toBeNull();
  });

  it('erreur réseau/HTTP → repli silencieux sur q seul', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const params = await resolveMiloRedirectParams('villa Almadies', 'fr');
    expect([...params.keys()]).toEqual(['q']);
    expect(params.get('q')).toBe('villa Almadies');
  });
});
