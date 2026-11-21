import type { ListingType } from '@prisma/client';
import { generateDescription } from './generateDescription';
import { verifyDescription } from './verifyDescription';
import type { WriterInput } from './types';

const ALL_TYPES: ListingType[] = [
  'APPARTEMENT',
  'VILLA',
  'STUDIO',
  'CHAMBRE',
  'BUREAU',
  'TERRAIN',
  'MAISON',
  'LOCAL_COMMERCIAL',
];

describe('generateDescription — un cas par type de bien (LOCATION, mode MONTHLY sauf TERRAIN)', () => {
  it.each(ALL_TYPES)('%s — texte non vide, passe le contrôle', (type) => {
    const isLand = type === 'TERRAIN';
    const input: WriterInput = {
      locale: 'fr',
      type,
      transactionType: isLand ? 'VENTE' : 'LOCATION',
      rentalMode: isLand ? undefined : 'MONTHLY',
      city: 'Dakar',
      surface: isLand ? 400 : 90,
      amenities: isLand ? ['viabilise'] : ['wifi'],
      price: isLand ? 15000000 : 200000,
    };
    const text = generateDescription(input);
    expect(text.length).toBeGreaterThan(0);
    expect(verifyDescription(text, input).ok).toBe(true);
  });
});

describe('generateDescription — par transaction et mode de location', () => {
  it('VENTE : mentionne le prix de vente, jamais de loyer/caution', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'VILLA',
      transactionType: 'VENTE',
      city: 'Dakar',
      price: 80000000,
    };
    const text = generateDescription(input);
    expect(text).toMatch(/vente|vendre/i);
    expect(text).not.toMatch(/loyer|caution/i);
  });

  it('LOCATION/NIGHTLY : tarif par nuit, jamais de loyer mensuel', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'STUDIO',
      transactionType: 'LOCATION',
      rentalMode: 'NIGHTLY',
      city: 'Saly',
      pricePerNight: 20000,
    };
    const text = generateDescription(input);
    expect(text).toMatch(/nuit/i);
    expect(text).not.toMatch(/loyer mensuel/i);
  });

  it('LOCATION/MONTHLY : tarif mensuel, jamais de tarif par nuit', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'STUDIO',
      transactionType: 'LOCATION',
      rentalMode: 'MONTHLY',
      city: 'Dakar',
      price: 150000,
    };
    const text = generateDescription(input);
    expect(text).toMatch(/mois/i);
    expect(text).not.toMatch(/nuit/i);
  });

  it('LOCATION/MIXED avec price et pricePerNight : les deux formules apparaissent', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'VILLA',
      transactionType: 'LOCATION',
      rentalMode: 'MIXED',
      city: 'Ngor',
      price: 900000,
      pricePerNight: 40000,
    };
    const text = generateDescription(input);
    expect(text).toContain('40 000');
    expect(text).toContain('900 000');
    expect(verifyDescription(text, input).ok).toBe(true);
  });

  it('LOCATION/MIXED avec un seul des deux prix renseigné : ne casse pas, ne mentionne que ce prix', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'VILLA',
      transactionType: 'LOCATION',
      rentalMode: 'MIXED',
      city: 'Ngor',
      price: 900000,
    };
    const text = generateDescription(input);
    expect(text).toContain('900 000');
    expect(verifyDescription(text, input).ok).toBe(true);
  });
});

describe('generateDescription — champs partiels et vides', () => {
  it('uniquement type + ville : toujours 2 à 4 paragraphes, passe le contrôle', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'APPARTEMENT',
      city: 'Dakar',
    };
    const text = generateDescription(input);
    const paragraphs = text.split('\n\n');
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    expect(paragraphs.length).toBeLessThanOrEqual(4);
    expect(verifyDescription(text, input).ok).toBe(true);
  });

  it('uniquement type (ni ville ni région) : ne mentionne aucun lieu', () => {
    const input: WriterInput = { locale: 'fr', type: 'STUDIO' };
    const text = generateDescription(input);
    expect(text).not.toMatch(/\bà \p{Lu}/u);
    expect(verifyDescription(text, input).ok).toBe(true);
  });

  it('région seule (sans ville) : mentionne la région, jamais une ville', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'APPARTEMENT',
      region: 'Thiès',
    };
    const text = generateDescription(input);
    expect(text).toContain('Thiès');
    expect(verifyDescription(text, input).ok).toBe(true);
  });

  it('terrain : jamais de pièces/chambres/sdb même si fournies par erreur', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'TERRAIN',
      city: 'Diamniadio',
      surface: 300,
    };
    const text = generateDescription(input);
    expect(text).not.toMatch(/pièce|chambre|salle de bain/i);
  });
});

