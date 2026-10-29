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
    expect(r.strictFilters.city).toBeUndefined();
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
      expect(extractCriteria(name).strictFilters.city).toBeUndefined();
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
    expect(r.strictFilters.city).toBe(city);
    expect(r.strictFilters.region).toBe(region);
  });

  it('villes à tiret reconnues comme un seul mot ("Joal-Fadiouth")', () => {
    const r = extractCriteria('Joal-Fadiouth');
    expect(r.strictFilters.city).toBe('Joal-Fadiouth');
    expect(r.strictFilters.region).toBe('Thiès');
  });

  it('ville à plusieurs mots reconnue en entier ("Nioro du Rip", "Médina Yoro Foulah")', () => {
    expect(extractCriteria('Nioro du Rip').strictFilters.city).toBe(
      'Nioro du Rip',
    );
    expect(extractCriteria('Nioro du Rip').strictFilters.region).toBe(
      'Kaolack',
    );
    expect(extractCriteria('Médina Yoro Foulah').strictFilters.city).toBe(
      'Médina Yoro Foulah',
    );
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
    expect(r.strictFilters.city).toBe(place);
    expect(r.strictFilters.region).toBe(region);
  });

  it('"Île de Saint-Louis" (plusieurs mots + tiret interne) reconnu en entier', () => {
    const r = extractCriteria('Île de Saint-Louis');
    expect(r.strictFilters.city).toBe('Île de Saint-Louis');
    expect(r.strictFilters.region).toBe('Saint-Louis');
  });

  it('"Mbour Plage" (quartier) ≠ "Mbour" (ville) — multi-mots reconnu en entier avant le mot isolé', () => {
    const r = extractCriteria('Mbour Plage');
    expect(r.strictFilters.city).toBe('Mbour Plage');
    const rCityOnly = extractCriteria('Mbour');
    expect(rCityOnly.strictFilters.city).toBe('Mbour');
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
    expect(extractCriteria('Saint Louis').strictFilters.city).toBeUndefined();
    expect(extractCriteria('St Louis').strictFilters.region).toBe(
      'Saint-Louis',
    );
  });

  it('"Almadie" (singulier) → city=Almadies, region=Dakar', () => {
    const r = extractCriteria('Almadie');
    expect(r.strictFilters.city).toBe('Almadies');
    expect(r.strictFilters.region).toBe('Dakar');
  });

  it('"Saly Portudal" (forme longue) → city=Saly, region=Thiès', () => {
    const r = extractCriteria('Saly Portudal');
    expect(r.strictFilters.city).toBe('Saly');
    expect(r.strictFilters.region).toBe('Thiès');
  });
});

describe('extractPlaces — NÉGATIF : aliases volontairement non créés', () => {
  it('"Parcelles Assainies" : absent de regions.ts, jamais inventé, reste non extrait', () => {
    const r = extractCriteria('Parcelles Assainies');
    expect(r.strictFilters.city).toBeUndefined();
    expect(r.strictFilters.region).toBeUndefined();
    expect(r.unmatchedTokens).toEqual(['parcelles', 'assainies']);
  });

  it('"Keur Massar" : absent de regions.ts, jamais inventé, reste non extrait', () => {
    const r = extractCriteria('Keur Massar');
    expect(r.strictFilters.city).toBeUndefined();
    expect(r.unmatchedTokens).toEqual(['keur', 'massar']);
  });

  it('"Point E" : absent de regions.ts, jamais inventé, reste non extrait', () => {
    const r = extractCriteria('Point E');
    expect(r.strictFilters.city).toBeUndefined();
    expect(r.unmatchedTokens).toEqual(['point', 'e']);
  });
});

describe('extractPlaces — faux positifs (règle 6)', () => {
  it('"point" et "liberte" seuls ne matchent rien (absents du dictionnaire de lieux)', () => {
    expect(extractCriteria('point').strictFilters.city).toBeUndefined();
    expect(extractCriteria('point').unmatchedTokens).toEqual(['point']);
    expect(extractCriteria('liberte').strictFilters.city).toBeUndefined();
    expect(extractCriteria('liberte').unmatchedTokens).toEqual(['liberte']);
  });

  it('"plateau" seul correspond bien au quartier canonique (comportement attendu, pas un faux positif à corriger)', () => {
    const r = extractCriteria('plateau');
    expect(r.strictFilters.city).toBe('Plateau');
    expect(r.strictFilters.region).toBe('Dakar');
  });
});

