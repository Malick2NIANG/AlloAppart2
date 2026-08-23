import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { VerificationsService } from './verifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Role, VerifStatus, type User } from '@prisma/client';

// Ce fichier couvre reject() et findRatingByVerification() — les deux
// correctifs de sécurité appliqués à ce module. Les autres méthodes
// (create, assign, decline, complete, validate, rate) ne sont pas encore
// couvertes ici.
describe('VerificationsService', () => {
  let service: VerificationsService;
  let prismaMock: {
    verification: { findUniqueOrThrow: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    agentRating: { findUnique: jest.Mock };
    listing: { updateMany: jest.Mock };
  };

  const baseVerification = {
    id: 'verif1',
    listingId: 'listing1',
    agentId: 'agent1',
    status: VerifStatus.IN_PROGRESS,
  };

  beforeEach(async () => {
    prismaMock = {
      verification: { findUniqueOrThrow: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      agentRating: { findUnique: jest.fn() },
      listing: { updateMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();

    service = module.get<VerificationsService>(VerificationsService);
  });

  // Régression : reject() n'avait aucune contrainte de statut, contrairement
  // à decline() — un agent assigné pouvait rejeter (et écraser les notes
  // d'une) vérification déjà DONE, y compris après notation par le bailleur.
  describe('reject', () => {
    const agent = { id: 'agent1', roles: [Role.AGENT_TERRAIN] } as User;
    const admin = { id: 'admin1', roles: [Role.ADMIN] } as User;
    const otherAgent = { id: 'agent2', roles: [Role.AGENT_TERRAIN] } as User;

    it('refuse de rejeter une vérification déjà DONE — le contournement corrigé', async () => {
      prismaMock.verification.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseVerification,
        status: VerifStatus.DONE,
      });

      await expect(service.reject('verif1', agent, 'changement d\'avis')).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.verification.update).not.toHaveBeenCalled();
    });

    it("autorise le rejet pendant IN_PROGRESS par l'agent assigné", async () => {
      prismaMock.verification.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseVerification,
        status: VerifStatus.IN_PROGRESS,
      });
      prismaMock.verification.update.mockResolvedValueOnce({
        ...baseVerification,
        status: VerifStatus.REJECTED,
      });

      await expect(service.reject('verif1', agent, 'accès impossible')).resolves.toBeDefined();
    });

    it("refuse si l'appelant n'est ni l'agent assigné ni un admin", async () => {
      prismaMock.verification.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseVerification,
        status: VerifStatus.IN_PROGRESS,
      });

      await expect(service.reject('verif1', otherAgent, 'raison')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('un admin ne peut pas non plus rejeter une vérification DONE', async () => {
      prismaMock.verification.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseVerification,
        status: VerifStatus.DONE,
      });

      await expect(service.reject('verif1', admin, 'raison')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // Régression IDOR : GET :id/rating n'avait aucune vérification
  // d'autorisation — n'importe quel utilisateur connecté pouvait lire la
  // note/commentaire laissé par un bailleur sur un agent.
  describe('findRatingByVerification', () => {
    const owner = { id: 'owner1', roles: [Role.BAILLEUR] } as User;
    const ratedAgent = { id: 'agent1', roles: [Role.AGENT_TERRAIN] } as User;
    const admin = { id: 'admin1', roles: [Role.ADMIN] } as User;
    const stranger = { id: 'stranger1', roles: [Role.LOCATAIRE] } as User;

    const verifWithOwner = {
      id: 'verif1',
      agentId: 'agent1',
      listing: { ownerId: 'owner1' },
    };

    it('autorise le bailleur qui a demandé la vérification', async () => {
      prismaMock.verification.findUnique.mockResolvedValueOnce(verifWithOwner);
      prismaMock.agentRating.findUnique.mockResolvedValueOnce({ rating: 5 });

      await expect(service.findRatingByVerification('verif1', owner)).resolves.toEqual({
        rating: 5,
      });
    });

    it("autorise l'agent noté à voir sa propre note", async () => {
      prismaMock.verification.findUnique.mockResolvedValueOnce(verifWithOwner);
      prismaMock.agentRating.findUnique.mockResolvedValueOnce({ rating: 5 });

      await expect(service.findRatingByVerification('verif1', ratedAgent)).resolves.toBeDefined();
    });

    it('autorise un admin', async () => {
      prismaMock.verification.findUnique.mockResolvedValueOnce(verifWithOwner);
      prismaMock.agentRating.findUnique.mockResolvedValueOnce({ rating: 5 });

      await expect(service.findRatingByVerification('verif1', admin)).resolves.toBeDefined();
    });

    it('refuse à un utilisateur sans lien avec cette vérification — la faille IDOR corrigée', async () => {
      prismaMock.verification.findUnique.mockResolvedValueOnce(verifWithOwner);

      await expect(service.findRatingByVerification('verif1', stranger)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaMock.agentRating.findUnique).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si la vérification n\'existe pas', async () => {
      prismaMock.verification.findUnique.mockResolvedValueOnce(null);

      await expect(service.findRatingByVerification('inconnu', owner)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // Cron d'expiration du badge AlloVérifié — Article 6 des CGU (6 mois)
  describe('expireOldBadges', () => {
    it('retire le badge des annonces vérifiées il y a plus de 6 mois', async () => {
      prismaMock.listing.updateMany.mockResolvedValueOnce({ count: 3 });

      await service.expireOldBadges();

      expect(prismaMock.listing.updateMany).toHaveBeenCalledWith({
        where: { isVerified: true, verifiedAt: { lt: expect.any(Date) } },
        data: { isVerified: false },
      });
    });

    it("ne fait rien de plus si aucune annonce n'est concernée", async () => {
      prismaMock.listing.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.expireOldBadges()).resolves.toBeUndefined();
    });
  });
});
