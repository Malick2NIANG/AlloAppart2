import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from './search.service';
import {
  ALLOWED_FILTER_FIELDS,
  ALLOWED_SORT_FIELDS,
  SEARCH_SYNONYMS,
} from './search.constants';

interface MeiliSettings {
  filterableAttributes: string[];
  sortableAttributes: string[];
  synonyms: Record<string, string[]>;
}

const updateSettingsMock = jest.fn<Promise<void>, [MeiliSettings]>();
const addDocumentsMock = jest.fn<Promise<void>, [Record<string, unknown>[]]>();
const deleteAllDocumentsMock = jest.fn();
const indexMock = jest.fn(() => ({
  updateSettings: updateSettingsMock,
  addDocuments: addDocumentsMock,
  deleteAllDocuments: deleteAllDocumentsMock,
}));

jest.mock('meilisearch', () => ({
  MeiliSearch: jest.fn().mockImplementation(() => ({
    index: indexMock,
  })),
}));

describe('SearchService — configuration Meilisearch au démarrage (lot 6b)', () => {
  let service: SearchService;

  beforeEach(async () => {
    jest.clearAllMocks();
    updateSettingsMock.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('onModuleInit configure filterableAttributes/sortableAttributes/synonyms sur l’index "listings"', async () => {
    await service.onModuleInit();
    expect(indexMock).toHaveBeenCalledWith('listings');
    expect(updateSettingsMock).toHaveBeenCalledWith({
      filterableAttributes: ALLOWED_FILTER_FIELDS,
      sortableAttributes: ALLOWED_SORT_FIELDS,
      synonyms: SEARCH_SYNONYMS,
    });
  });

  it('les champs filterable/sortable configurés sont exactement ceux que SearchController valide (source unique)', async () => {
    await service.onModuleInit();
    const call = updateSettingsMock.mock.calls[0][0];
    expect(call.filterableAttributes).toEqual(
      expect.arrayContaining([
        'type',
        'city',
        'region',
        'isVerified',
        'boostScore',
        'price',
        'furnished',
        'rentalMode',
        'pricePerNight',
      ]),
    );
    expect(call.sortableAttributes).toEqual(
      expect.arrayContaining([
        'boostScore',
        'createdAt',
        'price',
        'furnished',
        'rentalMode',
        'pricePerNight',
      ]),
    );
  });

  it('les synonymes sont symétriques (appart <-> appartement <-> apartment)', () => {
    expect(SEARCH_SYNONYMS.appart).toContain('appartement');
    expect(SEARCH_SYNONYMS.appartement).toContain('appart');
    expect(SEARCH_SYNONYMS.apartment).toContain('appart');
  });

  it('Meilisearch injoignable au démarrage : onModuleInit ne lève jamais (non bloquant pour le boot)', async () => {
    updateSettingsMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('idempotent : deux appels successifs ne lèvent pas et renvoient le même résultat', async () => {
    await service.onModuleInit();
    await service.onModuleInit();
    expect(updateSettingsMock).toHaveBeenCalledTimes(2);
    expect(updateSettingsMock.mock.calls[0]).toEqual(
      updateSettingsMock.mock.calls[1],
    );
  });

  describe('indexListing — meublé / rentalMode / pricePerNight', () => {
    const baseListing = {
      id: 'l1',
      title: 'Appart Dakar',
      description: 'desc',
      type: 'APPARTEMENT',
      city: 'Dakar',
      region: 'Dakar',
      price: 300000,
      isVerified: false,
      boostScore: 0,
      createdAt: new Date('2026-01-01'),
      lat: null,
      lng: null,
    };

    it('indexe furnished/rentalMode/pricePerNight quand renseignés', async () => {
      await service.indexListing({
        ...baseListing,
        furnished: true,
        rentalMode: 'NIGHTLY',
        pricePerNight: 15000,
      });
      const doc = addDocumentsMock.mock.calls[0][0][0];
      expect(doc.furnished).toBe(true);
      expect(doc.rentalMode).toBe('NIGHTLY');
      expect(doc.pricePerNight).toBe(15000);
    });

    it('furnished null (non précisé) et pricePerNight absent (annonce MONTHLY) → null dans le document, jamais omis ni 0', async () => {
      await service.indexListing({ ...baseListing, rentalMode: 'MONTHLY' });
      const doc = addDocumentsMock.mock.calls[0][0][0];
      expect(doc.furnished).toBeNull();
      expect(doc.pricePerNight).toBeNull();
    });

    it('accepte un pricePerNight de type Decimal Prisma (toNumber())', async () => {
      await service.indexListing({
        ...baseListing,
        pricePerNight: { toNumber: () => 20000 },
      });
      const doc = addDocumentsMock.mock.calls[0][0][0];
      expect(doc.pricePerNight).toBe(20000);
    });
  });

  describe('reindexAll — mêmes champs que indexListing', () => {
    it('inclut furnished/rentalMode/pricePerNight dans chaque document', async () => {
      const findManyMock = jest.fn().mockResolvedValue([
        {
          id: 'l1',
          title: 'Appart',
          description: 'd',
          type: 'APPARTEMENT',
          city: 'Dakar',
          region: 'Dakar',
          price: 300000,
          pricePerNight: 15000,
          furnished: false,
          rentalMode: 'NIGHTLY',
          isVerified: false,
          boostScore: 0,
          createdAt: new Date('2026-01-01'),
          lat: null,
          lng: null,
        },
      ]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SearchService,
          {
            provide: PrismaService,
            useValue: { listing: { findMany: findManyMock } },
          },
          { provide: ConfigService, useValue: { get: jest.fn() } },
        ],
      }).compile();
      const svc = module.get<SearchService>(SearchService);

      await svc.reindexAll();
      const doc = addDocumentsMock.mock.calls[0][0][0];
      expect(doc.furnished).toBe(false);
      expect(doc.rentalMode).toBe('NIGHTLY');
      expect(doc.pricePerNight).toBe(15000);
    });
  });
});
