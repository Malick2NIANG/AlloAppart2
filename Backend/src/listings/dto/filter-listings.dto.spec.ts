import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FilterListingsDto } from './filter-listings.dto';

async function errorsFor(payload: Record<string, unknown>) {
  const dto = plainToInstance(FilterListingsDto, payload);
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

// Lot « raccourci » (près de moi) — lat/lng/radiusKm sont des query params
// (chaînes), @Type(() => Number) les convertit comme le reste du DTO.
describe('FilterListingsDto — « près de moi »', () => {
  it('lat/lng/radiusKm valides : aucune erreur', async () => {
    expect(
      await errorsFor({ lat: '14.6928', lng: '-17.4467', radiusKm: '5' }),
    ).toEqual([]);
  });

  it('lat hors [-90, 90] : rejeté', async () => {
    expect(await errorsFor({ lat: '95', lng: '-17.4467' })).toContain('lat');
  });

  it('lng hors [-180, 180] : rejeté', async () => {
    expect(await errorsFor({ lat: '14.6928', lng: '200' })).toContain('lng');
  });

  it('radiusKm < 1 : rejeté (borne basse)', async () => {
    expect(
      await errorsFor({ lat: '14.6928', lng: '-17.4467', radiusKm: '0' }),
    ).toContain('radiusKm');
  });

  it('radiusKm > 50 : rejeté (borne haute)', async () => {
    expect(
      await errorsFor({ lat: '14.6928', lng: '-17.4467', radiusKm: '51' }),
    ).toContain('radiusKm');
  });

  it('radiusKm = 1 et = 50 : acceptés (bornes incluses)', async () => {
    expect(
      await errorsFor({ lat: '14.6928', lng: '-17.4467', radiusKm: '1' }),
    ).toEqual([]);
    expect(
      await errorsFor({ lat: '14.6928', lng: '-17.4467', radiusKm: '50' }),
    ).toEqual([]);
  });

  it('lat/lng/radiusKm absents (recherche classique) : aucune erreur', async () => {
    expect(await errorsFor({ city: 'Dakar' })).toEqual([]);
  });
});
