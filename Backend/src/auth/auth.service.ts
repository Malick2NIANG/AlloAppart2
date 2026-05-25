import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { type User, Role } from '@prisma/client';
import { createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';

interface ClerkUserData {
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface CreateAgentDto {
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private clerkClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.clerkClient = createClerkClient({
      secretKey: this.config.get<string>('CLERK_SECRET_KEY'),
    });
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
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
  }

  // Activation du rôle BAILLEUR depuis le dashboard — sans recréer de compte
  async activateBailleur(userId: string): Promise<User> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (user.roles.includes(Role.BAILLEUR)) {
      return user; // Déjà bailleur, rien à faire
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { roles: { push: Role.BAILLEUR } },
    });
  }

  // Création d'un AGENT_TERRAIN par l'ADMIN uniquement (pas de formulaire public)
  async createAgentTerrain(
    adminId: string,
    dto: CreateAgentDto,
  ): Promise<User> {
    const admin = await this.prisma.user.findUniqueOrThrow({
      where: { id: adminId },
    });

    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Réservé aux administrateurs');
    }

    const existing = await this.prisma.user.findUnique({
      where: { clerkId: dto.clerkId },
    });
    if (existing) throw new ConflictException('Cet agent existe déjà');

    return this.prisma.user.create({
      data: {
        ...dto,
        roles: [Role.AGENT_TERRAIN],
      },
    });
  }

  // Webhook Clerk — vérifie la signature et synchronise les événements user.*
  async handleWebhook(
    rawBody: Buffer,
    headers: Record<string, string>,
  ): Promise<{ received: boolean }> {
    const secret = this.config.get<string>('CLERK_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn('CLERK_WEBHOOK_SECRET non configuré — webhook ignoré');
      return { received: true };
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

  async getUsers(page: number, limit: number) {
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
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
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);
    return { data, total, page, limit };
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
