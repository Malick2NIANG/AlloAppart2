import { extractCriteria } from './extractCriteria';

describe('extractCriteria — montants (prix)', () => {
  it('FR "sous X" → maxPrice', () => {
    expect(extractCriteria('sous 400 000').strictFilters.maxPrice).toBe(400000);
  });

  it('FR "moins de X" → maxPrice', () => {
    expect(extractCriteria('moins de 300 000').strictFilters.maxPrice).toBe(
      300000,
    );
  });

  it('FR "budget Xk" → maxPrice (suffixe k)', () => {
    expect(extractCriteria('budget 150k').strictFilters.maxPrice).toBe(150000);
  });

  it('FR "a partir de X" → minPrice', () => {
    expect(extractCriteria('a partir de 500000').strictFilters.minPrice).toBe(
      500000,
    );
  });

  it('FR "minimum X" → minPrice', () => {
    expect(extractCriteria('minimum 500000').strictFilters.minPrice).toBe(
      500000,
    );
  });

  it('FR "entre X et Y millions" → min/maxPrice (multiplicateur partagé)', () => {
    const r = extractCriteria(
      'villa avec piscine a vendre entre 80 et 120 millions',
    );
    expect(r.strictFilters.minPrice).toBe(80_000_000);
    expect(r.strictFilters.maxPrice).toBe(120_000_000);
  });

  it('FR "de X a Y" → min/maxPrice', () => {
    const r = extractCriteria('de 200000 a 500000');
    expect(r.strictFilters.minPrice).toBe(200000);
    expect(r.strictFilters.maxPrice).toBe(500000);
  });

  it('EN "under X" → maxPrice', () => {
    expect(extractCriteria('under 300000').strictFilters.maxPrice).toBe(300000);
  });

  it('EN "from X" → minPrice', () => {
    expect(extractCriteria('from 500000').strictFilters.minPrice).toBe(500000);
  });

  it('EN "at least X" → minPrice', () => {
    expect(extractCriteria('at least 500000').strictFilters.minPrice).toBe(
      500000,
    );
  });

  it('EN "min X" → minPrice', () => {
    expect(extractCriteria('min 500000').strictFilters.minPrice).toBe(500000);
  });

  it('EN "between X and Y million" → min/maxPrice (multiplicateur partagé)', () => {
    const r = extractCriteria('between 80 and 120 million');
    expect(r.strictFilters.minPrice).toBe(80_000_000);
    expect(r.strictFilters.maxPrice).toBe(120_000_000);
  });

  it('EN "between X and Y" → min/maxPrice (sans multiplicateur, >= 1000)', () => {
    const r = extractCriteria('between 200000 and 500000');
    expect(r.strictFilters.minPrice).toBe(200000);
    expect(r.strictFilters.maxPrice).toBe(500000);
  });

  it('"1,5 million" avec mot-clé → minPrice', () => {
    expect(extractCriteria('minimum 1,5 million').strictFilters.minPrice).toBe(
      1_500_000,
    );
  });

  it('"2 millions" avec mot-clé → maxPrice', () => {
    expect(extractCriteria('max 2 millions').strictFilters.maxPrice).toBe(
      2_000_000,
    );
  });

  it('"1.5m" avec mot-clé → maxPrice', () => {
    expect(extractCriteria('under 1.5m').strictFilters.maxPrice).toBe(
      1_500_000,
    );
  });

  it('"350.000 FCFA" avec mot-clé → maxPrice (devise)', () => {
    expect(extractCriteria('sous 350.000 FCFA').strictFilters.maxPrice).toBe(
      350000,
    );
  });

  it('"350 000 f" avec mot-clé → maxPrice (devise courte)', () => {
    expect(extractCriteria('sous 350 000 f').strictFilters.maxPrice).toBe(
      350000,
    );
  });

  it('tolère les majuscules ("SOUS 400000")', () => {
    expect(extractCriteria('SOUS 400000').strictFilters.maxPrice).toBe(400000);
  });

  // ── Cas négatifs — principe directeur : en cas de doute, ne pas extraire ──
  it('NÉGATIF : "1,5 million" seul (sans mot-clé) n\'est pas extrait', () => {
    const r = extractCriteria('1,5 million');
    expect(r.strictFilters.minPrice).toBeUndefined();
    expect(r.strictFilters.maxPrice).toBeUndefined();
    expect(r.unmatchedTokens).toEqual(['1,5', 'million']);
  });

  it('NÉGATIF : "350.000 FCFA" seul (sans mot-clé) n\'est pas extrait', () => {
    const r = extractCriteria('350.000 FCFA');
    expect(r.strictFilters.maxPrice).toBeUndefined();
    expect(r.unmatchedTokens).toEqual(['350.000', 'fcfa']);
  });

  it('NÉGATIF : "villa 500k" sans mot-clé de borne reste non extrait', () => {
    const r = extractCriteria('villa 500k');
    expect(r.strictFilters.type).toBe('VILLA');
    expect(r.strictFilters.maxPrice).toBeUndefined();
    expect(r.strictFilters.minPrice).toBeUndefined();
    expect(r.unmatchedTokens).toEqual(['500k']);
  });

  it('NÉGATIF : "12" seul n\'est jamais un prix', () => {
    const r = extractCriteria('12');
    expect(r.strictFilters.maxPrice).toBeUndefined();
    expect(r.strictFilters.minPrice).toBeUndefined();
    expect(r.unmatchedTokens).toEqual(['12']);
  });

  it('NÉGATIF : "entre 2 et 5" (deux nombres < 1000, aucun multiplicateur) ne produit aucun prix', () => {
    const r = extractCriteria('entre 2 et 5');
    expect(r.strictFilters.minPrice).toBeUndefined();
    expect(r.strictFilters.maxPrice).toBeUndefined();
  });

  it('NÉGATIF : "2 chambres" ne devient jamais un prix', () => {
    const r = extractCriteria('2 chambres');
    expect(r.strictFilters.minPrice).toBeUndefined();
    expect(r.strictFilters.maxPrice).toBeUndefined();
    expect(r.strictFilters.minBeds).toBe(2);
  });

  it('NÉGATIF : un nombre suivi de "pieces" n\'est jamais un prix', () => {
    const r = extractCriteria('sous 3 pieces');
    expect(r.strictFilters.maxPrice).toBeUndefined();
  });
});

