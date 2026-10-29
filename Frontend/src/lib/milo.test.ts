import { describe, it, expect } from 'vitest';
import { strictFiltersToParams } from './milo';

describe('strictFiltersToParams', () => {
  it('sérialise amenities en CSV, comme les filtres manuels existants', () => {
    const params = strictFiltersToParams({ amenities: ['wifi', 'clim'] });
    expect(params.amenities).toBe('wifi,clim');
  });

  it('nombres convertis en chaînes, champs absents omis', () => {
    const params = strictFiltersToParams({ minBeds: 2, maxBeds: 2, region: 'Dakar' });
    expect(params).toEqual({ minBeds: '2', maxBeds: '2', region: 'Dakar' });
    expect(params.maxPrice).toBeUndefined();
  });

  it('objet vide → aucun paramètre', () => {
    expect(strictFiltersToParams({})).toEqual({});
  });
});
