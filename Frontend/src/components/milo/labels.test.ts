import { describe, it, expect } from 'vitest';
import { resolveMiloLocale, getMiloLabels, getSiteLocaleName } from './labels';

describe('resolveMiloLocale', () => {
  it('fr détecté → labels fr, quelle que soit la langue du site', () => {
    expect(resolveMiloLocale('fr', 'en')).toBe('fr');
  });
  it('en détecté → labels en, quelle que soit la langue du site', () => {
    expect(resolveMiloLocale('en', 'fr')).toBe('en');
  });
  it("unsupported → repli sur la langue du site (jamais de silence)", () => {
    expect(resolveMiloLocale('unsupported', 'en')).toBe('en');
    expect(resolveMiloLocale('unsupported', 'fr')).toBe('fr');
  });
});

describe('getMiloLabels — libellés indépendants de next-intl', () => {
  it('fr et en ont des textes distincts pour le bandeau "compris"', () => {
    expect(getMiloLabels('fr').understoodPrefix).toBe('Milo a compris :');
    expect(getMiloLabels('en').understoodPrefix).toBe('Milo understood:');
  });

  it('bedsExact/roomsExact accordent le pluriel correctement (fr et en)', () => {
    expect(getMiloLabels('fr').bedsExact(1)).toBe('1 chambre');
    expect(getMiloLabels('fr').bedsExact(2)).toBe('2 chambres');
    expect(getMiloLabels('en').bedsExact(1)).toBe('1 bedroom');
    expect(getMiloLabels('en').bedsExact(2)).toBe('2 bedrooms');
    expect(getMiloLabels('fr').roomsExact(1)).toBe('1 pièce');
    expect(getMiloLabels('fr').roomsExact(3)).toBe('3 pièces');
  });

  it('amenities couvre les mêmes clés canoniques dans les deux langues', () => {
    const frKeys = Object.keys(getMiloLabels('fr').amenities).sort();
    const enKeys = Object.keys(getMiloLabels('en').amenities).sort();
    expect(enKeys).toEqual(frKeys);
  });

  it('unsupportedNotice insère le nom de la langue du site', () => {
    expect(getMiloLabels('fr').unsupportedNotice(getSiteLocaleName('fr'))).toContain('français');
    expect(getMiloLabels('en').unsupportedNotice(getSiteLocaleName('en'))).toContain('English');
  });
});