describe('extractCriteria — pièces (rooms) vs chambres (beds)', () => {
  it('"F3" → minRooms=maxRooms=3, pas de type', () => {
    const r = extractCriteria('F3');
    expect(r.strictFilters.minRooms).toBe(3);
    expect(r.strictFilters.maxRooms).toBe(3);
    expect(r.strictFilters.type).toBeUndefined();
  });

  it('"T3" → minRooms=maxRooms=3', () => {
    expect(extractCriteria('T3').strictFilters.minRooms).toBe(3);
  });

  it('"t 3" (espacé) → minRooms=maxRooms=3', () => {
    expect(extractCriteria('t 3').strictFilters.minRooms).toBe(3);
  });

  it('"3 pieces" FR → minRooms=maxRooms=3', () => {
    expect(extractCriteria('3 pieces').strictFilters.minRooms).toBe(3);
  });

  it('"3 rooms" / "3 room" EN → minRooms=maxRooms=3', () => {
    expect(extractCriteria('3 rooms').strictFilters.minRooms).toBe(3);
    expect(extractCriteria('3 room').strictFilters.minRooms).toBe(3);
  });

  it('"2 chambres" → minBeds=maxBeds=2 (valeur exacte par défaut)', () => {
    const r = extractCriteria('2 chambres');
    expect(r.strictFilters.minBeds).toBe(2);
    expect(r.strictFilters.maxBeds).toBe(2);
  });

  it('"2 ch" (abréviation FR) → minBeds=maxBeds=2', () => {
    expect(extractCriteria('2 ch').strictFilters.minBeds).toBe(2);
  });

  it('"2 bedrooms" / "2 bed" / "2 beds" EN → minBeds=maxBeds=2', () => {
    expect(extractCriteria('2 bedrooms').strictFilters.minBeds).toBe(2);
    expect(extractCriteria('2 bed').strictFilters.minBeds).toBe(2);
    expect(extractCriteria('2 beds').strictFilters.minBeds).toBe(2);
  });

  it('"2br" (forme collée EN) → minBeds=maxBeds=2', () => {
    const r = extractCriteria('2br');
    expect(r.strictFilters.minBeds).toBe(2);
    expect(r.strictFilters.maxBeds).toBe(2);
  });

  it('FR "au moins X chambres" / "plus de X chambres" → minBeds seul', () => {
    expect(extractCriteria('au moins 2 chambres').strictFilters.minBeds).toBe(
      2,
    );
    expect(
      extractCriteria('au moins 2 chambres').strictFilters.maxBeds,
    ).toBeUndefined();
    expect(extractCriteria('plus de 2 chambres').strictFilters.minBeds).toBe(2);
    expect(
      extractCriteria('plus de 2 chambres').strictFilters.maxBeds,
    ).toBeUndefined();
  });

  it('FR "au plus X chambres" / "maximum X chambres" → maxBeds seul', () => {
    expect(extractCriteria('au plus 3 chambres').strictFilters.maxBeds).toBe(3);
    expect(extractCriteria('maximum 3 chambres').strictFilters.maxBeds).toBe(3);
  });

  it('EN "at least X bedrooms" / "more than X bedrooms" → minBeds seul', () => {
    expect(extractCriteria('at least 2 bedrooms').strictFilters.minBeds).toBe(
      2,
    );
    expect(extractCriteria('more than 2 bedrooms').strictFilters.minBeds).toBe(
      2,
    );
  });

  it('EN "at most X bedrooms" / "max X bedrooms" → maxBeds seul', () => {
    expect(extractCriteria('at most 3 bedrooms').strictFilters.maxBeds).toBe(3);
    expect(extractCriteria('max 3 bedrooms').strictFilters.maxBeds).toBe(3);
  });

  it('"studio" → type STUDIO uniquement, aucun rooms/beds', () => {
    const r = extractCriteria('studio');
    expect(r.strictFilters.type).toBe('STUDIO');
    expect(r.strictFilters.minRooms).toBeUndefined();
    expect(r.strictFilters.minBeds).toBeUndefined();
  });

  it('NÉGATIF : "chambre" seule (sans nombre devant, hors phrase figée) reste non extraite', () => {
    const r = extractCriteria('chambre');
    expect(r.strictFilters.minBeds).toBeUndefined();
    expect(r.strictFilters.type).toBeUndefined();
    expect(r.unmatchedTokens).toEqual(['chambre']);
  });

  it('"chambre a louer" / "chambre meublee" / "chambre individuelle" → type CHAMBRE', () => {
    expect(extractCriteria('chambre a louer').strictFilters.type).toBe(
      'CHAMBRE',
    );
    expect(extractCriteria('chambre meublee').strictFilters.type).toBe(
      'CHAMBRE',
    );
    expect(extractCriteria('chambre individuelle').strictFilters.type).toBe(
      'CHAMBRE',
    );
  });

  it('"room for rent" / "single room" EN → type CHAMBRE', () => {
    expect(extractCriteria('room for rent').strictFilters.type).toBe('CHAMBRE');
    expect(extractCriteria('single room').strictFilters.type).toBe('CHAMBRE');
  });

  it('CONFLIT : "3 chambres, 2 bedrooms" (valeurs exactes différentes) → aucun beds extrait', () => {
    const r = extractCriteria('3 chambres, 2 bedrooms');
    expect(r.strictFilters.minBeds).toBeUndefined();
    expect(r.strictFilters.maxBeds).toBeUndefined();
  });

  it('pas de conflit si la même valeur est répétée deux fois ("4 chambres et 4 bedrooms")', () => {
    const r = extractCriteria('4 chambres et 4 bedrooms');
    expect(r.strictFilters.minBeds).toBe(4);
    expect(r.strictFilters.maxBeds).toBe(4);
  });

  it('rooms et beds coexistent sans interférence ("maison 3 pieces" + chambres ailleurs)', () => {
    const r = extractCriteria('maison 3 pieces proche de la mer calme');
    expect(r.strictFilters.minRooms).toBe(3);
    expect(r.strictFilters.minBeds).toBeUndefined();
  });
});

