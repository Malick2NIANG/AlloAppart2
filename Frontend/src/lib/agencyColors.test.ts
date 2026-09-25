import { describe, expect, it } from 'vitest';
import {
  AGENCY_COLORS,
  getAgencyColorHex,
  getAgencyColorHexLight,
  getAgencyColorOption,
} from './agencyColors';

describe('getAgencyColorHex', () => {
  it('retourne le hex correspondant à une clé connue', () => {
    expect(getAgencyColorHex('blue')).toBe('#2563EB');
  });

  it('retombe sur "gold" pour une clé inconnue', () => {
    expect(getAgencyColorHex('couleur-inexistante')).toBe(
      AGENCY_COLORS[0].hex,
    );
  });

  it('retombe sur "gold" pour null/undefined', () => {
    expect(getAgencyColorHex(null)).toBe(AGENCY_COLORS[0].hex);
    expect(getAgencyColorHex(undefined)).toBe(AGENCY_COLORS[0].hex);
  });
});

describe('getAgencyColorHexLight', () => {
  it('retourne la variante claire correspondant à une clé connue', () => {
    expect(getAgencyColorHexLight('emerald')).toBe('#D1FAE5');
  });

  it('retombe sur "gold" pour une clé inconnue', () => {
    expect(getAgencyColorHexLight('couleur-inexistante')).toBe(
      AGENCY_COLORS[0].hexLight,
    );
  });
});

describe('getAgencyColorOption', () => {
  it('retourne l’option complète pour une clé connue', () => {
    expect(getAgencyColorOption('purple')).toEqual(
      AGENCY_COLORS.find((c) => c.key === 'purple'),
    );
  });

  it('retombe sur l’option "gold" par défaut pour une clé inconnue', () => {
    expect(getAgencyColorOption('couleur-inexistante')).toEqual(
      AGENCY_COLORS[0],
    );
  });
});

describe('AGENCY_COLORS', () => {
  it('n’a pas de clé dupliquée', () => {
    const keys = AGENCY_COLORS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
