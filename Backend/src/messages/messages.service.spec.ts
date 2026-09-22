import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { PusherService } from '../pusher/pusher.service';
import { NotificationsService } from '../notifications/notifications.service';

// Task #121 — anti-contournement : un message filtré (numéro/email/app
// externe masqué) doit être journalisé, et les admins alertés une fois qu'un
// même expéditeur cumule CIRCUMVENTION_ALERT_THRESHOLD tentatives filtrées
// sur 24h glissantes (comptées directement dans les messages stockés).
describe('MessagesService — filtre anti-contournement', () => {
  let service: MessagesService;
  let prismaMock: {
    message: {
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
    };
    messageRoom: { findUnique: jest.Mock };
  };
  let notificationsMock: {
    notifyContactFilterAlert: jest.Mock;
    notifyNewMessage: jest.Mock;
  };

  const sender = {
    id: 'u1',
    firstName: 'Awa',
    lastName: 'Ndiaye',
    agencyName: null,
    roles: ['LOCATAIRE'],
  };

  beforeEach(async () => {
    prismaMock = {
      message: {
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      messageRoom: { findUnique: jest.fn() },
    };
    notificationsMock = {
      notifyContactFilterAlert: jest.fn(),
      notifyNewMessage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PusherService, useValue: { trigger: jest.fn() } },
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);

    prismaMock.messageRoom.findUnique.mockResolvedValue({
      id: 'room1',
      participants: [{ id: 'u1' }, { id: 'u2' }],
    });
  });

  it("n'alerte pas les admins tant que le seuil n'est pas atteint", async () => {
    prismaMock.message.create.mockResolvedValueOnce({
      id: 'm1',
      roomId: 'room1',
      senderId: 'u1',
      content: '[numéro masqué]',
      readAt: null,
      createdAt: new Date(),
      sender,
    });
    prismaMock.message.count.mockResolvedValueOnce(2); // en dessous du seuil (3)

    await service.sendMessage('room1', 'u1', 'Appelle-moi au 77 123 45 67');

    // Laisse le fire-and-forget interne se résoudre avant d'asserter.
    await new Promise((r) => setTimeout(r, 0));

    expect(prismaMock.message.count).toHaveBeenCalledTimes(1);
    expect(notificationsMock.notifyContactFilterAlert).not.toHaveBeenCalled();
  });

  it('alerte les admins dès que le seuil est atteint', async () => {
    prismaMock.message.create.mockResolvedValueOnce({
      id: 'm2',
      roomId: 'room1',
      senderId: 'u1',
      content: '[email masqué]',
      readAt: null,
      createdAt: new Date(),
      sender,
    });
    prismaMock.message.count.mockResolvedValueOnce(3); // = seuil

    await service.sendMessage('room1', 'u1', 'mamadou@gmail.com');
    await new Promise((r) => setTimeout(r, 0));

    expect(notificationsMock.notifyContactFilterAlert).toHaveBeenCalledWith(
      'u1',
      'Awa Ndiaye',
      'room1',
      3,
    );
  });

  it("ne compte/n'alerte jamais un message vocal (pas de faux positif sur l'URL)", async () => {
    prismaMock.message.create.mockResolvedValueOnce({
      id: 'm3',
      roomId: 'room1',
      senderId: 'u1',
      content: '[AUDIO]:https://res.cloudinary.com/x/y.mp3',
      readAt: null,
      createdAt: new Date(),
      sender,
    });

    await service.sendMessage(
      'room1',
      'u1',
      '[AUDIO]:https://res.cloudinary.com/x/y.mp3',
    );
    await new Promise((r) => setTimeout(r, 0));

    expect(prismaMock.message.count).not.toHaveBeenCalled();
    expect(notificationsMock.notifyContactFilterAlert).not.toHaveBeenCalled();
  });

  it('ne recompte/alerte pas un message normal (rien de filtré)', async () => {
    prismaMock.message.create.mockResolvedValueOnce({
      id: 'm4',
      roomId: 'room1',
      senderId: 'u1',
      content: 'Bonjour, toujours dispo ?',
      readAt: null,
      createdAt: new Date(),
      sender,
    });

    await service.sendMessage('room1', 'u1', 'Bonjour, toujours dispo ?');
    await new Promise((r) => setTimeout(r, 0));

    expect(prismaMock.message.count).not.toHaveBeenCalled();
    expect(notificationsMock.notifyContactFilterAlert).not.toHaveBeenCalled();
  });

  it('déclenche aussi le contrôle sur editMessage()', async () => {
    prismaMock.message.findUnique.mockResolvedValueOnce({
      id: 'm5',
      roomId: 'room1',
      senderId: 'u1',
      content: 'ancien contenu',
      deletedAt: null,
    });
    prismaMock.message.update.mockResolvedValueOnce({
      id: 'm5',
      roomId: 'room1',
      senderId: 'u1',
      content: '[numéro masqué]',
      editedAt: new Date(),
      sender,
    });
    prismaMock.message.count.mockResolvedValueOnce(3);

    await service.editMessage('m5', 'u1', 'Appelle-moi au 77 123 45 67');
    await new Promise((r) => setTimeout(r, 0));

    expect(notificationsMock.notifyContactFilterAlert).toHaveBeenCalledWith(
      'u1',
      'Awa Ndiaye',
      'room1',
      3,
    );
  });
});
