import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let controller: SearchController;
  let searchServiceMock: { fullTextSearch: jest.Mock; geoSearch: jest.Mock };

  beforeEach(async () => {
    searchServiceMock = {
      fullTextSearch: jest.fn().mockResolvedValue({ hits: [] }),
      geoSearch: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: searchServiceMock }],
    }).compile();

    controller = module.get<SearchController>(SearchController);
  });

  // --- Validation filtre ---
  describe('search — validateMeilisearchFilter', () => {
    it('accepte un filtre avec champs autorisés', async () => {
      // Les valeurs enum doivent être entre guillemets pour ne pas être confondues
      // avec des noms de champs par le validateur token-based
      await expect(
        controller.search(
          'appart',
          "type = 'APPARTEMENT' AND price < 200000",
          undefined,
        ),
      ).resolves.toBeDefined();
    });

    it('accepte un filtre avec isVerified et boostScore', async () => {
      await expect(
        controller.search(
          '',
          'isVerified = true AND boostScore > 0',
          undefined,
        ),
      ).resolves.toBeDefined();
    });

    it('accepte les mots-clés syntaxiques (AND, OR, NOT)', async () => {
      await expect(
        controller.search('', "city = 'Dakar' OR city = 'Thiès'", undefined),
      ).resolves.toBeDefined();
    });

    // Les méthodes search/geoSearch lèvent leurs exceptions de façon synchrone
    // (avant le return de la Promise) → utiliser .toThrow() et non .rejects.toThrow()
    it('rejette un champ non autorisé (injection)', () => {
      expect(() =>
        controller.search('', 'clerkId = abc123', undefined),
      ).toThrow(BadRequestException);
    });

    it("rejette une tentative d'accès à totalAmount", () => {
      expect(() => controller.search('', 'totalAmount > 0', undefined)).toThrow(
        BadRequestException,
      );
    });

    it('accepte filtre undefined (pas de filtre)', async () => {
      await expect(
        controller.search('appart', undefined, undefined),
      ).resolves.toBeDefined();
    });
  });

  // --- Validation sort ---
  describe('search — validateMeilisearchSort', () => {
    it('accepte un tri valide', async () => {
      await expect(
        controller.search('', undefined, 'price:asc'),
      ).resolves.toBeDefined();
    });

    it('accepte plusieurs tris valides', async () => {
      await expect(
        controller.search('', undefined, 'boostScore:desc,createdAt:desc'),
      ).resolves.toBeDefined();
    });

    it('rejette un champ de tri non autorisé', () => {
      expect(() => controller.search('', undefined, 'clerkId:asc')).toThrow(
        BadRequestException,
      );
    });
  });

  // --- Validation geoSearch ---
  describe('geoSearch — validation lat/lng', () => {
    it('accepte des coordonnées valides (Dakar)', async () => {
      await expect(
        controller.geoSearch('14.7167', '-17.4677', '5000'),
      ).resolves.toBeDefined();
    });

    it('rejette une latitude NaN', () => {
      expect(() => controller.geoSearch('abc', '-17.4677')).toThrow(
        BadRequestException,
      );
    });

    it('rejette une latitude hors intervalle (> 90)', () => {
      expect(() => controller.geoSearch('91', '-17.4677')).toThrow(
        BadRequestException,
      );
    });

    it('rejette une longitude hors intervalle (> 180)', () => {
      expect(() => controller.geoSearch('14.7', '181')).toThrow(
        BadRequestException,
      );
    });

    it('rejette une latitude hors intervalle (< -90)', () => {
      expect(() => controller.geoSearch('-91', '0')).toThrow(
        BadRequestException,
      );
    });

    it('plafonne le rayon à 50 km', async () => {
      await controller.geoSearch('14.7167', '-17.4677', '999999');
      expect(searchServiceMock.geoSearch).toHaveBeenCalledWith(
        expect.objectContaining({ radius: 50000 }),
      );
    });

    it('applique le rayon par défaut (5000 m) si absent', async () => {
      await controller.geoSearch('14.7167', '-17.4677', undefined);
      expect(searchServiceMock.geoSearch).toHaveBeenCalledWith(
        expect.objectContaining({ radius: 5000 }),
      );
    });
  });
});
