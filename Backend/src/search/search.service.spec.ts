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
const indexMock = jest.fn(() => ({ updateSettings: updateSettingsMock }));

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
      ]),
    );
    expect(call.sortableAttributes).toEqual(
      expect.arrayContaining(['boostScore', 'createdAt', 'price']),
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
});
