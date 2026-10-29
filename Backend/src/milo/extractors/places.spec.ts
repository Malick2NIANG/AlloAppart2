import { extractCriteria } from '../extractCriteria';

describe('extractPlaces — régions (règle 1 : nom de région seul = region only)', () => {
  it.each([
    'Dakar',
    'Thiès',
    'Saint-Louis',
    'Ziguinchor',
    'Kaolack',
    'Diourbel',
    'Louga',
    'Tambacounda',
    'Kolda',
    'Fatick',
    'Kaffrine',
    'Kédougou',
    'Matam',
    'Sédhiou',
  ])('"%s" seul → region=%s uniquement, pas de city', (name) => {
    const r = extractCriteria(name);
    expect(r.strictFilters.region).toBe(name);
    expect(r.strictFilters.cityContains).toBeUndefined();
  });

  it('tolère la casse et les accents retirés ("thies" minuscule sans accent)', () => {
    expect(extractCriteria('thies').strictFilters.region).toBe('Thiès');
    expect(extractCriteria('THIES').strictFilters.region).toBe('Thiès');
    expect(extractCriteria('kedougou').strictFilters.region).toBe('Kédougou');
  });

  it('une région auto-coïncidente avec sa ville capitale ne met jamais city (toutes les régions)', () => {
    // Chaque région a une ville du même nom dans `cities` — la règle doit
    // s'appliquer uniformément, pas seulement pour Dakar.
    for (const name of ['Kaolack', 'Fatick', 'Matam', 'Louga']) {
      expect(extractCriteria(name).strictFilters.cityContains).toBeUndefined();
    }
  });
});

describe('extractPlaces — villes connues (règle 2 : city + region déduite)', () => {
  it.each([
    ['Pikine', 'Dakar'],
    ['Guédiawaye', 'Dakar'],
    ['Rufisque', 'Dakar'],
    ['Bargny', 'Dakar'],
    ['Mbour', 'Thiès'],
    ['Tivaouane', 'Thiès'],
    ['Richard-Toll', 'Saint-Louis'],
    ['Dagana', 'Saint-Louis'],
    ['Bignona', 'Ziguinchor'],
    ['Oussouye', 'Ziguinchor'],
    ['Touba', 'Diourbel'],
    ['Mbacké', 'Diourbel'],
    ['Linguère', 'Louga'],
    ['Bakel', 'Tambacounda'],
    ['Vélingara', 'Kolda'],
    ['Foundiougne', 'Fatick'],
    ['Koungheul', 'Kaffrine'],
    ['Saraya', 'Kédougou'],
    ['Kanel', 'Matam'],
    ['Bounkiling', 'Sédhiou'],
  ])('"%s" → city=%s, region=%s déduite', (city, region) => {
    const r = extractCriteria(city);
    expect(r.strictFilters.cityContains).toBe(city);
    expect(r.strictFilters.region).toBe(region);
  });

  it('villes à tiret reconnues comme un seul mot ("Joal-Fadiouth")', () => {
    const r = extractCriteria('Joal-Fadiouth');
    expect(r.strictFilters.cityContains).toBe('Joal-Fadiouth');
    expect(r.strictFilters.region).toBe('Thiès');
  });

  it('ville à plusieurs mots reconnue en entier ("Nioro du Rip", "Médina Yoro Foulah")', () => {
    expect(extractCriteria('Nioro du Rip').strictFilters.cityContains).toBe(
      'Nioro du Rip',
    );
    expect(extractCriteria('Nioro du Rip').strictFilters.region).toBe(
      'Kaolack',
    );
    expect(
      extractCriteria('Médina Yoro Foulah').strictFilters.cityContains,
    ).toBe('Médina Yoro Foulah');
    expect(extractCriteria('Médina Yoro Foulah').strictFilters.region).toBe(
      'Kolda',
    );
  });
});