describe('extractCriteria — type de bien', () => {
  it('FR : appartement/appart → APPARTEMENT ; EN : apartment/flat', () => {
    expect(extractCriteria('appartement').strictFilters.type).toBe(
      'APPARTEMENT',
    );
    expect(extractCriteria('appart').strictFilters.type).toBe('APPARTEMENT');
    expect(extractCriteria('apartment').strictFilters.type).toBe('APPARTEMENT');
    expect(extractCriteria('flat').strictFilters.type).toBe('APPARTEMENT');
  });

  it('villa (FR/EN identique) → VILLA', () => {
    expect(extractCriteria('villa').strictFilters.type).toBe('VILLA');
  });

  it('FR : maison → MAISON ; EN : house → MAISON', () => {
    expect(extractCriteria('maison').strictFilters.type).toBe('MAISON');
    expect(extractCriteria('house').strictFilters.type).toBe('MAISON');
  });

  it('FR : bureau → BUREAU ; EN : office → BUREAU', () => {
    expect(extractCriteria('bureau').strictFilters.type).toBe('BUREAU');
    expect(extractCriteria('office').strictFilters.type).toBe('BUREAU');
  });

  it('FR : terrain/parcelle → TERRAIN ; EN : land/plot → TERRAIN', () => {
    expect(extractCriteria('terrain').strictFilters.type).toBe('TERRAIN');
    expect(extractCriteria('parcelle').strictFilters.type).toBe('TERRAIN');
    expect(extractCriteria('land').strictFilters.type).toBe('TERRAIN');
    expect(extractCriteria('plot').strictFilters.type).toBe('TERRAIN');
  });

  it('FR : local commercial/boutique/magasin → LOCAL_COMMERCIAL ; EN : shop', () => {
    expect(extractCriteria('local commercial').strictFilters.type).toBe(
      'LOCAL_COMMERCIAL',
    );
    expect(extractCriteria('boutique').strictFilters.type).toBe(
      'LOCAL_COMMERCIAL',
    );
    expect(extractCriteria('magasin').strictFilters.type).toBe(
      'LOCAL_COMMERCIAL',
    );
    expect(extractCriteria('shop').strictFilters.type).toBe('LOCAL_COMMERCIAL');
  });

  it('NÉGATIF : deux types différents dans la même requête → aucun type retenu', () => {
    expect(
      extractCriteria('appartement et villa a vendre').strictFilters.type,
    ).toBeUndefined();
    expect(
      extractCriteria('appartement et maison').strictFilters.type,
    ).toBeUndefined();
  });
});

