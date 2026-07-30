import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { CompleteVerificationDto } from './dto/complete-verification.dto';
import { RateVerificationDto } from './dto/rate-verification.dto';
import { type User, Role, VerifStatus } from '@prisma/client';

@Injectable()
export class VerificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: NotificationsService,
  ) {}

  async create(requesterId: string, dto: CreateVerificationDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
    });

    if (!listing) throw new NotFoundException('Listing not found');

    const isOwner = listing.ownerId === requesterId;
    const requester = await this.prisma.user.findUniqueOrThrow({
      where: { id: requesterId },
    });
    const isAdmin = requester.roles.includes(Role.ADMIN);

    if (!isOwner && !isAdmin) throw new ForbiddenException('Not authorized');

    // Bloquer les doublons : une seule verif active par annonce
    const existing = await this.prisma.verification.findFirst({
      where: {
        listingId: dto.listingId,
        status: { in: [VerifStatus.REQUESTED, VerifStatus.SCHEDULED, VerifStatus.IN_PROGRESS] },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Une vérification est déjà en cours pour cette annonce. Attendez qu\'elle soit terminée avant d\'en soumettre une nouvelle.',
      );
    }

    return this.prisma.verification.create({
      data: {
        listingId: dto.listingId,
        auditType: dto.auditType,
        scheduledAt: new Date(dto.scheduledAt),
        status: VerifStatus.REQUESTED,
        ...(dto.preferredAgentId ? { preferredAgentId: dto.preferredAgentId } : {}),
      },
    });
  }

  async findOne(id: string, agentId: string) {
    const v = await this.prisma.verification.findUnique({
      where: { id },
      include: {
        listing: {
          select: {
            id: true, title: true, city: true, address: true, images: true,
            lat: true, lng: true,
            owner: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          },
        },
        agent: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!v) throw new NotFoundException('Mission not found');
    if (v.agentId !== agentId) throw new ForbiddenException('Not authorized');
    return v;
  }

  async findAllForAgent(agentId: string) {
    return this.prisma.verification.findMany({
      where: { agentId },
      include: {
        listing: { select: { id: true, title: true, city: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findAssigned(agentId: string) {
    return this.prisma.verification.findMany({
      where: {
        agentId,
        status: { in: [VerifStatus.SCHEDULED, VerifStatus.IN_PROGRESS] },
      },
      include: {
        listing: {
          select: {
            id: true, title: true, city: true, address: true, images: true,
            owner: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findAgentHistory(agentId: string) {
    return this.prisma.verification.findMany({
      where: {
        agentId,
        status: { in: [VerifStatus.DONE, VerifStatus.REJECTED] },
      },
      include: {
        listing: { select: { id: true, title: true, city: true, images: true } },
      },
      orderBy: { completedAt: 'desc' },
    });
  }

  async agentStats(agentId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [assigned, inProgress, doneThisMonth, doneTotal, todayMissions, ratings] = await Promise.all([
      this.prisma.verification.count({ where: { agentId, status: VerifStatus.SCHEDULED } }),
      this.prisma.verification.count({ where: { agentId, status: VerifStatus.IN_PROGRESS } }),
      this.prisma.verification.count({ where: { agentId, status: VerifStatus.DONE, completedAt: { gte: monthStart } } }),
      this.prisma.verification.count({ where: { agentId, status: VerifStatus.DONE } }),
      this.prisma.verification.findMany({
        where: {
          agentId,
          scheduledAt: { gte: today, lt: new Date(today.getTime() + 86400000) },
          status: { in: [VerifStatus.SCHEDULED, VerifStatus.IN_PROGRESS] },
        },
        include: { listing: { select: { id: true, title: true, city: true, address: true } } },
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.agentRating.findMany({
        where: { agentId },
        select: {
          id: true, rating: true, comment: true, createdAt: true,
          rater: { select: { firstName: true, lastName: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const totalRatings = await this.prisma.agentRating.count({ where: { agentId } });
    const ratingSum    = await this.prisma.agentRating.aggregate({ where: { agentId }, _avg: { rating: true } });
    const avgRating    = ratingSum._avg.rating ? Math.round(ratingSum._avg.rating * 10) / 10 : null;

    return {
      assigned,
      inProgress,
      doneThisMonth,
      doneTotal,
      todayMissions,
      avgRating,
      totalRatings,
      recentRatings: ratings.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        raterFirstName: r.rater.firstName,
        raterLastName: r.rater.lastName,
        raterAvatar: r.rater.avatar,
      })),
    };
  }

  async findByRequester(userId: string) {
    return this.prisma.verification.findMany({
      where: { listing: { ownerId: userId } },
      include: {
        listing: { select: { id: true, title: true, city: true, images: true } },
        agent: { select: { id: true, firstName: true, lastName: true, phone: true, avatar: true, bio: true } },
        rating: { select: { id: true, rating: true, comment: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPending() {
    return this.prisma.verification.findMany({
      where: {
        status: {
          in: [
            VerifStatus.REQUESTED,
            VerifStatus.SCHEDULED,
            VerifStatus.IN_PROGRESS,
          ],
        },
      },
      include: {
        listing: {
          include: {
            owner: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          },
        },
        agent: true,
        preferredAgent: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async pendingCount(): Promise<{ count: number }> {
    const count = await this.prisma.verification.count({
      where: { status: VerifStatus.REQUESTED },
    });
    return { count };
  }

  async decline(id: string, agentId: string, reason: string) {
    const v = await this.prisma.verification.findUniqueOrThrow({
      where: { id },
      include: { listing: { include: { owner: { select: { id: true } } } } },
    });

    if (v.agentId !== agentId) throw new ForbiddenException('Not authorized');
    if (v.status !== VerifStatus.SCHEDULED) {
      throw new BadRequestException('Only scheduled missions can be declined.');
    }

    // Met en attente d'approbation admin (ne prend pas effet immédiatement)
    const updated = await this.prisma.verification.update({
      where: { id },
      data: { status: VerifStatus.DECLINE_PENDING, declineReason: reason },
    });

    // Notif admin — l'agent demande à décliner
    void this.notif.notifyAdminDeclineRequest(v.listing.title, id, v.listingId);

    return updated;
  }

  async approveDecline(id: string) {
    const v = await this.prisma.verification.findUniqueOrThrow({
      where: { id },
      include: { listing: { include: { owner: { select: { id: true } } } } },
    });
    if (v.status !== VerifStatus.DECLINE_PENDING) {
      throw new BadRequestException('This verification is not pending decline.');
    }
    const updated = await this.prisma.verification.update({
      where: { id },
      data: { status: VerifStatus.REQUESTED, agentId: null },
    });
    void this.notif.notifyVerifDeclined(v.listing.owner.id, v.listing.title, id, v.listingId);
    return updated;
  }

  async refuseDecline(id: string) {
    const v = await this.prisma.verification.findUniqueOrThrow({ where: { id } });
    if (v.status !== VerifStatus.DECLINE_PENDING) {
      throw new BadRequestException('This verification is not pending decline.');
    }
    return this.prisma.verification.update({
      where: { id },
      data: { status: VerifStatus.SCHEDULED, declineReason: null },
    });
  }

  async assignAgent(verificationId: string, agentId: string) {
    const v = await this.prisma.verification.update({
      where: { id: verificationId },
      data: { agentId, status: VerifStatus.SCHEDULED },
      include: {
        listing: { include: { owner: { select: { id: true, firstName: true, lastName: true } } } },
        agent:   { select: { firstName: true, lastName: true } },
      },
    });

    const listingTitle = v.listing.title;
    const agentName    = `${v.agent?.firstName ?? ''} ${v.agent?.lastName ?? ''}`.trim();
    const bailleurId   = v.listing.owner.id;

    // Notif agent — nouvelle mission
    void this.notif.notifyVerifAssigned(agentId, listingTitle, verificationId, v.listingId);
    // Notif bailleur — agent confirmé
    void this.notif.notifyVerifScheduled(bailleurId, listingTitle, agentName, verificationId, v.listingId);

    return v;
  }

  async start(id: string, agentId: string) {
    const v = await this.prisma.verification.findUniqueOrThrow({
      where: { id },
      include: { listing: { include: { owner: { select: { id: true } } } } },
    });

    if (!v.agentId) throw new ForbiddenException('No agent assigned');
    if (v.agentId !== agentId) throw new ForbiddenException('Not authorized');

    // Bloquer si la visite est planifiée dans plus de 15 minutes
    const earliest = new Date(v.scheduledAt.getTime() - 15 * 60 * 1000);
    if (new Date() < earliest) {
      throw new BadRequestException(
        `La visite ne peut démarrer qu'à partir de ${earliest.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      );
    }

    const updated = await this.prisma.verification.update({
      where: { id },
      data: { status: VerifStatus.IN_PROGRESS },
    });

    // Notif bailleur — visite démarrée
    void this.notif.notifyVerifInProgress(v.listing.owner.id, v.listing.title, id, v.listingId);

    return updated;
  }

  async complete(id: string, agentId: string, dto: CompleteVerificationDto) {
    const v = await this.prisma.verification.findUniqueOrThrow({
      where: { id },
      include: { listing: { include: { owner: { select: { id: true } } } } },
    });

    if (!v.agentId) throw new ForbiddenException('No agent assigned');
    if (v.agentId !== agentId) throw new ForbiddenException('Not authorized');
    if (v.status !== VerifStatus.IN_PROGRESS)
      throw new BadRequestException('Visit must be started before certifying the property');

    await this.prisma.listing.update({
      where: { id: v.listingId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        ...(dto.tourUrl ? { tourUrl: dto.tourUrl } : {}),
      },
    });

    const updated = await this.prisma.verification.update({
      where: { id },
      data: {
        status: VerifStatus.DONE,
        completedAt: new Date(),
        reportUrl: dto.reportUrl,
        notes: dto.notes,
        photos: dto.photos ?? [],
      },
    });

    // Notif bailleur — visite terminée
    void this.notif.notifyVerifDone(v.listing.owner.id, v.listing.title, id, v.listingId);

    return updated;
  }

  async findAll(page = 1, limit = 20, status?: VerifStatus) {
    const where = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.verification.findMany({
        where,
        include: {
          listing: {
            select: {
              id: true, title: true, city: true,
              owner: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
            },
          },
          agent: { select: { id: true, firstName: true, lastName: true } },
          preferredAgent: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.verification.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async validate(id: string, adminId: string) {
    const admin = await this.prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Admin only');
    }

    const v = await this.prisma.verification.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Verification not found');

    if (v.status !== VerifStatus.DONE) {
      throw new BadRequestException(
        'Le badge AlloVérifié ne peut être accordé que sur une visite terminée par l\'agent (statut DONE).',
      );
    }

    const listing = await this.prisma.listing.update({
      where: { id: v.listingId },
      data: { isVerified: true, verifiedAt: new Date() },
      include: { owner: { select: { id: true } } },
    });

    // Notif bailleur — badge accordé
    void this.notif.notifyVerifValidated(listing.owner.id, listing.title, id, v.listingId);

    return { validated: true };
  }

  async reject(id: string, user: User, reason: string) {
    const v = await this.prisma.verification.findUniqueOrThrow({
      where: { id },
    });

    const isAgent = v.agentId !== null && v.agentId === user.id;
    const isAdmin = user.roles.includes(Role.ADMIN);

    if (!isAgent && !isAdmin) throw new ForbiddenException('Not authorized');

    return this.prisma.verification.update({
      where: { id },
      data: { status: VerifStatus.REJECTED, notes: reason },
    });
  }

  async rate(verificationId: string, raterId: string, dto: RateVerificationDto) {
    // Vérifier que la verif existe et est DONE
    const v = await this.prisma.verification.findUnique({
      where: { id: verificationId },
      include: { listing: { select: { ownerId: true } } },
    });

    if (!v) throw new NotFoundException('Verification not found');
    if (v.status !== VerifStatus.DONE) {
      throw new BadRequestException('Rating is only available after a completed visit (status DONE).');
    }
    if (v.listing.ownerId !== raterId) {
      throw new ForbiddenException('Seul le bailleur de l\'annonce peut noter l\'agent.');
    }
    if (!v.agentId) {
      throw new BadRequestException('No agent assigned to this verification.');
    }

    // Upsert — un seul avis par vérification
    return this.prisma.agentRating.upsert({
      where: { verificationId },
      create: {
        verificationId,
        agentId: v.agentId,
        raterId,
        rating: dto.rating,
        comment: dto.comment,
      },
      update: {
        rating: dto.rating,
        comment: dto.comment,
      },
    });
  }

  async findRatingByVerification(verificationId: string) {
    return this.prisma.agentRating.findUnique({ where: { verificationId } });
  }
}