describe('extractPlaces — quartiers / highlights (règle 2)', () => {
  it.each([
    ['Plateau', 'Dakar'],
    ['Almadies', 'Dakar'],
    ['Mermoz', 'Dakar'],
    ['Ouakam', 'Dakar'],
    ['Yoff', 'Dakar'],
    ['Saly', 'Thiès'],
    ['Cap Skirring', 'Ziguinchor'],
    ['Kafountine', 'Ziguinchor'],
    ['Médina Baye', 'Kaolack'],
    ['Ndorong', 'Kaolack'],
    ['Léona', 'Kaolack'],
    ['Guet Ndar', 'Saint-Louis'],
    ['Bassari', 'Kédougou'],
    ['Dindefelo', 'Kédougou'],
    ['Bord du fleuve', 'Matam'],
    ['Bords du Casamance', 'Sédhiou'],
    ['Sine-Saloum', 'Fatick'],
  ])('"%s" → city=%s, region=%s déduite', (place, region) => {
    const r = extractCriteria(place);
    expect(r.strictFilters.cityContains).toBe(place);
    expect(r.strictFilters.region).toBe(region);
  });

  it('"Île de Saint-Louis" (plusieurs mots + tiret interne) reconnu en entier', () => {
    const r = extractCriteria('Île de Saint-Louis');
    expect(r.strictFilters.cityContains).toBe('Île de Saint-Louis');
    expect(r.strictFilters.region).toBe('Saint-Louis');
  });

  it('"Mbour Plage" (quartier) ≠ "Mbour" (ville) — multi-mots reconnu en entier avant le mot isolé', () => {
    const r = extractCriteria('Mbour Plage');
    expect(r.strictFilters.cityContains).toBe('Mbour Plage');
    const rCityOnly = extractCriteria('Mbour');
    expect(rCityOnly.strictFilters.cityContains).toBe('Mbour');
  });
});

describe('extractPlaces — aliases (variantes à la main)', () => {
  it('"Thies" (sans accent) → region=Thiès', () => {
    expect(extractCriteria('Thies').strictFilters.region).toBe('Thiès');
  });

  it('"Saint Louis" et "St Louis" (sans tiret) → region=Saint-Louis, pas de city', () => {
    expect(extractCriteria('Saint Louis').strictFilters.region).toBe(
      'Saint-Louis',
    );
    expect(
      extractCriteria('Saint Louis').strictFilters.cityContains,
    ).toBeUndefined();
    expect(extractCriteria('St Louis').strictFilters.region).toBe(
      'Saint-Louis',
    );
  });

  it('"Almadie" (singulier) → city=Almadies, region=Dakar', () => {
    const r = extractCriteria('Almadie');
    expect(r.strictFilters.cityContains).toBe('Almadies');
    expect(r.strictFilters.region).toBe('Dakar');
  });

  it('"Saly Portudal" (forme longue) → city=Saly, region=Thiès', () => {
    const r = extractCriteria('Saly Portudal');
    expect(r.strictFilters.cityContains).toBe('Saly');
    expect(r.strictFilters.region).toBe('Thiès');
  });
});

