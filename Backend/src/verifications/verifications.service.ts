import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { CompleteVerificationDto } from './dto/complete-verification.dto';
import { type User, Role, VerifStatus } from '@prisma/client';

@Injectable()
export class VerificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(requesterId: string, dto: CreateVerificationDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
    });

    if (!listing) throw new NotFoundException('Annonce introuvable');

    const isOwner = listing.ownerId === requesterId;
    const requester = await this.prisma.user.findUniqueOrThrow({
      where: { id: requesterId },
    });
    const isAdmin = requester.roles.includes(Role.ADMIN);

    if (!isOwner && !isAdmin) throw new ForbiddenException('Non autorisé');

    return this.prisma.verification.create({
      data: {
        listingId: dto.listingId,
        auditType: dto.auditType,
        scheduledAt: new Date(dto.scheduledAt),
        status: VerifStatus.REQUESTED,
      },
    });
  }

  async findPending() {
    return this.prisma.verification.findMany({
      where: { status: { in: [VerifStatus.REQUESTED, VerifStatus.SCHEDULED, VerifStatus.IN_PROGRESS] } },
      include: { listing: true, agent: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async assignAgent(verificationId: string, agentId: string) {
    return this.prisma.verification.update({
      where: { id: verificationId },
      data: { agentId, status: VerifStatus.SCHEDULED },
    });
  }

  async start(id: string, agentId: string) {
    const v = await this.prisma.verification.findUniqueOrThrow({ where: { id } });

    if (!v.agentId) throw new ForbiddenException('Aucun agent assigné');
    if (v.agentId !== agentId) throw new ForbiddenException('Non autorisé');

    return this.prisma.verification.update({
      where: { id },
      data: { status: VerifStatus.IN_PROGRESS },
    });
  }

  async complete(id: string, agentId: string, dto: CompleteVerificationDto) {
    const v = await this.prisma.verification.findUniqueOrThrow({ where: { id } });

    if (!v.agentId) throw new ForbiddenException('Aucun agent assigné');
    if (v.agentId !== agentId) throw new ForbiddenException('Non autorisé');

    await this.prisma.listing.update({
      where: { id: v.listingId },
      data: { isVerified: true, verifiedAt: new Date() },
    });

    return this.prisma.verification.update({
      where: { id },
      data: {
        status: VerifStatus.DONE,
        completedAt: new Date(),
        reportUrl: dto.reportUrl,
        notes: dto.notes,
        photos: dto.photos ?? [],
      },
    });
  }

  async reject(id: string, user: User, reason: string) {
    const v = await this.prisma.verification.findUniqueOrThrow({ where: { id } });

    const isAgent = v.agentId !== null && v.agentId === user.id;
    const isAdmin = user.roles.includes(Role.ADMIN);

    if (!isAgent && !isAdmin) throw new ForbiddenException('Non autorisé');

    return this.prisma.verification.update({
      where: { id },
      data: { status: VerifStatus.REJECTED, notes: reason },
    });
  }
}
