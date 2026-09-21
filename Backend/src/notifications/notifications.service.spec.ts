import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { OnesignalService } from '../onesignal/onesignal.service';
import { PusherService } from '../pusher/pusher.service';

// Ce fichier couvre broadcastPush() — le chemin exact emprunté par la page
// admin espace/communications (POST /notifications/broadcast) : ciblage des
// destinataires par segment de rôle, transmission à OneSignal avec le
// préfixe "👑 De la part d'AlloAppart", et création d'une notification
// cloche (type ADMIN_BROADCAST) par destinataire. Les autres méthodes
// (emails/push transactionnels par événement) ne sont pas couvertes ici.
describe('NotificationsService.broadcastPush', () => {
  let service: NotificationsService;
  let prismaMock: {
    user: { findMany: jest.Mock };
    notification: { createMany: jest.Mock };
  };
  let onesignalMock: { sendBroadcast: jest.Mock };
  let pusherMock: { trigger: jest.Mock };

  beforeEach(async () => {
    prismaMock = {
      user: { findMany: jest.fn() },
      notification: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    onesignalMock = { sendBroadcast: jest.fn().mockResolvedValue(undefined) };
    pusherMock = { trigger: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: OnesignalService, useValue: onesignalMock },
        { provide: PusherService, useValue: pusherMock },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  it('segment ALL : cible tous les utilisateurs et diffuse sans filtre externalIds', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', clerkId: 'clerk_1' },
      { id: 'u2', clerkId: 'clerk_2' },
    ]);

    const result = await service.broadcastPush('Titre', 'Message', 'ALL');

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      select: { id: true, clerkId: true },
    });
    expect(onesignalMock.sendBroadcast).toHaveBeenCalledWith(
      "👑 De la part d'AlloAppart — Titre",
      'Message',
      undefined,
    );
    // Une notification cloche par destinataire, type ADMIN_BROADCAST — le
    // titre/corps stockés restent bruts (pas de préfixe), seul le type
    // dédié pilote le style doré côté NotificationBell.
    expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: 'u1', type: 'ADMIN_BROADCAST', title: 'Titre', body: 'Message' }),
        expect.objectContaining({ userId: 'u2', type: 'ADMIN_BROADCAST', title: 'Titre', body: 'Message' }),
      ],
    });
    expect(pusherMock.trigger).toHaveBeenCalledTimes(2);
    expect(pusherMock.trigger).toHaveBeenCalledWith(
      'user-u1',
      'notification',
      expect.objectContaining({ userId: 'u1', type: 'ADMIN_BROADCAST' }),
    );
    expect(result).toEqual({ sent: true, recipients: 2 });
  });

  it('segment BAILLEURS : filtre par rôle et transmet les clerkId correspondants', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', clerkId: 'clerk_1' },
      { id: 'u2', clerkId: 'clerk_2' },
    ]);

    const result = await service.broadcastPush(
      'Titre',
      'Message',
      'BAILLEURS',
    );

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { roles: { has: Role.BAILLEUR } },
      select: { id: true, clerkId: true },
    });
    expect(onesignalMock.sendBroadcast).toHaveBeenCalledWith(
      "👑 De la part d'AlloAppart — Titre",
      'Message',
      ['clerk_1', 'clerk_2'],
    );
    expect(result).toEqual({ sent: true, recipients: 2 });
  });

  it('segment LOCATAIRES : mappe correctement vers Role.LOCATAIRE', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u3', clerkId: 'clerk_3' }]);

    await service.broadcastPush('T', 'M', 'LOCATAIRES');

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { roles: { has: Role.LOCATAIRE } },
      select: { id: true, clerkId: true },
    });
  });

  it('segment PRO_AGENCES : mappe correctement vers Role.PRO_AGENCE', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    const result = await service.broadcastPush('T', 'M', 'PRO_AGENCES');

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { roles: { has: Role.PRO_AGENCE } },
      select: { id: true, clerkId: true },
    });
    // Segment ciblé sans aucun destinataire : recipients=0, sendBroadcast
    // reste appelé (tableau vide — onesignal.service l'ignore en interne),
    // mais aucune notification cloche n'est créée.
    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: true, recipients: 0 });
  });

  it('segment AGENTS_TERRAIN : mappe correctement vers Role.AGENT_TERRAIN', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u4', clerkId: 'clerk_4' }]);

    const result = await service.broadcastPush('T', 'M', 'AGENTS_TERRAIN');

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { roles: { has: Role.AGENT_TERRAIN } },
      select: { id: true, clerkId: true },
    });
    expect(result).toEqual({ sent: true, recipients: 1 });
  });
});