// Lot 2b : Parcelles Assainies / Keur Massar / Point E / Liberté sont
// désormais des quartiers RÉELS fournis par Malick dans quartiers.ts — ce
// qui était volontairement non extrait au lot 2 (absent de regions.ts)
// devient une extraction normale, cityContains + region Dakar.
describe('extractPlaces — quartiers réels ajoutés au lot 2b (quartiers.ts)', () => {
  it('"Parcelles Assainies" (désormais dans quartiers.ts) → cityContains + region=Dakar', () => {
    const r = extractCriteria('Parcelles Assainies');
    expect(r.strictFilters.cityContains).toBe('Parcelles Assainies');
    expect(r.strictFilters.region).toBe('Dakar');
    expect(r.unmatchedTokens).toEqual([]);
  });

  it('"Keur Massar" (désormais dans quartiers.ts) → cityContains + region=Dakar', () => {
    const r = extractCriteria('Keur Massar');
    expect(r.strictFilters.cityContains).toBe('Keur Massar');
    expect(r.strictFilters.region).toBe('Dakar');
  });

  it('"Point E" (désormais dans quartiers.ts) → cityContains + region=Dakar', () => {
    const r = extractCriteria('Point E');
    expect(r.strictFilters.cityContains).toBe('Point E');
    expect(r.strictFilters.region).toBe('Dakar');
  });

  it('"Sacré-Cœur" (accent + ligature œ) → cityContains + region=Dakar', () => {
    const r = extractCriteria('Sacré-Cœur');
    expect(r.strictFilters.cityContains).toBe('Sacré-Cœur');
    expect(r.strictFilters.region).toBe('Dakar');
  });

  it('"Liberté" → cityContains + region=Dakar (plus un faux positif à éviter, un vrai quartier)', () => {
    const r = extractCriteria('Liberté');
    expect(r.strictFilters.cityContains).toBe('Liberté');
    expect(r.strictFilters.region).toBe('Dakar');
  });

  it('"Patte d\'Oie" (apostrophe interne) → cityContains + region=Dakar', () => {
    const r = extractCriteria("Patte d'Oie");
    expect(r.strictFilters.cityContains).toBe("Patte d'Oie");
    expect(r.strictFilters.region).toBe('Dakar');
  });

  it.each([
    'Médina',
    'Fann',
    'Ouakam',
    'Ngor',
    'HLM',
    'Grand Yoff',
    'Castors',
    'Sicap',
    'Bopp',
    'Colobane',
    'Hann',
    'Gueule Tapée',
    'Ouest Foire',
    'VDN',
    'Amitié',
    'Grand Dakar',
    'Dieuppeul',
    'Derklé',
    'Cambérène',
    'Yeumbeul',
    'Thiaroye',
    'Malika',
    'Golf',
    'Diamniadio',
  ])(
    'quartier Dakar "%s" (quartiers.ts) → cityContains + region=Dakar',
    (name) => {
      const r = extractCriteria(name);
      expect(r.strictFilters.cityContains).toBe(name);
      expect(r.strictFilters.region).toBe('Dakar');
    },
  );

  it.each(['Somone', 'Ngaparou', 'Popenguine'])(
    'quartier Thiès "%s" (quartiers.ts) → cityContains + region=Thiès',
    (name) => {
      const r = extractCriteria(name);
      expect(r.strictFilters.cityContains).toBe(name);
      expect(r.strictFilters.region).toBe('Thiès');
    },
  );

  it('fautes de frappe tolérées sur un quartier de 6+ lettres ("Thiaroy" → Thiaroye, "Diamniado" → Diamniadio)', () => {
    expect(extractCriteria('Thiaroy').strictFilters.cityContains).toBe(
      'Thiaroye',
    );
    expect(extractCriteria('Diamniado').strictFilters.cityContains).toBe(
      'Diamniadio',
    );
  });

  it("doublon entre places.data.ts et quartiers.ts (ex. Rufisque, Pikine, Mbour, Saly) : une seule résolution cohérente, pas d'erreur", () => {
    expect(extractCriteria('Rufisque').strictFilters.cityContains).toBe(
      'Rufisque',
    );
    expect(extractCriteria('Rufisque').strictFilters.region).toBe('Dakar');
    expect(extractCriteria('Pikine').strictFilters.cityContains).toBe('Pikine');
    expect(extractCriteria('Mbour').strictFilters.cityContains).toBe('Mbour');
    expect(extractCriteria('Mbour').strictFilters.region).toBe('Thiès');
  });
});

describe('extractPlaces — faux positifs (règle 6)', () => {
  it('"point" seul (sans "E") ne matche rien — seule la phrase "Point E" entière est un quartier', () => {
    expect(extractCriteria('point').strictFilters.cityContains).toBeUndefined();
    expect(extractCriteria('point').unmatchedTokens).toEqual(['point']);
  });

  it('"plateau" seul correspond bien au quartier canonique (comportement attendu, pas un faux positif à corriger)', () => {
    const r = extractCriteria('plateau');
    expect(r.strictFilters.cityContains).toBe('Plateau');
    expect(r.strictFilters.region).toBe('Dakar');
  });
});