describe('extractCriteria — transaction', () => {
  it('FR : louer/location/a louer/loyer → LOCATION', () => {
    expect(extractCriteria('louer').strictFilters.transactionType).toBe(
      'LOCATION',
    );
    expect(extractCriteria('location').strictFilters.transactionType).toBe(
      'LOCATION',
    );
    expect(extractCriteria('a louer').strictFilters.transactionType).toBe(
      'LOCATION',
    );
    expect(extractCriteria('loyer').strictFilters.transactionType).toBe(
      'LOCATION',
    );
  });

  it('EN : rent/for rent/to let → LOCATION', () => {
    expect(extractCriteria('for rent').strictFilters.transactionType).toBe(
      'LOCATION',
    );
    expect(extractCriteria('to let').strictFilters.transactionType).toBe(
      'LOCATION',
    );
  });

  it('FR : acheter/achat/vente/a vendre → VENTE', () => {
    expect(extractCriteria('acheter').strictFilters.transactionType).toBe(
      'VENTE',
    );
    expect(extractCriteria('achat').strictFilters.transactionType).toBe(
      'VENTE',
    );
    expect(extractCriteria('vente').strictFilters.transactionType).toBe(
      'VENTE',
    );
    expect(extractCriteria('a vendre').strictFilters.transactionType).toBe(
      'VENTE',
    );
  });

  it('EN : buy/for sale/purchase → VENTE', () => {
    expect(extractCriteria('buy').strictFilters.transactionType).toBe('VENTE');
    expect(extractCriteria('for sale').strictFilters.transactionType).toBe(
      'VENTE',
    );
    expect(extractCriteria('purchase').strictFilters.transactionType).toBe(
      'VENTE',
    );
  });

  it('NÉGATIF : location et vente présents ensemble → aucune transaction retenue', () => {
    expect(
      extractCriteria('louer et acheter').strictFilters.transactionType,
    ).toBeUndefined();
    expect(
      extractCriteria('rent and buy').strictFilters.transactionType,
    ).toBeUndefined();
  });
});