describe('generateDescription — ameublement', () => {
  it('meublé (FR)', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'STUDIO',
      city: 'Dakar',
      furnished: true,
    };
    const text = generateDescription(input);
    expect(text).toMatch(/meublé/i);
    expect(text).not.toMatch(/non meublé/i);
  });

  it('non meublé (FR)', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'STUDIO',
      city: 'Dakar',
      furnished: false,
    };
    const text = generateDescription(input);
    expect(text).toMatch(/non meublé/i);
  });

  it('furnished (EN)', () => {
    const input: WriterInput = {
      locale: 'en',
      type: 'STUDIO',
      city: 'Dakar',
      furnished: true,
    };
    const text = generateDescription(input);
    expect(text).toMatch(/furnished/i);
    expect(text).not.toMatch(/unfurnished/i);
  });

  it('unfurnished (EN)', () => {
    const input: WriterInput = {
      locale: 'en',
      type: 'STUDIO',
      city: 'Dakar',
      furnished: false,
    };
    const text = generateDescription(input);
    expect(text).toMatch(/unfurnished/i);
  });

  it('champ furnished absent : jamais mentionné', () => {
    const input: WriterInput = { locale: 'fr', type: 'STUDIO', city: 'Dakar' };
    const text = generateDescription(input);
    expect(text).not.toMatch(/meublé/i);
  });
});

describe('generateDescription — accords singulier/pluriel (FR)', () => {
  it('1 pièce / 1 chambre / 1 salle de bain : singulier', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'APPARTEMENT',
      city: 'Dakar',
      rooms: 1,
      beds: 1,
      baths: 1,
    };
    const text = generateDescription(input);
    expect(text).toContain('1 pièce');
    expect(text).not.toContain('1 pièces');
    expect(text).toContain('1 chambre');
    expect(text).not.toContain('1 chambres');
    expect(text).toContain('1 salle de bain');
    expect(text).not.toContain('1 salles de bain');
  });

  it('2 pièces / 3 chambres / 2 salles de bain : pluriel', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'APPARTEMENT',
      city: 'Dakar',
      rooms: 2,
      beds: 3,
      baths: 2,
    };
    const text = generateDescription(input);
    expect(text).toContain('2 pièces');
    expect(text).toContain('3 chambres');
    expect(text).toContain('2 salles de bain');
    expect(text).not.toContain('2 salles de bains');
  });

  it('1 nuit minimum / plusieurs nuits : accord correct', () => {
    const one: WriterInput = {
      locale: 'fr',
      type: 'STUDIO',
      transactionType: 'LOCATION',
      rentalMode: 'NIGHTLY',
      city: 'Dakar',
      minimumNights: 1,
    };
    expect(generateDescription(one)).toContain('1 nuit');
    expect(generateDescription(one)).not.toContain('1 nuits');
    const many: WriterInput = { ...one, minimumNights: 5 };
    expect(generateDescription(many)).toContain('5 nuits');
  });

  it('« mois » reste invariable (1 mois / 6 mois)', () => {
    const one: WriterInput = {
      locale: 'fr',
      type: 'APPARTEMENT',
      transactionType: 'LOCATION',
      rentalMode: 'MONTHLY',
      city: 'Dakar',
      price: 150000,
      depositMonths: 1,
    };
    expect(generateDescription(one)).toContain('1 mois');
    const many: WriterInput = { ...one, depositMonths: 6 };
    // « mois » est invariable en français : rien à accorder, contrairement
    // à pièce(s)/chambre(s)/nuit(s) — on vérifie juste l'absence d'un pluriel
    // erroné du type « moisS ».
    expect(generateDescription(many)).toContain('6 mois');
    expect(generateDescription(many)).not.toMatch(/mois s\b/i);
  });
});

describe('generateDescription — accords singulier/pluriel (EN)', () => {
  it('1 room/bedroom/bathroom : singulier', () => {
    const input: WriterInput = {
      locale: 'en',
      type: 'APPARTEMENT',
      city: 'Dakar',
      rooms: 1,
      beds: 1,
      baths: 1,
    };
    const text = generateDescription(input);
    expect(text).toContain('1 room');
    expect(text).not.toContain('1 rooms');
    expect(text).toContain('1 bedroom');
    expect(text).not.toContain('1 bedrooms');
    expect(text).toContain('1 bathroom');
    expect(text).not.toContain('1 bathrooms');
  });

  it('2 rooms/3 bedrooms/2 bathrooms : pluriel', () => {
    const input: WriterInput = {
      locale: 'en',
      type: 'APPARTEMENT',
      city: 'Dakar',
      rooms: 2,
      beds: 3,
      baths: 2,
    };
    const text = generateDescription(input);
    expect(text).toContain('2 rooms');
    expect(text).toContain('3 bedrooms');
    expect(text).toContain('2 bathrooms');
  });
});

