import { MiloService } from './milo.service';

describe('MiloService.parseQuery', () => {
  const service = new MiloService();

  it('requête FR comprise : understood=true, filtres posés, langue détectée', () => {
    const r = service.parseQuery({
      text: 'F3 climatise a louer sous 400 000',
      defaultLocale: 'fr',
    });
    expect(r.understood).toBe(true);
    expect(r.detectedLanguage).toBe('fr');
    expect(r.strictFilters).toMatchObject({
      minRooms: 3,
      maxRooms: 3,
      maxPrice: 400000,
      transactionType: 'LOCATION',
      amenities: ['clim'],
    });
    expect(r.ambiguities).toEqual([]);
  });

  it('requête EN comprise : understood=true, langue détectée en', () => {
    const r = service.parseQuery({
      text: 'I am looking for an apartment for rent in Dakar',
      defaultLocale: 'fr',
    });
    expect(r.understood).toBe(true);
    expect(r.detectedLanguage).toBe('en');
  });

  it('requête mélangée : les deux dictionnaires contribuent, understood=true', () => {
    const r = service.parseQuery({
      text: '2 bedrooms a Dakar sous 300k',
      defaultLocale: 'fr',
    });
    expect(r.understood).toBe(true);
    expect(r.strictFilters.minBeds).toBe(2);
    expect(r.strictFilters.maxBeds).toBe(2);
    expect(r.strictFilters.maxPrice).toBe(300000);
    expect(r.strictFilters.region).toBe('Dakar');
  });

  it("texte vide ou fait d'espaces : understood=false, aucune erreur, aucun filtre", () => {
    const r1 = service.parseQuery({ text: '', defaultLocale: 'fr' });
    expect(r1.understood).toBe(false);
    expect(r1.strictFilters).toEqual({});
    expect(r1.ambiguities).toEqual([]);

    const r2 = service.parseQuery({ text: '   ', defaultLocale: 'en' });
    expect(r2.understood).toBe(false);
    expect(r2.detectedLanguage).toBe('en');
  });

  it('préférence floue seule → understood=true même sans filtre strict', () => {
    const r = service.parseQuery({
      text: 'calme et proche de la mer',
      defaultLocale: 'fr',
    });
    expect(r.strictFilters).toEqual({});
    expect(r.softPreferences.length).toBeGreaterThan(0);
    expect(r.understood).toBe(true);
  });

  it('texte ni filtre ni préférence reconnue → understood=false', () => {
    const r = service.parseQuery({
      text: 'bonjour tout le monde',
      defaultLocale: 'fr',
    });
    expect(r.strictFilters).toEqual({});
    expect(r.softPreferences).toEqual([]);
    expect(r.understood).toBe(false);
  });

  it('ambiguïté (deux types) : remontée dans ambiguities, type absent de strictFilters', () => {
    const r = service.parseQuery({
      text: 'appartement et villa a vendre',
      defaultLocale: 'fr',
    });
    expect(r.strictFilters.type).toBeUndefined();
    expect(r.ambiguities).toContain('type');
  });

  it('ambiguïté (deux régions) : remontée dans ambiguities', () => {
    const r = service.parseQuery({
      text: 'Dakar et Thies',
      defaultLocale: 'fr',
    });
    expect(r.strictFilters.region).toBeUndefined();
    expect(r.ambiguities).toContain('region');
  });

  it('respecte defaultLocale pour le repli de langue', () => {
    const r = service.parseQuery({
      text: 'villa Almadies',
      defaultLocale: 'en',
    });
    expect(r.detectedLanguage).toBe('en');
  });
});