describe('extractCriteria — équipements (amenities)', () => {
  it('clim : climatise/climatisation/clim (FR) et ac/air conditioning (EN)', () => {
    expect(extractCriteria('climatise').strictFilters.amenities).toEqual([
      'clim',
    ]);
    expect(extractCriteria('climatisation').strictFilters.amenities).toEqual([
      'clim',
    ]);
    expect(extractCriteria('ac').strictFilters.amenities).toEqual(['clim']);
    expect(extractCriteria('air conditioning').strictFilters.amenities).toEqual(
      ['clim'],
    );
  });

  it('piscine/pool/swimming pool → piscine', () => {
    expect(extractCriteria('piscine').strictFilters.amenities).toEqual([
      'piscine',
    ]);
    expect(extractCriteria('pool').strictFilters.amenities).toEqual([
      'piscine',
    ]);
    expect(extractCriteria('swimming pool').strictFilters.amenities).toEqual([
      'piscine',
    ]);
  });

  it('gardien/securite/guard/security → gardien', () => {
    expect(extractCriteria('gardien').strictFilters.amenities).toEqual([
      'gardien',
    ]);
    expect(extractCriteria('securite').strictFilters.amenities).toEqual([
      'gardien',
    ]);
    expect(extractCriteria('guard').strictFilters.amenities).toEqual([
      'gardien',
    ]);
    expect(extractCriteria('security').strictFilters.amenities).toEqual([
      'gardien',
    ]);
  });

  it('generateur/groupe electrogene/generator → generateur', () => {
    expect(extractCriteria('generateur').strictFilters.amenities).toEqual([
      'generateur',
    ]);
    expect(
      extractCriteria('groupe electrogene').strictFilters.amenities,
    ).toEqual(['generateur']);
    expect(extractCriteria('generator').strictFilters.amenities).toEqual([
      'generateur',
    ]);
  });

  it('équipements terrain : viabilise, titre foncier, acces route / land title, road access', () => {
    const fr = extractCriteria(
      'terrain viabilise avec titre foncier et acces route',
    );
    expect(fr.strictFilters.amenities).toEqual(
      expect.arrayContaining(['viabilise', 'titre_foncier', 'acces_route']),
    );
    const en = extractCriteria('land with water and electricity');
    expect(en.strictFilters.amenities).toEqual(
      expect.arrayContaining(['eau', 'electricite']),
    );
  });

  it('cloture/fenced/fence → cloture', () => {
    expect(extractCriteria('cloture').strictFilters.amenities).toEqual([
      'cloture',
    ]);
    expect(extractCriteria('fenced').strictFilters.amenities).toEqual([
      'cloture',
    ]);
    expect(extractCriteria('fence').strictFilters.amenities).toEqual([
      'cloture',
    ]);
  });

  it('plusieurs équipements dans la même requête sont tous retenus', () => {
    const r = extractCriteria('appartement a louer avec wifi et parking');
    expect(r.strictFilters.amenities).toEqual(
      expect.arrayContaining(['wifi', 'parking']),
    );
  });

  it('tolère une faute d\'une lettre sur un synonyme de 6+ caractères ("piscne" → piscine)', () => {
    expect(extractCriteria('piscne a vendre').strictFilters.amenities).toEqual([
      'piscine',
    ]);
  });

  it('tolère une faute d\'une lettre EN ("climatize" → clim, via "climatise")', () => {
    expect(extractCriteria('climatize').strictFilters.amenities).toEqual([
      'clim',
    ]);
  });

  it('NÉGATIF : "meuble"/"furnished" n\'est pas une clé existante, jamais inventée', () => {
    expect(extractCriteria('meuble').strictFilters.amenities).toBeUndefined();
    expect(
      extractCriteria('furnished').strictFilters.amenities,
    ).toBeUndefined();
    expect(extractCriteria('meuble').unmatchedTokens).toEqual(['meuble']);
    expect(extractCriteria('furnished').unmatchedTokens).toEqual(['furnished']);
  });

  it('NÉGATIF : "clm" (mot-clé court "clim", 4 lettres) n\'est pas toléré en faute de frappe', () => {
    expect(extractCriteria('clm').strictFilters.amenities).toBeUndefined();
  });
});