describe('generateDescription — caractères spéciaux dans la ville', () => {
  it.each([
    'Saint-Louis',
    'Thiès',
    'Keur Massar',
    "N'Dioum",
    'Dakar (Plateau)',
  ])('ville "%s" reprise telle quelle, contrôle passé', (city) => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'APPARTEMENT',
      city,
      surface: 60,
    };
    const text = generateDescription(input);
    expect(text).toContain(city);
    expect(verifyDescription(text, input).ok).toBe(true);
  });
});

describe('generateDescription — déterminisme et variantes', () => {
  it('même entrée → même texte (appelé plusieurs fois)', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'APPARTEMENT',
      city: 'Dakar',
      surface: 85,
      rooms: 3,
    };
    const first = generateDescription(input);
    for (let i = 0; i < 5; i++) expect(generateDescription(input)).toBe(first);
  });

  it('deux combinaisons différentes ne produisent pas un texte identique', () => {
    const a: WriterInput = {
      locale: 'fr',
      type: 'APPARTEMENT',
      city: 'Dakar',
      surface: 85,
      rooms: 3,
    };
    const b: WriterInput = {
      locale: 'fr',
      type: 'APPARTEMENT',
      city: 'Thiès',
      surface: 60,
      rooms: 2,
    };
    expect(generateDescription(a)).not.toBe(generateDescription(b));
  });
});

describe('generateDescription — accord en genre du pronom par type (FR, corrections relecture)', () => {
  // Féminin : chambre, villa, maison. Masculin : le reste.
  const FEMININE: ListingType[] = ['CHAMBRE', 'VILLA', 'MAISON'];
  const MASCULINE: ListingType[] = [
    'APPARTEMENT',
    'STUDIO',
    'BUREAU',
    'TERRAIN',
    'LOCAL_COMMERCIAL',
  ];

  it.each(FEMININE)(
    '%s — jamais de pronom masculin (il/Il) dans le texte',
    (type) => {
      const input: WriterInput = {
        locale: 'fr',
        type,
        city: 'Dakar',
        surface: 80,
        baths: 1,
        furnished: true,
      };
      // Force les 3 variantes de chaque emplacement de phrase (seed différente par itération).
      for (let i = 0; i < 20; i++) {
        const text = generateDescription({ ...input, region: `Région${i}` });
        expect(text).not.toMatch(/\bil\b/i);
        expect(
          verifyDescription(text, { ...input, region: `Région${i}` }).ok,
        ).toBe(true);
      }
    },
  );

  it.each(MASCULINE)(
    '%s — jamais de pronom féminin (elle/Elle) dans le texte',
    (type) => {
      const input: WriterInput = {
        locale: 'fr',
        type,
        city: 'Dakar',
        surface: 80,
        furnished: true,
      };
      for (let i = 0; i < 20; i++) {
        const text = generateDescription({ ...input, region: `Région${i}` });
        expect(text).not.toMatch(/\belle\b/i);
      }
    },
  );

  it('ne mélange jamais « Elle dispose » et « Il est proposé » dans le même texte', () => {
    // Cas qui a motivé la correction : caractéristiques (pronom accordé) +
    // ameublement (autrefois toujours « Il », quel que soit le type).
    for (let i = 0; i < 30; i++) {
      const input: WriterInput = {
        locale: 'fr',
        type: 'VILLA',
        city: 'Dakar',
        region: `R${i}`,
        surface: 200,
        furnished: true,
      };
      const text = generateDescription(input);
      const hasIl = /\bil\b/i.test(text);
      const hasElle = /\belle\b/i.test(text);
      expect(hasIl && hasElle).toBe(false);
    }
  });
});

describe('generateDescription — type CHAMBRE : pas de décompte de chambres (redondant)', () => {
  it("FR — « chambre » ne doit jamais être suivi d'un nombre de chambres", () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'CHAMBRE',
      city: 'Dakar',
      beds: 1,
      baths: 1,
    };
    const text = generateDescription(input);
    expect(text).not.toMatch(/\d+\s*chambres?/);
    expect(text).toContain('salle de bain');
    expect(verifyDescription(text, input).ok).toBe(true);
  });

  it('EN — bedroom count is never mentioned for type CHAMBRE', () => {
    const input: WriterInput = {
      locale: 'en',
      type: 'CHAMBRE',
      city: 'Dakar',
      beds: 1,
      baths: 1,
    };
    const text = generateDescription(input);
    expect(text).not.toMatch(/\d+\s*bedrooms?/);
    expect(text).toContain('bathroom');
    expect(verifyDescription(text, input).ok).toBe(true);
  });
});

