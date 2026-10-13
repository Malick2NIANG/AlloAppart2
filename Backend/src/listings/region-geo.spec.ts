import {
  checkRegionConsistency,
  findRegionAt,
  loadRegionFeatures,
  type RegionFeature,
} from './region-geo';

// Chefs-lieux : contrôle de qualité du fichier de contours réel
// (src/listings/data/senegal-regions.json). Ignoré tant que le fichier est vide.
const CAPITALS: Record<string, [number, number]> = {
  Dakar: [14.6937, -17.4441],
  Thiès: [14.7886, -16.926],
  'Saint-Louis': [16.0179, -16.4896],
  Ziguinchor: [12.5833, -16.2719],
  Kaolack: [14.15, -16.0833],
  Fatick: [14.339, -16.4111],
  Kolda: [12.8833, -14.95],
  Tambacounda: [13.7667, -13.6667],
  Matam: [15.6559, -13.2554],
  Kaffrine: [14.1052, -15.5508],
  Sédhiou: [12.7081, -15.5569],
  Kédougou: [12.5579, -12.1743],
  Louga: [15.6167, -16.2167],
  Diourbel: [14.65, -16.2333],
};
const REAL_FEATURES = loadRegionFeatures();

const describeIfData = REAL_FEATURES.length > 0 ? describe : describe.skip;

describeIfData('contours réels (data/senegal-regions.json)', () => {
  it('contient les 14 régions', () => {
    expect(REAL_FEATURES).toHaveLength(14);
  });

  it.each(Object.entries(CAPITALS))(
    'le chef-lieu de %s est dans sa région',
    (name, [lat, lng]) => {
      expect(findRegionAt(lat, lng)).toBe(name);
      expect(checkRegionConsistency(name, lat, lng)).toEqual({ ok: true });
    },
  );

  it("refuse Kaolack pour un point à Dakar et un point dans l'océan", () => {
    expect(checkRegionConsistency('Kaolack', 14.6937, -17.4441)).toEqual({
      ok: false,
      reason: 'mismatch',
      detected: 'Dakar',
    });
    expect(checkRegionConsistency('Dakar', 14.7, -20)).toEqual({
      ok: false,
      reason: 'outside',
    });
  });
});

// Deux carrés fictifs adjacents (coordonnées [lng, lat]) :
// « Dakar » = lng -18..-17, lat 14..15 ; « Thiès » = lng -17..-16, lat 14..15.
const square = (name: string, lng0: number, lng1: number): RegionFeature => ({
  type: 'Feature',
  properties: { name },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [lng0, 14],
        [lng1, 14],
        [lng1, 15],
        [lng0, 15],
        [lng0, 14],
      ],
    ],
  },
});

const FEATURES: RegionFeature[] = [
  square('Dakar Region', -18, -17),
  square('Thies', -17, -16),
];

describe('findRegionAt', () => {
  it('trouve la région contenant le point, noms normalisés (accents, « Region »)', () => {
    expect(findRegionAt(14.5, -17.5, FEATURES)).toBe('Dakar');
    expect(findRegionAt(14.5, -16.5, FEATURES)).toBe('Thiès');
  });

  it('renvoie null hors de toute région ou sans contours', () => {
    expect(findRegionAt(10, -17.5, FEATURES)).toBeNull();
    expect(findRegionAt(14.5, -17.5, [])).toBeNull();
  });

  it('gère les trous des polygones', () => {
    const withHole: RegionFeature = {
      type: 'Feature',
      properties: { name: 'Dakar' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-18, 14],
            [-17, 14],
            [-17, 15],
            [-18, 15],
            [-18, 14],
          ],
          [
            [-17.6, 14.4],
            [-17.4, 14.4],
            [-17.4, 14.6],
            [-17.6, 14.6],
            [-17.6, 14.4],
          ],
        ],
      },
    };
    expect(findRegionAt(14.5, -17.5, [withHole])).toBeNull();
    expect(findRegionAt(14.1, -17.9, [withHole])).toBe('Dakar');
  });
});

describe('checkRegionConsistency', () => {
  it('accepte un point dans la région déclarée', () => {
    expect(checkRegionConsistency('Dakar', 14.5, -17.5, FEATURES)).toEqual({
      ok: true,
    });
  });

  it('rejette un point franchement dans une autre région (mismatch)', () => {
    expect(checkRegionConsistency('Dakar', 14.5, -16.2, FEATURES)).toEqual({
      ok: false,
      reason: 'mismatch',
      detected: 'Thiès',
    });
  });

  it('rejette un point hors de toute région (outside)', () => {
    expect(checkRegionConsistency('Dakar', 10, -17.5, FEATURES)).toEqual({
      ok: false,
      reason: 'outside',
    });
  });

  it("accepte un point juste de l'autre côté de la frontière (tolérance de 3 km)", () => {
    // ~1,1 km à l'est de la limite Dakar/Thiès (0,01° de longitude à 14,5° ≈ 1,07 km)
    expect(checkRegionConsistency('Dakar', 14.5, -16.99, FEATURES)).toEqual({
      ok: true,
    });
  });

  it('rejette un point au-delà de la tolérance', () => {
    // 0,1° ≈ 10,8 km au-delà de la frontière
    expect(checkRegionConsistency('Dakar', 14.5, -16.9, FEATURES).ok).toBe(
      false,
    );
  });

  it('ne bloque rien sans contours, sans région ou sans position', () => {
    expect(checkRegionConsistency('Dakar', 14.5, -16.2, [])).toEqual({
      ok: true,
    });
    expect(checkRegionConsistency(undefined, 14.5, -16.2, FEATURES)).toEqual({
      ok: true,
    });
    expect(
      checkRegionConsistency('Dakar', undefined, undefined, FEATURES),
    ).toEqual({ ok: true });
  });

  it('ne bloque pas pour une région inconnue des contours', () => {
    expect(checkRegionConsistency('Kolda', 14.5, -17.5, FEATURES)).toEqual({
      ok: true,
    });
  });
});