describe('extractPlaces — tolérance aux fautes (6+ lettres, candidat unique)', () => {
  it('tolère une lettre manquante sur un nom de 6+ lettres ("Almadie" déjà couvert par alias ; "Almadiess" faute inverse)', () => {
    expect(extractCriteria('Almadiess').strictFilters.city).toBe('Almadies');
  });

  it('ne tolère aucune faute sur un nom court ("Saly" → "Saly" faute non testable, "Yoff" 4 lettres)', () => {
    const r = extractCriteria('Yoff');
    expect(r.strictFilters.city).toBe('Yoff');
    const typo = extractCriteria('Yof');
    expect(typo.strictFilters.city).toBeUndefined();
  });

  it('tolère une substitution sur "Tivaouane" (9 lettres)', () => {
    expect(extractCriteria('Tivaoune').strictFilters.city).toBe('Tivaouane');
  });
});

describe('extractPlaces — conflits (règle 3)', () => {
  it('deux régions différentes dans la même requête → aucun lieu extrait', () => {
    const r = extractCriteria('Dakar et Thiès');
    expect(r.strictFilters.region).toBeUndefined();
    expect(r.strictFilters.city).toBeUndefined();
    expect(r.unmatchedTokens).toEqual([]);
  });

  it('deux régions sans connecteur ("Dakar Thiès") → conflit, rien extrait', () => {
    const r = extractCriteria('Dakar Thiès');
    expect(r.strictFilters.region).toBeUndefined();
  });

  it('deux quartiers différents de la MÊME région → region seule, pas de city', () => {
    const r = extractCriteria('Mermoz et Almadies');
    expect(r.strictFilters.region).toBe('Dakar');
    expect(r.strictFilters.city).toBeUndefined();
  });

  it('région + ville de la MÊME région → les deux cohabitent normalement', () => {
    const r = extractCriteria('Thiès et Mbour');
    expect(r.strictFilters.region).toBe('Thiès');
    expect(r.strictFilters.city).toBe('Mbour');
  });
});

describe('extractPlaces — ambiguïté entre régions (règle 2)', () => {
  it('"Centre-ville" seul (partagé par Thiès ET Tambacounda) → city certain, region non déduite', () => {
    const r = extractCriteria('Centre-ville');
    expect(r.strictFilters.city).toBe('Centre-ville');
    expect(r.strictFilters.region).toBeUndefined();
  });

  it('"Centre-ville à Thiès" : la région explicite lève l\'ambiguïté', () => {
    const r = extractCriteria('Centre-ville a Thies');
    expect(r.strictFilters.region).toBe('Thiès');
    expect(r.strictFilters.city).toBe('Centre-ville');
  });

  it('"Centre-ville à Tambacounda" : idem pour l\'autre région', () => {
    const r = extractCriteria('Centre-ville a Tambacounda');
    expect(r.strictFilters.region).toBe('Tambacounda');
    expect(r.strictFilters.city).toBe('Centre-ville');
  });

  it('« Kédougou » : la région gagne toujours sur la ville homonyme de Tambacounda', () => {
    const r = extractCriteria('Kédougou');
    expect(r.strictFilters.region).toBe('Kédougou');
    expect(r.strictFilters.city).toBeUndefined();
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
    expect(r.strictFilters.city).toBe('Almadies');
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
    expect(r.strictFilters.city).toBeUndefined();
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
      city: 'Mermoz',
    });
  });

  it('"2 bedrooms in Almadies under 300k" (le quartier est bien extrait, pas juste la ville)', () => {
    const r = extractCriteria('2 bedrooms in Almadies under 300k');
    expect(r.strictFilters).toMatchObject({
      minBeds: 2,
      maxBeds: 2,
      maxPrice: 300000,
      region: 'Dakar',
      city: 'Almadies',
    });
  });

  it('"villa à Saly à vendre"', () => {
    const r = extractCriteria('villa à Saly à vendre');
    expect(r.strictFilters).toMatchObject({
      type: 'VILLA',
      transactionType: 'VENTE',
      region: 'Thiès',
      city: 'Saly',
    });
  });

  it('"appart Plateau Dakar"', () => {
    const r = extractCriteria('appart Plateau Dakar');
    expect(r.strictFilters).toMatchObject({
      type: 'APPARTEMENT',
      region: 'Dakar',
      city: 'Plateau',
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
      city: 'Plateau',
    });
  });

  it('conflit chambres ET conflit lieux combinés dans la même requête', () => {
    const r = extractCriteria('2 chambres a Thies et 3 chambres a Dakar');
    expect(r.strictFilters.minBeds).toBeUndefined();
    expect(r.strictFilters.maxBeds).toBeUndefined();
    expect(r.strictFilters.region).toBeUndefined();
    expect(r.strictFilters.city).toBeUndefined();
  });
});
