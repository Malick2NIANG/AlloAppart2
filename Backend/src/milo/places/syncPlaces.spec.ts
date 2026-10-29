import { parseRegionsSource, serializePlacesData } from './syncPlaces';

const SAMPLE_SOURCE = `
export interface RegionData {
  slug: string;
  name: string;
  description: string;
  cities: string[];
  coverImage: string;
  highlights: string[];
}

export const REGIONS: RegionData[] = [
  {
    slug: 'Dakar',
    name: 'Dakar',
    description: 'Capitale, avec une apostrophe échappée : l\\'essentiel.',
    cities: ['Dakar', 'Pikine'],
    coverImage: 'https://example.com/a.jpg',
    highlights: ['Plateau', 'Almadies'],
  },
  {
    slug: 'Thiès',
    name: 'Thiès',
    description: 'Deuxième ville.',
    cities: ['Thiès', 'Mbour'],
    coverImage: 'https://example.com/b.jpg',
    highlights: [],
  },
];

export function getRegion(slug: string) {
  return REGIONS.find((r) => r.slug === slug);
}
`;

describe('parseRegionsSource', () => {
  it('extrait le nom, les villes et les quartiers de chaque région', () => {
    const result = parseRegionsSource(SAMPLE_SOURCE);
    expect(result).toEqual([
      {
        region: 'Dakar',
        cities: ['Dakar', 'Pikine'],
        neighborhoods: ['Plateau', 'Almadies'],
      },
      { region: 'Thiès', cities: ['Thiès', 'Mbour'], neighborhoods: [] },
    ]);
  });

  it("gère une apostrophe échappée dans un champ texte sans casser l'extraction", () => {
    const result = parseRegionsSource(SAMPLE_SOURCE);
    expect(result[0].region).toBe('Dakar');
  });

  it('lève une erreur si le tableau REGIONS est introuvable (format inattendu)', () => {
    expect(() =>
      parseRegionsSource('export const AUTRE_CHOSE = [];'),
    ).toThrow();
  });

  it('retourne un tableau vide si REGIONS est vide', () => {
    const empty = `export const REGIONS: RegionData[] = [\n];`;
    expect(parseRegionsSource(empty)).toEqual([]);
  });
});

describe('serializePlacesData', () => {
  it("produit un module TS que parseRegionsSource peut relire à l'identique (aller-retour)", () => {
    const places = parseRegionsSource(SAMPLE_SOURCE);
    const serialized = serializePlacesData(places);
    expect(serialized).toContain('GÉNÉRÉ — ne pas éditer à la main');
    expect(serialized).toContain("region: 'Dakar'");
    expect(serialized).toContain("cities: ['Dakar', 'Pikine']");
    expect(serialized).toContain("neighborhoods: ['Plateau', 'Almadies']");
  });

  it('échappe les apostrophes dans les valeurs sérialisées', () => {
    const serialized = serializePlacesData([
      { region: 'Joal', cities: ["L'île"], neighborhoods: [] },
    ]);
    expect(serialized).toContain("cities: ['L\\'île']");
  });
});
