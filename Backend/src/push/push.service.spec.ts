import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushService } from './push.service';
import { PrismaService } from '../prisma/prisma.service';

// Jamais de vrai envoi : web-push est entièrement mocké.
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

const VAPID_ENV: Record<string, string> = {
  VAPID_PUBLIC_KEY: 'pub-key',
  VAPID_PRIVATE_KEY: 'priv-key',
  VAPID_SUBJECT: 'mailto:test@example.com',
};

describe('PushService', () => {
  let prismaMock: {
    notificationPreference: { findUnique: jest.Mock; upsert: jest.Mock };
    pushSubscription: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  async function buildService(env: Record<string, string | undefined>) {
    prismaMock = {
      notificationPreference: { findUnique: jest.fn(), upsert: jest.fn() },
      pushSubscription: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] },
        },
      ],
    }).compile();

    const service = module.get(PushService);
    await service.onModuleInit();
    return service;
  }

  beforeEach(() => jest.clearAllMocks());

  describe('clés VAPID absentes', () => {
    it('désactive proprement le service (aucune erreur), getPublicKey() = null', async () => {
      const service = await buildService({});
      expect(service.isEnabled()).toBe(false);
      expect(service.getPublicKey()).toBeNull();
      expect(webpush.setVapidDetails).not.toHaveBeenCalled();
    });

    it("sendToUser ne fait rien (aucun appel Prisma/web-push) quand désactivé — l'app marche comme avant", async () => {
      const service = await buildService({});
      await service.sendToUser('user1', 'messages', {
        title: 'T',
        body: 'B',
        url: '/notifications',
        tag: 'x',
      });
      expect(prismaMock.pushSubscription.findMany).not.toHaveBeenCalled();
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('clés VAPID présentes', () => {
    it('active le service et configure web-push', async () => {
      const service = await buildService(VAPID_ENV);
      expect(service.isEnabled()).toBe(true);
      expect(service.getPublicKey()).toBe('pub-key');
      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:test@example.com',
        'pub-key',
        'priv-key',
      );
    });
  });

  describe('sendToUser — catégories et isolation', () => {
    it('catégorie coupée (préférence false) : aucun envoi', async () => {
      const service = await buildService(VAPID_ENV);
      prismaMock.notificationPreference.findUnique.mockResolvedValue({
        messages: false,
      });

      await service.sendToUser('user1', 'messages', {
        title: 'T',
        body: 'B',
        url: '/messages',
        tag: 'x',
      });

      expect(prismaMock.pushSubscription.findMany).not.toHaveBeenCalled();
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it('aucune préférence enregistrée (défaut tout activé) : envoi normal', async () => {
      const service = await buildService(VAPID_ENV);
      prismaMock.notificationPreference.findUnique.mockResolvedValue(null);
      prismaMock.pushSubscription.findMany.mockResolvedValue([
        {
          id: 's1',
          endpoint: 'https://push.example/1',
          p256dh: 'k1',
          auth: 'a1',
        },
      ]);
      (webpush.sendNotification as jest.Mock).mockResolvedValue(undefined);

      await service.sendToUser('user1', 'bookings', {
        title: 'T',
        body: 'B',
        url: '/bookings/abc',
        tag: 'booking-abc',
      });

      expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    });

    it("isolation entre utilisateurs : ne consulte/n'envoie que les abonnements de CET utilisateur", async () => {
      const service = await buildService(VAPID_ENV);
      prismaMock.notificationPreference.findUnique.mockResolvedValue(null);
      prismaMock.pushSubscription.findMany.mockResolvedValue([]);

      await service.sendToUser('user-A', 'payments', {
        title: 'T',
        body: 'B',
        url: '/bookings/x',
        tag: 'booking-x',
      });

      expect(prismaMock.notificationPreference.findUnique).toHaveBeenCalledWith(
        {
          where: { userId: 'user-A' },
        },
      );
      expect(prismaMock.pushSubscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-A' } }),
      );
    });

    it("charge utile neutre : le JSON envoyé ne contient que title/body/url/tag, jamais d'autre champ (email, téléphone, montant)", async () => {
      const service = await buildService(VAPID_ENV);
      prismaMock.notificationPreference.findUnique.mockResolvedValue(null);
      prismaMock.pushSubscription.findMany.mockResolvedValue([
        {
          id: 's1',
          endpoint: 'https://push.example/1',
          p256dh: 'k1',
          auth: 'a1',
        },
      ]);
      (webpush.sendNotification as jest.Mock).mockResolvedValue(undefined);

      await service.sendToUser('user1', 'messages', {
        title: 'Nouveau message',
        body: 'Fatou vous a envoyé un message.',
        url: '/messages?room=room1',
        tag: 'message-room1',
      });

      const [, rawPayload] = (webpush.sendNotification as jest.Mock).mock
        .calls[0] as [unknown, string];
      const payload = JSON.parse(rawPayload) as Record<string, unknown>;
      expect(Object.keys(payload).sort()).toEqual([
        'body',
        'tag',
        'title',
        'url',
      ]);
      expect(JSON.stringify(payload)).not.toMatch(/@|\+221|FCFA|\d{4,}/);
    });
  });

  describe('abonnement expiré', () => {
    it("404 : l'abonnement est supprimé", async () => {
      const service = await buildService(VAPID_ENV);
      prismaMock.notificationPreference.findUnique.mockResolvedValue(null);
      prismaMock.pushSubscription.findMany.mockResolvedValue([
        {
          id: 's1',
          endpoint: 'https://push.example/1',
          p256dh: 'k1',
          auth: 'a1',
        },
      ]);
      (webpush.sendNotification as jest.Mock).mockRejectedValue({
        statusCode: 404,
      });

      await service.sendToUser('user1', 'bookings', {
        title: 'T',
        body: 'B',
        url: '/bookings/x',
        tag: 'x',
      });

      expect(prismaMock.pushSubscription.delete).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
    });

    it("410 : l'abonnement est supprimé", async () => {
      const service = await buildService(VAPID_ENV);
      prismaMock.notificationPreference.findUnique.mockResolvedValue(null);
      prismaMock.pushSubscription.findMany.mockResolvedValue([
        {
          id: 's1',
          endpoint: 'https://push.example/1',
          p256dh: 'k1',
          auth: 'a1',
        },
      ]);
      (webpush.sendNotification as jest.Mock).mockRejectedValue({
        statusCode: 410,
      });

      await service.sendToUser('user1', 'bookings', {
        title: 'T',
        body: 'B',
        url: '/bookings/x',
        tag: 'x',
      });

      expect(prismaMock.pushSubscription.delete).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
    });
  });

  describe("échec d'envoi — jamais d'impact sur l'appelant", () => {
    it('un échec (ex. 500) ne rejette jamais la promesse de sendToUser, aucune suppression', async () => {
      const service = await buildService(VAPID_ENV);
      prismaMock.notificationPreference.findUnique.mockResolvedValue(null);
      prismaMock.pushSubscription.findMany.mockResolvedValue([
        {
          id: 's1',
          endpoint: 'https://push.example/1',
          p256dh: 'k1',
          auth: 'a1',
        },
      ]);
      (webpush.sendNotification as jest.Mock).mockRejectedValue({
        statusCode: 500,
      });

      await expect(
        service.sendToUser('user1', 'bookings', {
          title: 'T',
          body: 'B',
          url: '/bookings/x',
          tag: 'x',
        }),
      ).resolves.toBeUndefined();
      expect(prismaMock.pushSubscription.delete).not.toHaveBeenCalled();
    });

    it('une erreur Prisma pendant la résolution des abonnements ne rejette jamais sendToUser', async () => {
      const service = await buildService(VAPID_ENV);
      prismaMock.notificationPreference.findUnique.mockRejectedValue(
        new Error('DB down'),
      );

      await expect(
        service.sendToUser('user1', 'bookings', {
          title: 'T',
          body: 'B',
          url: '/bookings/x',
          tag: 'x',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("abonnements — un utilisateur ne peut pas écraser celui d'un autre", () => {
    it("refuse (ConflictException) si l'endpoint appartient déjà à un autre utilisateur", async () => {
      const service = await buildService(VAPID_ENV);
      prismaMock.pushSubscription.findUnique.mockResolvedValue({
        userId: 'other-user',
      });

      await expect(
        service.subscribe('user1', {
          endpoint: 'https://push.example/1',
          keys: { p256dh: 'k', auth: 'a' },
        }),
      ).rejects.toThrow('Cet appareil est déjà abonné avec un autre compte.');
      expect(prismaMock.pushSubscription.upsert).not.toHaveBeenCalled();
    });

    it("même utilisateur, même endpoint : mise à jour acceptée (pas d'écrasement, ré-abonnement normal)", async () => {
      const service = await buildService(VAPID_ENV);
      prismaMock.pushSubscription.findUnique.mockResolvedValue({
        userId: 'user1',
      });
      prismaMock.pushSubscription.upsert.mockResolvedValue({ id: 's1' });

      await service.subscribe('user1', {
        endpoint: 'https://push.example/1',
        keys: { p256dh: 'k', auth: 'a' },
      });

      expect(prismaMock.pushSubscription.upsert).toHaveBeenCalled();
    });
  });
});
