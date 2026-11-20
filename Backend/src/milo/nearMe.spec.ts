import { detectNearMe } from './nearMe';
import type { MiloStrictFilters } from './types';

const NONE: MiloStrictFilters = {};

describe('detectNearMe — lot « raccourci » (près de moi)', () => {
  it.each([
    'studio pres de moi',
    'je cherche un appartement pres de moi',
    'y a-t-il des annonces autour de moi ?',
    'montre-moi les logements a proximite',
    "un logement proche de moi s'il te plait",
    'villa pres de moi a louer',
    'chambre a proximite pour ce soir',
    'appartement autour de moi avec clim',
    'studio near me',
    'show me apartments near me',
    'are there any listings around me ?',
    'find a place close to me',
    'anything nearby ?',
    'villa near me for rent',
    'room nearby for tonight',
    'apartment around me with ac',
    'deux chambres pres de moi climatisees',
    'y a-t-il un studio a proximite ?',
    'je veux un logement proche de moi pas cher',
    '2 bedrooms near me under 200k',
  ])('détecte nearMe pour "%s"', (text) => {
    expect(detectNearMe(text, NONE)).toBe(true);
  });

  it.each(['loin de moi', 'far from me'])(
    'piège : "%s" n\'est jamais nearMe (sens opposé)',
    (text) => {
      expect(detectNearMe(text, NONE)).toBe(false);
    },
  );

  it.each([
    'studio pres de la mer',
    'appartement near the beach',
    'chambre close to the market',
  ])(
    "piège : \"%s\" n'est jamais nearMe (proche d'autre chose que l'utilisateur)",
    (text) => {
      expect(detectNearMe(text, NONE)).toBe(false);
    },
  );

  it('piège : "studio pres de Mermoz" — un quartier déjà extrait fait toujours gagner le lieu nommé', () => {
    const strictFilters: MiloStrictFilters = { cityContains: 'Mermoz' };
    expect(detectNearMe('studio pres de Mermoz', strictFilters)).toBe(false);
  });

  it('piège : "villa pres de Saly a vendre" — une région déjà extraite fait toujours gagner le lieu nommé', () => {
    const strictFilters: MiloStrictFilters = { region: 'Thiès' };
    expect(detectNearMe('villa pres de Saly a vendre', strictFilters)).toBe(
      false,
    );
  });

  it('additif : coexiste avec des critères de recherche normaux (type/équipements), jamais un court-circuit', () => {
    // Simule l'orchestration réelle (milo.service.ts) : nearMe reste vrai
    // même quand d'autres critères (hors lieu) ont été extraits par ailleurs.
    const strictFiltersWithoutLocation: MiloStrictFilters = {
      type: 'STUDIO',
      amenities: ['clim'],
    };
    expect(
      detectNearMe(
        'studio climatise pres de moi',
        strictFiltersWithoutLocation,
      ),
    ).toBe(true);
  });

  it('texte vide : jamais nearMe', () => {
    expect(detectNearMe('', NONE)).toBe(false);
  });

  it('aucun marqueur : jamais nearMe', () => {
    expect(detectNearMe('appartement 2 chambres a Dakar', NONE)).toBe(false);
  });
});
