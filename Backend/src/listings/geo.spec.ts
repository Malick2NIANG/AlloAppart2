import { haversineKm, hasReliableCoords, distanceKmOrNull } from './geo';

// Dakar (Plateau) ≈ 14.6928, -17.4467 ; Mermoz ≈ 14.7167, -17.4700 ;
// Saly ≈ 14.4500, -17.0167 (distances approximatives connues, à vol
// d'oiseau) — utilisées pour borner les résultats, pas une égalité exacte.
describe('haversineKm — lot « raccourci » (près de moi)', () => {
  it('distance nulle entre un point et lui-même', () => {
    expect(haversineKm(14.6928, -17.4467, 14.6928, -17.4467)).toBeCloseTo(0, 5);
  });

  it('Dakar Plateau → Mermoz ≈ 4 km (ordre de grandeur réel)', () => {
    const d = haversineKm(14.6928, -17.4467, 14.7167, -17.47);
    expect(d).toBeGreaterThan(2);
    expect(d).toBeLessThan(6);
  });

  it('Dakar → Saly ≈ 50-60 km (ordre de grandeur réel)', () => {
    const d = haversineKm(14.6928, -17.4467, 14.45, -17.0167);
    expect(d).toBeGreaterThan(45);
    expect(d).toBeLessThan(65);
  });

  it('symétrique (A→B = B→A)', () => {
    const ab = haversineKm(14.6928, -17.4467, 14.45, -17.0167);
    const ba = haversineKm(14.45, -17.0167, 14.6928, -17.4467);
    expect(ab).toBeCloseTo(ba, 6);
  });
});

describe('hasReliableCoords — lot « raccourci » (près de moi)', () => {
  it('un point réel au Sénégal est fiable', () => {
    expect(hasReliableCoords(14.6928, -17.4467)).toBe(true);
  });

  it('Null Island (0, 0) n’est jamais fiable', () => {
    expect(hasReliableCoords(0, 0)).toBe(false);
  });

  it('un point hors de la boîte englobante du Sénégal n’est pas fiable', () => {
    expect(hasReliableCoords(48.8566, 2.3522)).toBe(false); // Paris
  });
});

describe('distanceKmOrNull — lot « raccourci » (près de moi)', () => {
  it('renvoie la distance si les coordonnées de l’annonce sont fiables', () => {
    const d = distanceKmOrNull(14.6928, -17.4467, 14.7167, -17.47);
    expect(d).not.toBeNull();
  });

  it('renvoie null si les coordonnées de l’annonce ne sont pas fiables (jamais une erreur)', () => {
    expect(distanceKmOrNull(14.6928, -17.4467, 0, 0)).toBeNull();
  });
});
