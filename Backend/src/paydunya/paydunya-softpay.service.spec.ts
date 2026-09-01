import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PaydunyaSoftpayService } from './paydunya-softpay.service';

const MASTER_KEY = 'master-key-de-test-1234';
const VALID_HASH = crypto.createHash('sha512').update(MASTER_KEY).digest('hex');

describe('PaydunyaSoftpayService', () => {
  let service: PaydunyaSoftpayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaydunyaSoftpayService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'PAYDUNYA_MASTER_KEY' ? MASTER_KEY : undefined,
          },
        },
      ],
    }).compile();

    service = module.get<PaydunyaSoftpayService>(PaydunyaSoftpayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Cette méthode est la seule barrière avant de faire confiance à un appel
  // entrant prétendant venir de PayDunya. Chaque cas de rejet ici est une
  // protection réelle contre un paiement forgé ou une requête malformée.
  describe('verifyAndParseCallback', () => {
    it('accepte un payload valide et extrait le token + custom_data', () => {
      const result = service.verifyAndParseCallback({
        data: {
          hash: VALID_HASH,
          invoice: { token: 'test_abc123', total_amount: 5000 },
          custom_data: { booking_id: 'b1' },
          status: 'completed',
        },
      });

      expect(result).toEqual({
        token: 'test_abc123',
        customData: { booking_id: 'b1' },
      });
    });

    it('retourne un custom_data vide si absent du payload (sans planter)', () => {
      const result = service.verifyAndParseCallback({
        data: { hash: VALID_HASH, invoice: { token: 'test_abc123' } },
      });

      expect(result).toEqual({ token: 'test_abc123', customData: {} });
    });

    it('rejette si le noeud "data" racine est absent', () => {
      expect(() => service.verifyAndParseCallback({})).toThrow(
        BadRequestException,
      );
    });

    it('rejette si "data" n\'est pas un objet', () => {
      expect(() =>
        service.verifyAndParseCallback({ data: 'pas-un-objet' }),
      ).toThrow(BadRequestException);
    });

    it('rejette si le hash est absent', () => {
      expect(() =>
        service.verifyAndParseCallback({
          data: { invoice: { token: 'test_abc123' } },
        }),
      ).toThrow(BadRequestException);
    });

    it('rejette si le hash ne correspond pas (signature invalide / forgée)', () => {
      expect(() =>
        service.verifyAndParseCallback({
          data: {
            hash: 'a'.repeat(128), // même longueur qu'un vrai SHA-512 hex, mais faux
            invoice: { token: 'test_abc123' },
          },
        }),
      ).toThrow(BadRequestException);
    });

    it('rejette un hash de longueur différente sans planter (timingSafeEqual)', () => {
      expect(() =>
        service.verifyAndParseCallback({
          data: { hash: 'trop-court', invoice: { token: 'test_abc123' } },
        }),
      ).toThrow(BadRequestException);
    });

    it('rejette si le token de facture est absent malgré un hash valide', () => {
      expect(() =>
        service.verifyAndParseCallback({
          data: { hash: VALID_HASH, invoice: {} },
        }),
      ).toThrow(BadRequestException);
    });

    it('rejette si le noeud "invoice" est absent', () => {
      expect(() =>
        service.verifyAndParseCallback({ data: { hash: VALID_HASH } }),
      ).toThrow(BadRequestException);
    });
  });
});