describe('generateDescription — expressions non fondées sur les champs : jamais présentes', () => {
  const FORBIDDEN_FR = [
    /entièrement/i,
    /prêt à vivre/i,
    /répond à vos besoins/i,
  ];
  const FORBIDDEN_EN = [/\bfully\b/i, /ready to live/i, /meets your needs/i];

  it('FR — meublé/non meublé, toutes variantes, sur tous les types', () => {
    for (const type of ALL_TYPES) {
      for (const furnished of [true, false]) {
        for (let i = 0; i < 10; i++) {
          const text = generateDescription({
            locale: 'fr',
            type,
            city: 'Dakar',
            region: `R${i}`,
            furnished,
          });
          for (const re of FORBIDDEN_FR) expect(text).not.toMatch(re);
        }
      }
    }
  });

  it('EN — furnished/unfurnished, all variants, across types', () => {
    for (const type of ALL_TYPES) {
      for (const furnished of [true, false]) {
        for (let i = 0; i < 10; i++) {
          const text = generateDescription({
            locale: 'en',
            type,
            city: 'Dakar',
            region: `R${i}`,
            furnished,
          });
          for (const re of FORBIDDEN_EN) expect(text).not.toMatch(re);
        }
      }
    }
  });

  it('FR — caractéristiques (surface/pièces), toutes variantes', () => {
    for (let i = 0; i < 10; i++) {
      const text = generateDescription({
        locale: 'fr',
        type: 'APPARTEMENT',
        city: 'Dakar',
        region: `R${i}`,
        surface: 90,
        rooms: 3,
      });
      for (const re of FORBIDDEN_FR) expect(text).not.toMatch(re);
    }
  });
});

describe('generateDescription — minLeaseMonths repris fidèlement, sans règle de tarif inventée', () => {
  it('FR — MONTHLY : « Durée minimale » factuelle, jamais de condition de seuil', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'APPARTEMENT',
      transactionType: 'LOCATION',
      rentalMode: 'MONTHLY',
      city: 'Dakar',
      price: 150000,
      minLeaseMonths: 6,
    };
    const text = generateDescription(input);
    expect(text).toMatch(/durée minimale.*6 mois/i);
    expect(text).not.toMatch(/au-delà|bascule|applicable|s'applique/i);
  });

  it('FR — MIXED : les deux tarifs tels quels, minLeaseMonths factuel, jamais de condition de seuil', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'VILLA',
      transactionType: 'LOCATION',
      rentalMode: 'MIXED',
      city: 'Dakar',
      price: 900000,
      pricePerNight: 40000,
      minLeaseMonths: 3,
    };
    const text = generateDescription(input);
    expect(text).toContain('40 000');
    expect(text).toContain('900 000');
    expect(text).toMatch(/durée minimale.*3 mois/i);
    expect(text).not.toMatch(
      /au-delà|bascule|tarif mensuel s'applique|séjour de plus de/i,
    );
    expect(verifyDescription(text, input).ok).toBe(true);
  });

  it('EN — MONTHLY and MIXED : factual minimum term, never an invented threshold rule', () => {
    const monthly: WriterInput = {
      locale: 'en',
      type: 'APPARTEMENT',
      transactionType: 'LOCATION',
      rentalMode: 'MONTHLY',
      city: 'Dakar',
      price: 150000,
      minLeaseMonths: 6,
    };
    const mixed: WriterInput = {
      locale: 'en',
      type: 'VILLA',
      transactionType: 'LOCATION',
      rentalMode: 'MIXED',
      city: 'Dakar',
      price: 900000,
      pricePerNight: 40000,
      minLeaseMonths: 3,
    };
    for (const input of [monthly, mixed]) {
      const text = generateDescription(input);
      expect(text).toMatch(/minimum (term|lease term|commitment).*months?/i);
      expect(text).not.toMatch(
        /beyond|switches|monthly rate applies|stays longer than/i,
      );
    }
  });
});

