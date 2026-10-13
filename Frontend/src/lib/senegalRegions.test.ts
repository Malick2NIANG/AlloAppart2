import { describe, expect, it } from 'vitest';
import {
  REGION_CENTERS,
  checkRegionConsistency,
  findRegionAt,
  getRegionFeature,
  hasRegionData,
} from './senegalRegions';

describe('REGION_CENTERS', () => {
  it('couvre les 14 régions du Sénégal avec des coordonnées plausibles', () => {
    const names = Object.keys(REGION_CENTERS);
    expect(names).toHaveLength(14);
    for (const { lat, lng } of Object.values(REGION_CENTERS)) {
      expect(lat).toBeGreaterThan(12);
      expect(lat).toBeLessThan(17);
      expect(lng).toBeGreaterThan(-18);
      expect(lng).toBeLessThan(-11);
    }
  });
});

describe('sans contours chargés (fichier de données vide)', () => {
  it.skipIf(hasRegionData)('ne détecte ni ne bloque rien', () => {
    expect(findRegionAt(14.15, -16.08)).toBeNull();
    expect(getRegionFeature('Kaolack')).toBeNull();
    expect(checkRegionConsistency('Dakar', 14.15, -16.08)).toEqual({ ok: true });
  });
});

// Contrôle de qualité du fichier de contours réel : chaque chef-lieu doit tomber
// dans sa propre région. Ignoré tant que src/data/senegal-regions.json est vide.
describe.skipIf(!hasRegionData)('avec les contours réels', () => {
  it.each(Object.entries(REGION_CENTERS))('le chef-lieu de %s est dans sa région', (name, c) => {
    expect(findRegionAt(c.lat, c.lng)).toBe(name);
    expect(checkRegionConsistency(name, c.lat, c.lng)).toEqual({ ok: true });
  });

  it('refuse Kaolack pour un point à Dakar, avec la région détectée', () => {
    expect(checkRegionConsistency('Kaolack', 14.6937, -17.4441)).toEqual({
      ok: false,
      reason: 'mismatch',
      detected: 'Dakar',
    });
  });

  it('refuse un point hors du Sénégal (océan)', () => {
    expect(checkRegionConsistency('Dakar', 14.7, -20)).toEqual({ ok: false, reason: 'outside' });
  });
});