describe('extractPlaces — tolérance aux fautes (6+ lettres, candidat unique)', () => {
  it('tolère une lettre manquante sur un nom de 6+ lettres ("Almadie" déjà couvert par alias ; "Almadiess" faute inverse)', () => {
    expect(extractCriteria('Almadiess').strictFilters.cityContains).toBe(
      'Almadies',
    );
  });

  it('ne tolère aucune faute sur un nom court ("Saly" → "Saly" faute non testable, "Yoff" 4 lettres)', () => {
    const r = extractCriteria('Yoff');
    expect(r.strictFilters.cityContains).toBe('Yoff');
    const typo = extractCriteria('Yof');
    expect(typo.strictFilters.cityContains).toBeUndefined();
  });

  it('tolère une substitution sur "Tivaouane" (9 lettres)', () => {
    expect(extractCriteria('Tivaoune').strictFilters.cityContains).toBe(
      'Tivaouane',
    );
  });
});

describe('extractPlaces — conflits (règle 3)', () => {
  it('deux régions différentes dans la même requête → aucun lieu extrait', () => {
    const r = extractCriteria('Dakar et Thiès');
    expect(r.strictFilters.region).toBeUndefined();
    expect(r.strictFilters.cityContains).toBeUndefined();
    expect(r.unmatchedTokens).toEqual([]);
  });

  it('deux régions sans connecteur ("Dakar Thiès") → conflit, rien extrait', () => {
    const r = extractCriteria('Dakar Thiès');
    expect(r.strictFilters.region).toBeUndefined();
  });

  it('deux quartiers différents de la MÊME région → region seule, pas de city', () => {
    const r = extractCriteria('Mermoz et Almadies');
    expect(r.strictFilters.region).toBe('Dakar');
    expect(r.strictFilters.cityContains).toBeUndefined();
  });

  it('région + ville de la MÊME région → les deux cohabitent normalement', () => {
    const r = extractCriteria('Thiès et Mbour');
    expect(r.strictFilters.region).toBe('Thiès');
    expect(r.strictFilters.cityContains).toBe('Mbour');
  });
});

describe('extractPlaces — ambiguïté entre régions (règle 2)', () => {
  it('"Centre-ville" seul (partagé par Thiès ET Tambacounda) → city certain, region non déduite', () => {
    const r = extractCriteria('Centre-ville');
    expect(r.strictFilters.cityContains).toBe('Centre-ville');
    expect(r.strictFilters.region).toBeUndefined();
  });

  it('"Centre-ville à Thiès" : la région explicite lève l\'ambiguïté', () => {
    const r = extractCriteria('Centre-ville a Thies');
    expect(r.strictFilters.region).toBe('Thiès');
    expect(r.strictFilters.cityContains).toBe('Centre-ville');
  });

  it('"Centre-ville à Tambacounda" : idem pour l\'autre région', () => {
    const r = extractCriteria('Centre-ville a Tambacounda');
    expect(r.strictFilters.region).toBe('Tambacounda');
    expect(r.strictFilters.cityContains).toBe('Centre-ville');
  });

  it('« Kédougou » : la région gagne toujours sur la ville homonyme de Tambacounda', () => {
    const r = extractCriteria('Kédougou');
    expect(r.strictFilters.region).toBe('Kédougou');
    expect(r.strictFilters.cityContains).toBeUndefined();
  });
});

describe('extractPlaces — indépendance de la langue (règle 5)', () => {
  it('un lieu ne compte jamais dans signals.fr ni signals.en', () => {
    const r = extractCriteria('Dakar');
    expect(r.signals.fr).toBe(0);
    expect(r.signals.en).toBe(0);
  });

  it('dans une phrase mixte, seuls les mots-clés linguistiques comptent dans signals, pas le lieu', () => {
    const r = extractCriteria('2 bedrooms in Almadies under 300k');
    expect(r.strictFilters.cityContains).toBe('Almadies');
    expect(r.signals.fr).toBe(0);
    expect(r.signals.en).toBeGreaterThan(0);
  });
});

