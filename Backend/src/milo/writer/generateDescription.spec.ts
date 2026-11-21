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