describe('extractCriteria — préférences floues (softPreferences)', () => {
  it('FR : proche de la mer/bord de mer → near_sea ; EN : near the sea/beach/seafront', () => {
    expect(extractCriteria('proche de la mer').softPreferences).toEqual([
      'near_sea',
    ]);
    expect(extractCriteria('bord de mer').softPreferences).toEqual([
      'near_sea',
    ]);
    expect(extractCriteria('near the sea').softPreferences).toEqual([
      'near_sea',
    ]);
    expect(extractCriteria('beach').softPreferences).toEqual(['near_sea']);
    expect(extractCriteria('seafront').softPreferences).toEqual(['near_sea']);
  });

  it('FR : calme → quiet ; EN : quiet', () => {
    expect(extractCriteria('calme').softPreferences).toEqual(['quiet']);
    expect(extractCriteria('quiet').softPreferences).toEqual(['quiet']);
  });

  it('FR : standing/luxe → upscale ; EN : upscale/luxury/high end', () => {
    expect(extractCriteria('standing').softPreferences).toEqual(['upscale']);
    expect(extractCriteria('luxe').softPreferences).toEqual(['upscale']);
    expect(extractCriteria('upscale').softPreferences).toEqual(['upscale']);
    expect(extractCriteria('luxury').softPreferences).toEqual(['upscale']);
    expect(extractCriteria('high end').softPreferences).toEqual(['upscale']);
  });

  it('plusieurs préférences dans la même requête, jamais en filtre strict', () => {
    const r = extractCriteria('villa calme et luxe');
    expect(r.softPreferences).toEqual(
      expect.arrayContaining(['quiet', 'upscale']),
    );
    expect(r.strictFilters.minPrice).toBeUndefined();
  });

  it('upscale house near the sea → les deux préférences, aucun impact sur strictFilters', () => {
    const r = extractCriteria('upscale house near the sea');
    expect(r.softPreferences).toEqual(
      expect.arrayContaining(['near_sea', 'upscale']),
    );
    expect(r.strictFilters.type).toBe('MAISON');
  });
});

