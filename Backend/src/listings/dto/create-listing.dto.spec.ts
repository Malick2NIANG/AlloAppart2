import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';

const base = {
  title: 'Terrain 300 m²',
  description: 'Terrain viabilisé',
  type: 'TERRAIN',
  lat: 14.6937,
  lng: -17.4441,
  city: 'Dakar',
  region: 'Dakar',
  price: 5000000,
};

async function errorsFor(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateListingDto, payload);
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

describe('CreateListingDto — vente directe', () => {
  it('ignore les champs de location résiduels (rentalMode MONTHLY sans caution)', async () => {
    const props = await errorsFor({
      ...base,
      transactionType: 'VENTE',
      rentalMode: 'MONTHLY',
    });
    expect(props).toEqual([]);
  });

  it('ignore NIGHTLY / MIXED résiduels en vente', async () => {
    expect(
      await errorsFor({
        ...base,
        transactionType: 'VENTE',
        rentalMode: 'NIGHTLY',
      }),
    ).toEqual([]);
    expect(
      await errorsFor({
        ...base,
        transactionType: 'VENTE',
        rentalMode: 'MIXED',
      }),
    ).toEqual([]);
  });

  it('exige toujours le prix de vente', async () => {
    const { price: _price, ...withoutPrice } = base;
    void _price;
    expect(
      await errorsFor({ ...withoutPrice, transactionType: 'VENTE' }),
    ).toContain('price');
  });
});

describe('CreateListingDto — location', () => {
  it('exige la caution en mode MONTHLY', async () => {
    expect(
      await errorsFor({
        ...base,
        type: 'APPARTEMENT',
        transactionType: 'LOCATION',
        rentalMode: 'MONTHLY',
      }),
    ).toContain('depositMonths');
  });

  it('accepte une location mensuelle complète', async () => {
    expect(
      await errorsFor({
        ...base,
        type: 'APPARTEMENT',
        transactionType: 'LOCATION',
        rentalMode: 'MONTHLY',
        depositMonths: 2,
        furnished: true,
      }),
    ).toEqual([]);
  });
});

describe('CreateListingDto — meublé (furnished)', () => {
  const residentialTypes = [
    'APPARTEMENT',
    'VILLA',
    'STUDIO',
    'CHAMBRE',
    'MAISON',
  ];

  it.each(residentialTypes)(
    'obligatoire à la création pour %s en LOCATION',
    async (type) => {
      const props = await errorsFor({
        ...base,
        type,
        transactionType: 'LOCATION',
        rentalMode: 'MONTHLY',
        depositMonths: 1,
      });
      expect(props).toContain('furnished');
    },
  );

  it.each(residentialTypes)('accepté une fois renseigné (%s)', async (type) => {
    const props = await errorsFor({
      ...base,
      type,
      transactionType: 'LOCATION',
      rentalMode: 'MONTHLY',
      depositMonths: 1,
      furnished: false,
    });
    expect(props).not.toContain('furnished');
  });

  it('facultatif pour BUREAU en LOCATION', async () => {
    expect(
      await errorsFor({
        ...base,
        type: 'BUREAU',
        transactionType: 'LOCATION',
        rentalMode: 'MONTHLY',
        depositMonths: 1,
      }),
    ).not.toContain('furnished');
  });

  it('facultatif pour LOCAL_COMMERCIAL en LOCATION', async () => {
    expect(
      await errorsFor({
        ...base,
        type: 'LOCAL_COMMERCIAL',
        transactionType: 'LOCATION',
        rentalMode: 'MONTHLY',
        depositMonths: 1,
      }),
    ).not.toContain('furnished');
  });

  it('ignoré pour TERRAIN (jamais requis, même en LOCATION)', async () => {
    expect(
      await errorsFor({
        ...base,
        type: 'TERRAIN',
        transactionType: 'LOCATION',
        rentalMode: 'MONTHLY',
        depositMonths: 1,
      }),
    ).not.toContain('furnished');
  });

  it('ignoré en VENTE, même pour un type résidentiel', async () => {
    expect(
      await errorsFor({
        ...base,
        type: 'APPARTEMENT',
        transactionType: 'VENTE',
      }),
    ).not.toContain('furnished');
  });
});