describe('extractPlaces — ne retraite pas les tokens déjà consommés par le lot 1 (règle 7)', () => {
  it('"proche de la mer" reste une préférence floue, jamais un lieu', () => {
    const r = extractCriteria('calme et proche de la mer');
    expect(r.softPreferences).toEqual(
      expect.arrayContaining(['near_sea', 'quiet']),
    );
    expect(r.strictFilters.region).toBeUndefined();
    expect(r.strictFilters.cityContains).toBeUndefined();
  });
});

describe('extractPlaces — phrases complètes (exemples du cahier des charges)', () => {
  it('"F3 à Mermoz pour moins de 400 000"', () => {
    const r = extractCriteria('F3 à Mermoz pour moins de 400 000');
    expect(r.strictFilters).toMatchObject({
      minRooms: 3,
      maxRooms: 3,
      maxPrice: 400000,
      region: 'Dakar',
      cityContains: 'Mermoz',
    });
  });

  it('"2 bedrooms in Almadies under 300k" (le quartier est bien extrait, pas juste la ville)', () => {
    const r = extractCriteria('2 bedrooms in Almadies under 300k');
    expect(r.strictFilters).toMatchObject({
      minBeds: 2,
      maxBeds: 2,
      maxPrice: 300000,
      region: 'Dakar',
      cityContains: 'Almadies',
    });
  });

  it('"F3 à Médina" (quartier ajouté au lot 2b)', () => {
    const r = extractCriteria('F3 à Médina');
    expect(r.strictFilters).toMatchObject({
      minRooms: 3,
      maxRooms: 3,
      region: 'Dakar',
      cityContains: 'Médina',
    });
  });

  it('région explicite + quartier réel de cette même région (quartiers.ts) : les deux se combinent, pas de conflit', () => {
    const r = extractCriteria('appart Dakar Parcelles Assainies');
    expect(r.strictFilters.type).toBe('APPARTEMENT');
    expect(r.strictFilters.region).toBe('Dakar');
    expect(r.strictFilters.cityContains).toBe('Parcelles Assainies');
  });

  it('homonyme région/ville : "Kédougou" garde la priorité région même entourée de quartiers Dakar sans rapport (pas de confusion inter-listes)', () => {
    const r = extractCriteria('Kédougou');
    expect(r.strictFilters.region).toBe('Kédougou');
    expect(r.strictFilters.cityContains).toBeUndefined();
  });

  it('"villa à Saly à vendre"', () => {
    const r = extractCriteria('villa à Saly à vendre');
    expect(r.strictFilters).toMatchObject({
      type: 'VILLA',
      transactionType: 'VENTE',
      region: 'Thiès',
      cityContains: 'Saly',
    });
  });

  it('"appart Plateau Dakar"', () => {
    const r = extractCriteria('appart Plateau Dakar');
    expect(r.strictFilters).toMatchObject({
      type: 'APPARTEMENT',
      region: 'Dakar',
      cityContains: 'Plateau',
    });
  });

  it('villa, piscine, vente, budget en millions, région et quartier combinés', () => {
    const r = extractCriteria(
      'villa avec piscine a Dakar Plateau a vendre sous 100 millions',
    );
    expect(r.strictFilters).toMatchObject({
      type: 'VILLA',
      transactionType: 'VENTE',
      amenities: ['piscine'],
      maxPrice: 100_000_000,
      region: 'Dakar',
      cityContains: 'Plateau',
    });
  });

  it('conflit chambres ET conflit lieux combinés dans la même requête', () => {
    const r = extractCriteria('2 chambres a Thies et 3 chambres a Dakar');
    expect(r.strictFilters.minBeds).toBeUndefined();
    expect(r.strictFilters.maxBeds).toBeUndefined();
    expect(r.strictFilters.region).toBeUndefined();
    expect(r.strictFilters.cityContains).toBeUndefined();
  });
});