describe('generateDescription — intitulés neutres (terrain / autres types / sanitaires)', () => {
  it('FR — terrain : « Atouts du terrain » (jamais « Vous profiterez de »)', () => {
    for (let i = 0; i < 10; i++) {
      const input: WriterInput = {
        locale: 'fr',
        type: 'TERRAIN',
        transactionType: 'VENTE',
        city: 'Dakar',
        region: `R${i}`,
        surface: 300,
        amenities: ['viabilise'],
        price: 9000000,
      };
      const text = generateDescription(input);
      expect(text).not.toMatch(/vous profiterez/i);
      expect(text).toMatch(
        /atouts du terrain|caractéristiques du terrain|ce terrain dispose/i,
      );
    }
  });

  it('EN — plot: "Plot features"/"Land features" (never "You will enjoy")', () => {
    for (let i = 0; i < 10; i++) {
      const input: WriterInput = {
        locale: 'en',
        type: 'TERRAIN',
        transactionType: 'VENTE',
        city: 'Dakar',
        region: `R${i}`,
        surface: 300,
        amenities: ['titre_foncier'],
        price: 9000000,
      };
      const text = generateDescription(input);
      expect(text).not.toMatch(/you will enjoy/i);
      expect(text).toMatch(/plot features|land features|this plot offers/i);
    }
  });

  it('FR — types non-terrain : intitulé « Équipements » neutre (jamais « Vous profiterez de »)', () => {
    for (let i = 0; i < 10; i++) {
      const input: WriterInput = {
        locale: 'fr',
        type: 'APPARTEMENT',
        city: 'Dakar',
        region: `R${i}`,
        amenities: ['wifi'],
      };
      const text = generateDescription(input);
      expect(text).not.toMatch(/vous profiterez/i);
    }
  });

  it('FR — bureau/local commercial, salle de bain seule : « Sanitaires » (jamais « Il/elle dispose »)', () => {
    for (const type of ['BUREAU', 'LOCAL_COMMERCIAL'] as ListingType[]) {
      const input: WriterInput = {
        locale: 'fr',
        type,
        city: 'Dakar',
        baths: 1,
      };
      const text = generateDescription(input);
      expect(text).toContain('Sanitaires : 1 salle de bain.');
    }
  });

  it('EN — office/commercial, bathroom only: "Facilities" (never "It offers"/"disposes")', () => {
    for (const type of ['BUREAU', 'LOCAL_COMMERCIAL'] as ListingType[]) {
      const input: WriterInput = {
        locale: 'en',
        type,
        city: 'Dakar',
        baths: 1,
      };
      const text = generateDescription(input);
      expect(text).toContain('Facilities: 1 bathroom.');
    }
  });
});

describe('generateDescription — typographie (casse des équipements, séparateurs de milliers, unités)', () => {
  it('FR — équipements en minuscules sauf Wi-Fi', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'APPARTEMENT',
      city: 'Dakar',
      amenities: ['wifi', 'clim', 'piscine', 'titre_foncier'],
    };
    const text = generateDescription({
      ...input,
      amenities: ['wifi', 'clim', 'piscine'],
    });
    expect(text).toContain('Wi-Fi');
    expect(text).toContain('climatisation');
    expect(text).toContain('piscine');
    expect(text).not.toContain('Climatisation');
    expect(text).not.toContain('Piscine');
  });

  it('EN — amenities lowercase except Wi-Fi', () => {
    const input: WriterInput = {
      locale: 'en',
      type: 'APPARTEMENT',
      city: 'Dakar',
      amenities: ['wifi', 'clim', 'piscine'],
    };
    const text = generateDescription(input);
    expect(text).toContain('Wi-Fi');
    expect(text).toContain('air conditioning');
    expect(text).toContain('swimming pool');
  });

  it('FR — surface avec séparateur de milliers (espace) : « 1 000 m² »', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'TERRAIN',
      transactionType: 'VENTE',
      city: 'Dakar',
      surface: 1000,
      price: 9000000,
    };
    const text = generateDescription(input);
    expect(text).toContain('1 000 m²');
  });

  it('EN — area with comma thousands separator and "m²" (never "sqm"): "1,000 m²"', () => {
    const input: WriterInput = {
      locale: 'en',
      type: 'TERRAIN',
      transactionType: 'VENTE',
      city: 'Dakar',
      surface: 1000,
      price: 9000000,
    };
    const text = generateDescription(input);
    expect(text).toContain('1,000 m²');
    expect(text).not.toMatch(/sqm/i);
  });

  it('EN — prices use comma thousands separator: "35,000,000 FCFA"', () => {
    const input: WriterInput = {
      locale: 'en',
      type: 'VILLA',
      transactionType: 'VENTE',
      city: 'Dakar',
      price: 35000000,
    };
    const text = generateDescription(input);
    expect(text).toContain('35,000,000 FCFA');
    expect(verifyDescription(text, input).ok).toBe(true);
  });
});
