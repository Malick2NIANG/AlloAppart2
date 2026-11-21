import type { ListingType, RentalMode } from '@prisma/client';
import { generateDescription } from './generateDescription';
import { verifyDescription } from './verifyDescription';
import type { WriterInput } from './types';

/**
 * Tests de propriété (cf. Milo.md § Writer) : 500 combinaisons de champs
 * générées automatiquement avec une graine FIXE (mulberry32, jamais
 * Math.random) — reproductible, jamais d'aléatoire non maîtrisé.
 */
function mulberry32(seed: number) {
  let a = seed;
  return function random(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LOCATION_TYPES: ListingType[] = [
  'APPARTEMENT',
  'VILLA',
  'STUDIO',
  'CHAMBRE',
  'BUREAU',
  'MAISON',
  'LOCAL_COMMERCIAL',
];
const VENTE_TYPES: ListingType[] = [
  'APPARTEMENT',
  'VILLA',
  'TERRAIN',
  'MAISON',
  'LOCAL_COMMERCIAL',
];
const FURNISHED_TYPES: ListingType[] = [
  'APPARTEMENT',
  'VILLA',
  'STUDIO',
  'CHAMBRE',
  'MAISON',
];

// Reproduit Frontend/src/lib/listingProfile.ts (rooms/beds/baths pertinents + équipements proposés par type).
const HOME_AMENITIES = [
  'wifi',
  'clim',
  'tv',
  'cuisine',
  'douche',
  'gardien',
  'parking',
  'piscine',
  'balcon',
  'generateur',
];
const PROFILE: Record<
  ListingType,
  { rooms: boolean; beds: boolean; baths: boolean; amenities: string[] }
> = {
  APPARTEMENT: {
    rooms: true,
    beds: true,
    baths: true,
    amenities: HOME_AMENITIES,
  },
  VILLA: { rooms: true, beds: true, baths: true, amenities: HOME_AMENITIES },
  MAISON: { rooms: true, beds: true, baths: true, amenities: HOME_AMENITIES },
  STUDIO: { rooms: false, beds: true, baths: true, amenities: HOME_AMENITIES },
  CHAMBRE: { rooms: false, beds: true, baths: true, amenities: HOME_AMENITIES },
  BUREAU: {
    rooms: true,
    beds: false,
    baths: true,
    amenities: ['wifi', 'clim', 'parking', 'gardien', 'generateur', 'cuisine'],
  },
  LOCAL_COMMERCIAL: {
    rooms: false,
    beds: false,
    baths: true,
    amenities: ['clim', 'parking', 'gardien', 'generateur', 'wifi'],
  },
  TERRAIN: {
    rooms: false,
    beds: false,
    baths: false,
    amenities: [
      'viabilise',
      'eau',
      'electricite',
      'titre_foncier',
      'cloture',
      'acces_route',
    ],
  },
};

const PLACES: Array<[string, string]> = [
  ['Dakar', 'Dakar'],
  ['Thiès', 'Thiès'],
  ['Saly', 'Thiès'],
  ['Mbour', 'Thiès'],
  ['Rufisque', 'Dakar'],
  ['Ziguinchor', 'Ziguinchor'],
  ['Saint-Louis', 'Saint-Louis'],
  ['Kaolack', 'Kaolack'],
];

function pickOne<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function maybe<T>(
  rand: () => number,
  value: T,
  probability = 0.7,
): T | undefined {
  return rand() < probability ? value : undefined;
}

function buildInput(rand: () => number): WriterInput {
  const locale = pickOne(rand, ['fr', 'en'] as const);
  const transactionType = pickOne(rand, ['LOCATION', 'VENTE'] as const);
  const type = pickOne(
    rand,
    transactionType === 'VENTE' ? VENTE_TYPES : LOCATION_TYPES,
  );
  const profile = PROFILE[type];
  const rentalMode =
    transactionType === 'LOCATION'
      ? pickOne(rand, ['NIGHTLY', 'MONTHLY', 'MIXED'] as RentalMode[])
      : undefined;

  const [city, region] = pickOne(rand, PLACES);
  const hasCity = rand() < 0.85;

  const amenityPool = profile.amenities;
  const amenityCount = Math.floor(rand() * (amenityPool.length + 1));
  const shuffled = [...amenityPool].sort(() => rand() - 0.5);
  const amenities = shuffled.slice(0, amenityCount);

  const input: WriterInput = {
    locale,
    type,
    transactionType,
    rentalMode,
    city: hasCity ? city : undefined,
    region: maybe(rand, region, hasCity ? 0.4 : 0.9),
    surface: maybe(rand, Math.round(20 + rand() * 480)),
    rooms: profile.rooms ? maybe(rand, 1 + Math.floor(rand() * 6)) : undefined,
    beds: profile.beds ? maybe(rand, 1 + Math.floor(rand() * 5)) : undefined,
    baths: profile.baths ? maybe(rand, 1 + Math.floor(rand() * 3)) : undefined,
    amenities:
      amenities.length > 0 ? amenities : maybe(rand, [] as string[], 0),
    furnished: FURNISHED_TYPES.includes(type)
      ? maybe(rand, rand() < 0.5, 0.6)
      : undefined,
  };

  if (transactionType === 'VENTE') {
    input.price = maybe(
      rand,
      Math.round((500000 + rand() * 50000000) / 1000) * 1000,
      0.9,
    );
  } else if (rentalMode === 'MONTHLY') {
    input.price = maybe(
      rand,
      Math.round((50000 + rand() * 950000) / 1000) * 1000,
      0.9,
    );
    input.depositMonths = maybe(rand, 1 + Math.floor(rand() * 6));
    input.minLeaseMonths = maybe(rand, 1 + Math.floor(rand() * 12), 0.4);
    input.chargesIncluded = maybe(rand, rand() < 0.5, 0.5);
  } else if (rentalMode === 'NIGHTLY') {
    input.pricePerNight = maybe(
      rand,
      Math.round((5000 + rand() * 95000) / 1000) * 1000,
      0.9,
    );
    input.minimumNights = maybe(rand, 1 + Math.floor(rand() * 5));
    input.maximumNights = maybe(rand, 10 + Math.floor(rand() * 60), 0.4);
    input.cleaningFee = maybe(
      rand,
      Math.round((1000 + rand() * 20000) / 500) * 500,
      0.4,
    );
  } else if (rentalMode === 'MIXED') {
    input.price = maybe(
      rand,
      Math.round((50000 + rand() * 950000) / 1000) * 1000,
      0.8,
    );
    input.pricePerNight = maybe(
      rand,
      Math.round((5000 + rand() * 95000) / 1000) * 1000,
      0.8,
    );
    input.minLeaseMonths = maybe(rand, 1 + Math.floor(rand() * 12), 0.6);
    input.depositMonths = maybe(rand, 1 + Math.floor(rand() * 6), 0.5);
  }

  return input;
}

const SEED = 20261121;
const COMBO_COUNT = 500;

describe('generateDescription — tests de propriété (500 combinaisons, graine fixe)', () => {
  const rand = mulberry32(SEED);
  const combos = Array.from({ length: COMBO_COUNT }, () => buildInput(rand));

  it('toutes les combinaisons passent le contrôle anti-invention', () => {
    const failures: Array<{ input: WriterInput; reasons: string[] }> = [];
    for (const input of combos) {
      const text = generateDescription(input);
      const check = verifyDescription(text, input);
      if (!check.ok) failures.push({ input, reasons: check.reasons });
    }
    if (failures.length > 0) {
      console.error(JSON.stringify(failures.slice(0, 5), null, 2));
    }
    expect(failures).toHaveLength(0);
  });

  it('produit toujours entre 2 et 4 paragraphes', () => {
    for (const input of combos) {
      const text = generateDescription(input);
      const paragraphs = text.split('\n\n');
      expect(paragraphs.length).toBeGreaterThanOrEqual(2);
      expect(paragraphs.length).toBeLessThanOrEqual(4);
    }
  });

  it("n'émet jamais de paragraphe vide", () => {
    for (const input of combos) {
      const text = generateDescription(input);
      for (const p of text.split('\n\n')) {
        expect(p.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('ne produit jamais deux paragraphes strictement identiques dans un même texte', () => {
    for (const input of combos) {
      const text = generateDescription(input);
      const paragraphs = text.split('\n\n');
      expect(new Set(paragraphs).size).toBe(paragraphs.length);
    }
  });

  it('est déterministe (même entrée → même texte, appelé deux fois)', () => {
    for (const input of combos.slice(0, 50)) {
      expect(generateDescription(input)).toBe(generateDescription(input));
    }
  });
});
