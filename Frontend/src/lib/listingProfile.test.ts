import { describe, expect, it } from 'vitest';
import { getListingProfile, sanitizeForType, type ListingTypeKey } from './listingProfile';

const ALL_TYPES: ListingTypeKey[] = [
  'APPARTEMENT', 'VILLA', 'STUDIO', 'CHAMBRE', 'BUREAU', 'TERRAIN', 'MAISON', 'LOCAL_COMMERCIAL',
];

describe('getListingProfile', () => {
  it('définit un profil pour chacun des 8 types de bien', () => {
    for (const type of ALL_TYPES) {
      const profile = getListingProfile(type);
      expect(profile.amenities.length).toBeGreaterThan(0);
    }
  });

  it("un terrain n'a ni pièces, ni chambres, ni salles de bain, et la superficie est obligatoire", () => {
    const p = getListingProfile('TERRAIN');
    expect(p.rooms).toBe(false);
    expect(p.beds).toBe(false);
    expect(p.baths).toBe(false);
    expect(p.surfaceRequired).toBe(true);
    expect(p.amenities).toContain('titre_foncier');
    expect(p.amenities).not.toContain('wifi');
  });

  it('une maison propose pièces, chambres et salles de bain, sans superficie obligatoire', () => {
    const p = getListingProfile('MAISON');
    expect([p.rooms, p.beds, p.baths]).toEqual([true, true, true]);
    expect(p.surfaceRequired).toBe(false);
  });

  it("un bureau n'a pas de lits ; un local commercial n'a ni lits ni pièces", () => {
    expect(getListingProfile('BUREAU').beds).toBe(false);
    expect(getListingProfile('LOCAL_COMMERCIAL')).toMatchObject({ rooms: false, beds: false, baths: true });
  });

  it('retombe sur le profil appartement pour un type inconnu ou absent', () => {
    expect(getListingProfile(undefined)).toEqual(getListingProfile('APPARTEMENT'));
    expect(getListingProfile('INCONNU')).toEqual(getListingProfile('APPARTEMENT'));
  });
});

describe('sanitizeForType', () => {
  it('retire pièces/chambres/sdb et équipements de logement quand on passe de Maison à Terrain', () => {
    const result = sanitizeForType({
      type: 'TERRAIN', rooms: 4, beds: 3, baths: 2, amenities: ['wifi', 'piscine', 'eau', 'cloture'],
    });
    expect(result.rooms).toBeUndefined();
    expect(result.beds).toBeUndefined();
    expect(result.baths).toBeUndefined();
    expect(result.amenities).toEqual(['eau', 'cloture']);
  });

  it('conserve tout pour un type qui supporte ces champs', () => {
    const result = sanitizeForType({
      type: 'VILLA', rooms: 5, beds: 3, baths: 2, amenities: ['wifi', 'piscine'],
    });
    expect(result).toMatchObject({ rooms: 5, beds: 3, baths: 2, amenities: ['wifi', 'piscine'] });
  });

  it('retire les équipements de terrain sur un appartement', () => {
    const result = sanitizeForType({ type: 'APPARTEMENT', amenities: ['clim', 'titre_foncier'] });
    expect(result.amenities).toEqual(['clim']);
  });

  it('ne perd pas les autres champs du formulaire', () => {
    const result = sanitizeForType({ type: 'TERRAIN', title: 'Terrain 300 m²', amenities: [] } as {
      type: string; title: string; amenities: string[];
    });
    expect(result.title).toBe('Terrain 300 m²');
  });
});
