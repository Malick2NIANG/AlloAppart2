import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaydunyaSoftpayService } from '../paydunya/paydunya-softpay.service';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionStatus } from '@prisma/client';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prismaMock: {
    subscription: { findUnique: jest.Mock; update: jest.Mock };
  };
  let softpayMock: {
    confirmInvoiceStatus: jest.Mock;
    verifyAndParseCallback: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      subscription: { findUnique: jest.fn(), update: jest.fn() },
    };
    softpayMock = {
      confirmInvoiceStatus: jest.fn(),
      verifyAndParseCallback: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: PaydunyaSoftpayService, useValue: softpayMock },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Régression : le webhook abonnement faisait auparavant confiance au
  // statut du payload IPN entrant. Il doit systématiquement revérifier via
  // confirmInvoiceStatus, jamais depuis le payload du webhook.
  describe('handlePaydunyaWebhook', () => {
    it('propage le rejet si verifyAndParseCallback échoue (hash invalide)', async () => {
      softpayMock.verifyAndParseCallback.mockImplementation(() => {
        throw new BadRequestException('Invalid callback signature');
      });

      await expect(service.handlePaydunyaWebhook({})).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.subscription.findUnique).not.toHaveBeenCalled();
    });

    it('ignore silencieusement si aucun subscription_id dans custom_data', async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: {},
      });

      const result = await service.handlePaydunyaWebhook({});

      expect(result).toEqual({ ok: true });
      expect(prismaMock.subscription.findUnique).not.toHaveBeenCalled();
    });

    it('ne fait rien si déjà ACTIVE (idempotence)', async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { subscription_id: 's1' },
      });
      prismaMock.subscription.findUnique.mockResolvedValueOnce({
        id: 's1',
        status: SubscriptionStatus.ACTIVE,
      });

      const result = await service.handlePaydunyaWebhook({});

      expect(result).toEqual({ ok: true });
      expect(softpayMock.confirmInvoiceStatus).not.toHaveBeenCalled();
    });

    it('ne fait JAMAIS confiance au statut du payload — active seulement après confirmInvoiceStatus', async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { subscription_id: 's1' },
      });
      prismaMock.subscription.findUnique.mockResolvedValueOnce({
        id: 's1',
        status: SubscriptionStatus.SUSPENDED,
      });
      softpayMock.confirmInvoiceStatus.mockResolvedValueOnce({
        status: 'completed',
        totalAmount: 75000,
        customData: {},
      });

      await service.handlePaydunyaWebhook({
        data: { status: 'completed' /* ignoré */ },
      });

      expect(softpayMock.confirmInvoiceStatus).toHaveBeenCalledWith('tok1');
      const [[updateArgs]] = prismaMock.subscription.update.mock.calls as [
        [
          {
            where: { id: string };
            data: { status: SubscriptionStatus; paymentRef: string };
          },
        ],
      ];
      expect(updateArgs.where).toEqual({ id: 's1' });
      expect(updateArgs.data.status).toBe(SubscriptionStatus.ACTIVE);
      expect(updateArgs.data.paymentRef).toBe('PD-tok1');
    });

    it("ne met pas à jour si le statut confirmé n'est pas 'completed'", async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { subscription_id: 's1' },
      });
      prismaMock.subscription.findUnique.mockResolvedValueOnce({
        id: 's1',
        status: SubscriptionStatus.SUSPENDED,
      });
      softpayMock.confirmInvoiceStatus.mockResolvedValueOnce({
        status: 'pending',
        totalAmount: 0,
        customData: {},
      });

      const result = await service.handlePaydunyaWebhook({});

      expect(result).toEqual({ ok: true });
      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    });
  });
});
