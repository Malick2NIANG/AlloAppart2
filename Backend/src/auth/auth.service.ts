import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { type User, Role } from '@prisma/client';
import { createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';
import { MailService } from '../mail/mail.service';

interface ClerkUserData {
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface CreateAgentDto {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface CreateProAgenceDto {
  email: string;
  firstName: string;
  lastName: string;
  agencyName: string;
  phone?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private clerkClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {
    this.clerkClient = createClerkClient({
      secretKey: this.config.get<string>('CLERK_SECRET_KEY'),
    });
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    return Array.from(randomBytes(12))
      .map((b) => chars[b % chars.length])
      .join('');
  }

  // Appelé côté client après chaque inscription Clerk — crée l'utilisateur BDD si inexistant
  async syncUser(data: ClerkUserData): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { clerkId: data.clerkId },
    });

    if (existing) return existing;

    const emailTaken = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (emailTaken) throw new ConflictException('Email déjà utilisé');

    return this.prisma.user.create({
      data: {
        clerkId: data.clerkId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        roles: [Role.LOCATAIRE], // Rôle par défaut à l'inscription
      },
    });
  }

  async getMe(userId: string): Promise<User> {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  async updateMe(userId: string, dto: UpdateProfileDto): Promise<User> {
    // Vérifier unicité du slug si fourni
    if (dto.agencySlug) {
      const existing = await this.prisma.user.findUnique({
        where: { agencySlug: dto.agencySlug },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Ce slug est déjà utilisé par une autre agence.');
      }
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
  }

  // Changement de mot de passe obligatoire — agents/agences créés par l'admin avec mdp temporaire
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    await this.clerkClient.users.updateUser(user.clerkId, {
      password: dto.newPassword,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: false },
    });

    return { success: true };
  }

  // Activation du rôle BAILLEUR depuis le dashboard — sans recréer de compte
  async activateBailleur(userId: string): Promise<User> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (user.roles.includes(Role.BAILLEUR)) {
      return user; // Déjà bailleur, rien à faire
    }

    if (!user.phone) {
      throw new BadRequestException(
        'Un numéro de téléphone est requis pour activer le rôle bailleur',
      );
    }

    this.logger.log(`Activation rôle BAILLEUR → userId=${userId}`);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        roles: { push: Role.BAILLEUR },
        bailleurTermsAcceptedAt: new Date(),
      },
    });
  }

  // Création d'un AGENT_TERRAIN par l'ADMIN — compte Clerk créé automatiquement, credentials envoyés par mail
  async createAgentTerrain(
    adminId: string,
    dto: CreateAgentDto,
  ): Promise<User> {
    const admin = await this.prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Réservé aux administrateurs');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email déjà utilisé');

    const password = this.generatePassword();

    let clerkId: string;
    try {
      const clerkUser = await this.clerkClient.users.createUser({
        emailAddress: [dto.email],
        password,
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
      clerkId = clerkUser.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ConflictException(`Erreur Clerk : ${msg}`);
    }

    this.logger.log(`Création AGENT_TERRAIN → clerkId=${clerkId} email=${dto.email}`);

    const user = await this.prisma.user.create({
      data: {
        clerkId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone ?? null,
        roles: [Role.AGENT_TERRAIN],
        mustChangePassword: true,
      },
    });

    void this.mail.sendCredentials({ to: dto.email, firstName: dto.firstName, role: 'agent', password });

    return user;
  }

  // Webhook Clerk — vérifie la signature et synchronise les événements user.*
  async handleWebhook(
    rawBody: Buffer,
    headers: Record<string, string>,
  ): Promise<{ received: boolean }> {
    const secret = this.config.get<string>('CLERK_WEBHOOK_SECRET');
    if (!secret) {
      throw new UnauthorizedException(
        'CLERK_WEBHOOK_SECRET non configuré — webhook refusé',
      );
    }

    const wh = new Webhook(secret);
    let event: { type: string; data: Record<string, unknown> };

    try {
      event = wh.verify(rawBody, headers) as typeof event;
    } catch {
      throw new UnauthorizedException('Signature webhook invalide');
    }

    const data = event.data as {
      id: string;
      email_addresses?: { email_address: string; id: string }[];
      primary_email_address_id?: string;
      first_name?: string;
      last_name?: string;
      phone_numbers?: { phone_number: string }[];
    };

    if (event.type === 'user.created') {
      const primaryEmail = data.email_addresses?.find(
        (e) => e.id === data.primary_email_address_id,
      );
      await this.prisma.user.upsert({
        where: { clerkId: data.id },
        create: {
          clerkId: data.id,
          email: primaryEmail?.email_address ?? `${data.id}@clerk.local`,
          firstName: data.first_name ?? 'Utilisateur',
          lastName: data.last_name ?? '',
          phone: data.phone_numbers?.[0]?.phone_number ?? null,
          roles: [Role.LOCATAIRE],
        },
        update: {},
      });
      this.logger.log(`Webhook user.created → ${data.id}`);
    }

    if (event.type === 'user.updated') {
      const primaryEmail = data.email_addresses?.find(
        (e) => e.id === data.primary_email_address_id,
      );
      await this.prisma.user.updateMany({
        where: { clerkId: data.id },
        data: {
          ...(primaryEmail && { email: primaryEmail.email_address }),
          ...(data.first_name && { firstName: data.first_name }),
          ...(data.last_name !== undefined && {
            lastName: data.last_name ?? '',
          }),
          ...(data.phone_numbers?.[0] && {
            phone: data.phone_numbers[0].phone_number,
          }),
        },
      });
      this.logger.log(`Webhook user.updated → ${data.id}`);
    }

    if (event.type === 'user.deleted') {
      await this.prisma.user.deleteMany({ where: { clerkId: data.id } });
      this.logger.log(`Webhook user.deleted → ${data.id}`);
    }

    return { received: true };
  }

  async getUsers(page: number, limit: number, q?: string, role?: Role) {
    const where = {
      ...(role
        ? { roles: { has: role } }
        : { roles: { hasSome: [Role.BAILLEUR, Role.PRO_AGENCE, Role.AGENT_TERRAIN, Role.ADMIN] } }
      ),
      ...(q && {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' as const } },
          { lastName: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          clerkId: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          roles: true,
          isVerified: true,
          isSuspended: true,
          agencyName: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  // Liste des agents disponibles — accessible aux bailleurs pour exprimer une préférence
  async findAgents() {
    const agents = await this.prisma.user.findMany({
      where: {
        roles: { has: Role.AGENT_TERRAIN },
        isSuspended: false,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        phone: true,
        verifications: {
          where: { status: 'DONE' },
          select: { id: true },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    return agents.map((a) => ({
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      avatar: a.avatar,
      bio: a.bio,
      phone: a.phone,
      completedMissions: a.verifications.length,
    }));
  }

  async findAgentById(id: string) {
    const agent = await this.prisma.user.findFirst({
      where: { id, roles: { has: Role.AGENT_TERRAIN }, isSuspended: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        phone: true,
        createdAt: true,
        verifications: {
          where: { status: 'DONE' },
          select: { id: true },
        },
        agentRatings: {
          select: { id: true, rating: true, comment: true, createdAt: true,
            rater: { select: { firstName: true, lastName: true, avatar: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!agent) throw new NotFoundException('Agent introuvable');

    const ratings = agent.agentRatings;
    const avgRating = ratings.length
      ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10
      : null;

    return {
      id: agent.id,
      firstName: agent.firstName,
      lastName: agent.lastName,
      avatar: agent.avatar,
      bio: agent.bio,
      phone: agent.phone,
      memberSince: agent.createdAt,
      completedMissions: agent.verifications.length,
      avgRating,
      totalRatings: ratings.length,
      ratings: ratings.map((r) => ({
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

  async findUserProfile(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, isSuspended: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        phone: true,
        roles: true,
        agencyName: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async updateUser(
    targetId: string,
    adminId: string,
    dto: { firstName?: string; lastName?: string; phone?: string | null; agencyName?: string | null },
  ) {
    const admin = await this.prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    if (!admin.roles.includes(Role.ADMIN)) throw new ForbiddenException('Réservé aux administrateurs');

    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('Utilisateur introuvable');
    if (target.roles.includes(Role.ADMIN)) throw new ForbiddenException('Impossible de modifier un administrateur');

    return this.prisma.user.update({
      where: { id: targetId },
      data: {
        ...(dto.firstName  !== undefined ? { firstName:  dto.firstName  } : {}),
        ...(dto.lastName   !== undefined ? { lastName:   dto.lastName   } : {}),
        ...(dto.phone      !== undefined ? { phone:      dto.phone      } : {}),
        ...(dto.agencyName !== undefined ? { agencyName: dto.agencyName } : {}),
      },
      select: {
        id: true, clerkId: true, email: true, phone: true,
        firstName: true, lastName: true, roles: true,
        isVerified: true, isSuspended: true, agencyName: true,
        createdAt: true, updatedAt: true,
      },
    });
  }

  async suspendUser(targetId: string, adminId: string): Promise<{ isSuspended: boolean }> {
    const admin = await this.prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Réservé aux administrateurs');
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('Utilisateur introuvable');
    if (target.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Impossible de suspendre un administrateur');
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { isSuspended: !target.isSuspended },
      select: { isSuspended: true },
    });
    this.logger.log(`suspendUser → targetId=${targetId} isSuspended=${String(updated.isSuspended)}`);

    if (updated.isSuspended) {
      void this.mail.sendAccountSuspended({ to: target.email, firstName: target.firstName });
    } else {
      void this.mail.sendAccountReactivated({ to: target.email, firstName: target.firstName });
    }

    return updated;
  }

  async deleteUser(targetId: string, adminId: string): Promise<{ deleted: boolean }> {
    const admin = await this.prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Réservé aux administrateurs');
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('Utilisateur introuvable');
    if (target.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Impossible de supprimer un administrateur');
    }

    await this.prisma.user.delete({ where: { id: targetId } });
    this.logger.warn(`deleteUser → targetId=${targetId} by admin=${adminId}`);
    return { deleted: true };
  }

  // Création d'un compte PRO_AGENCE par l'ADMIN — compte Clerk créé automatiquement, credentials envoyés par mail + SMS
  async createProAgence(
    adminId: string,
    dto: CreateProAgenceDto,
  ): Promise<User> {
    const admin = await this.prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Réservé aux administrateurs');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email déjà utilisé');

    const password = this.generatePassword();

    let clerkId: string;
    try {
      const clerkUser = await this.clerkClient.users.createUser({
        emailAddress: [dto.email],
        password,
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
      clerkId = clerkUser.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ConflictException(`Erreur Clerk : ${msg}`);
    }

    this.logger.log(`Création PRO_AGENCE → clerkId=${clerkId} email=${dto.email} agence=${dto.agencyName}`);

    const user = await this.prisma.user.create({
      data: {
        clerkId,
        email:      dto.email,
        firstName:  dto.firstName,
        lastName:   dto.lastName,
        phone:      dto.phone ?? null,
        agencyName: dto.agencyName,
        roles:      [Role.PRO_AGENCE],
        mustChangePassword: true,
      },
    });

    void this.mail.sendCredentials({ to: dto.email, firstName: dto.firstName, role: 'agence', password, agencyName: dto.agencyName });

    return user;
  }

  // Désactivation du rôle BAILLEUR (admin)
  async deactivateBailleur(
    targetUserId: string,
    adminId: string,
  ): Promise<User> {
    const admin = await this.prisma.user.findUniqueOrThrow({
      where: { id: adminId },
    });

    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Réservé aux administrateurs');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!target) throw new NotFoundException('Utilisateur introuvable');

    const newRoles = target.roles.filter((r) => r !== Role.BAILLEUR);

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { roles: newRoles },
    });
  }
}