describe('extractCriteria — tolérance (accents, casse, fautes)', () => {
  it('ignore les accents ("climatisé" = "climatise")', () => {
    expect(extractCriteria('climatisé').strictFilters.amenities).toEqual([
      'clim',
    ]);
  });

  it('ignore la casse ("CLIMATISÉ", "Villa")', () => {
    expect(extractCriteria('CLIMATISÉ').strictFilters.amenities).toEqual([
      'clim',
    ]);
    expect(extractCriteria('Villa').strictFilters.type).toBe('VILLA');
  });

  it('accepte différents séparateurs de milliers avec mot-clé ("350 000", "350.000", "350k")', () => {
    expect(extractCriteria('sous 350 000').strictFilters.maxPrice).toBe(350000);
    expect(extractCriteria('sous 350.000').strictFilters.maxPrice).toBe(350000);
    expect(extractCriteria('sous 350k').strictFilters.maxPrice).toBe(350000);
  });

  it('NÉGATIF : aucune faute tolérée sur les nombres ("3500OO" n\'est pas "350000")', () => {
    const r = extractCriteria('sous 3500OO');
    expect(r.strictFilters.maxPrice).toBeUndefined();
  });
});

describe('extractCriteria — requêtes mixtes FR/EN (exemples du cahier des charges)', () => {
  it('"F3 climatisé à louer sous 400 000"', () => {
    const r = extractCriteria('F3 climatisé à louer sous 400 000');
    expect(r.strictFilters).toMatchObject({
      minRooms: 3,
      maxRooms: 3,
      transactionType: 'LOCATION',
      maxPrice: 400000,
      amenities: ['clim'],
    });
    expect(r.strictFilters.type).toBeUndefined();
  });

  it('"2 bedrooms à Dakar under 300k" (le lieu est désormais extrait depuis le lot 2 — dictionnaire des lieux)', () => {
    const r = extractCriteria('2 bedrooms à Dakar under 300k');
    expect(r.strictFilters.minBeds).toBe(2);
    expect(r.strictFilters.maxBeds).toBe(2);
    expect(r.strictFilters.maxPrice).toBe(300000);
    expect(r.strictFilters.region).toBe('Dakar');
    expect(r.unmatchedTokens).toEqual([]);
  });

  it('"studio meublé, budget 150k"', () => {
    const r = extractCriteria('studio meublé, budget 150k');
    expect(r.strictFilters.type).toBe('STUDIO');
    expect(r.strictFilters.maxPrice).toBe(150000);
    expect(r.unmatchedTokens).toEqual(['meuble']);
  });

  it('"villa avec piscine à vendre entre 80 et 120 millions"', () => {
    const r = extractCriteria(
      'villa avec piscine à vendre entre 80 et 120 millions',
    );
    expect(r.strictFilters).toMatchObject({
      type: 'VILLA',
      transactionType: 'VENTE',
      amenities: ['piscine'],
      minPrice: 80_000_000,
      maxPrice: 120_000_000,
    });
  });

  it('phrase à dictionnaires mélangés : "office for rent with ac and parking"', () => {
    const r = extractCriteria('office for rent with ac and parking');
    expect(r.strictFilters.type).toBe('BUREAU');
    expect(r.strictFilters.transactionType).toBe('LOCATION');
    expect(r.strictFilters.amenities).toEqual(
      expect.arrayContaining(['clim', 'parking']),
    );
  });
});

describe('extractCriteria — signals (comptage par langue, diagnostic)', () => {
  it('une requête purement FR a des signals.fr > 0 et signals.en = 0', () => {
    const r = extractCriteria('maison 3 pieces proche de la mer calme');
    expect(r.signals.fr).toBeGreaterThan(0);
    expect(r.signals.en).toBe(0);
  });

  it('une requête purement EN a des signals.en > 0 et signals.fr = 0', () => {
    const r = extractCriteria('at least 2 bedrooms');
    expect(r.signals.en).toBeGreaterThan(0);
    expect(r.signals.fr).toBe(0);
  });

  it('une requête mixte a des signals non nuls dans les deux langues', () => {
    const r = extractCriteria('2 bedrooms à Dakar under 300k');
    expect(r.signals.en).toBeGreaterThan(0);
  });
});

describe('extractCriteria — entrée vide / dégénérée', () => {
  it('chaîne vide → aucun filtre, aucun span', () => {
    const r = extractCriteria('');
    expect(r.strictFilters).toEqual({});
    expect(r.softPreferences).toEqual([]);
    expect(r.unmatchedTokens).toEqual([]);
  });
});
