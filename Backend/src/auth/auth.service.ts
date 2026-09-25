import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { type User, BookingStatus, Role } from '@prisma/client';
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
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
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

    if (emailTaken) throw new ConflictException('Email already in use');

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
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    // Auto-heal : si le prénom est un placeholder (créé par le guard avant le webhook Clerk)
    if (!user.firstName || user.firstName === 'Utilisateur') {
      try {
        const clerkUser = await this.clerkClient.users.getUser(user.clerkId);
        const primaryEmail = clerkUser.emailAddresses.find(
          (e) => e.id === clerkUser.primaryEmailAddressId,
        );
        return await this.prisma.user.update({
          where: { id: userId },
          data: {
            ...(clerkUser.firstName && { firstName: clerkUser.firstName }),
            ...(clerkUser.lastName !== undefined && {
              lastName: clerkUser.lastName ?? '',
            }),
            ...(primaryEmail && { email: primaryEmail.emailAddress }),
          },
        });
      } catch {
        /* ignore — erreur Clerk API, on renvoie l'utilisateur en l'état */
      }
    }
    return user;
  }

  /**
   * Slug URL de la vitrine — dérivé du nom d'agence, jamais saisi par
   * l'agence elle-même (cf. UpdateProfileDto). "Ma vitrine" doit rester une
   * simple page AlloAppart plutôt qu'un nom de domaine à configurer.
   */
  private slugifyAgencyName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // diacritiques
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 70); // marge pour un éventuel suffixe numérique (colonne @db.VarChar(80))
  }

  /** Ajoute -2, -3, ... jusqu'à trouver un slug libre. `excludeUserId` permet à l'agence de garder le sien lors d'une régénération. */
  private async generateUniqueAgencySlug(
    agencyName: string,
    excludeUserId?: string,
  ): Promise<string> {
    const base = this.slugifyAgencyName(agencyName) || 'agence';
    let candidate = base;
    let suffix = 2;
    for (;;) {
      const existing = await this.prisma.user.findUnique({
        where: { agencySlug: candidate },
        select: { id: true },
      });
      if (!existing || existing.id === excludeUserId) return candidate;
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }

  async updateMe(userId: string, dto: UpdateProfileDto): Promise<User> {
    // Assignation automatique du slug au premier renseignement du nom
    // d'agence — jamais réattribué ensuite (URL stable une fois partagée),
    // et jamais exposé au formulaire (cf. UpdateProfileDto).
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // Nom/prénom verrouillés pour les agents : renseignés par l'admin à la
    // création du compte (cf. page "Mon profil" agent, décision du 2026-09-24).
    // Ignorés silencieusement plutôt que rejetés — le formulaire agent les
    // envoie déjà désactivés, donc identiques à l'existant en usage normal.
    const safeDto: UpdateProfileDto = { ...dto };
    if (current.roles.includes(Role.AGENT_TERRAIN)) {
      delete safeDto.firstName;
      delete safeDto.lastName;
    }

    // Un même numéro ne doit pas pouvoir être rattaché à deux comptes — sinon
    // rien n'empêche un utilisateur de "voler" le numéro (donc l'identité
    // de contact) d'un autre. On ne vérifie que si le numéro change
    // réellement, pour ne pas bloquer un simple ré-enregistrement du profil.
    if (safeDto.phone && safeDto.phone !== current.phone) {
      const existing = await this.prisma.user.findFirst({
        where: { phone: safeDto.phone, id: { not: userId } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          'Ce numéro de téléphone est déjà utilisé par un autre compte.',
        );
      }
    }

    let agencySlug: string | undefined;
    if (safeDto.agencyName && !current.agencySlug) {
      agencySlug = await this.generateUniqueAgencySlug(
        safeDto.agencyName,
        userId,
      );
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { ...safeDto, ...(agencySlug ? { agencySlug } : {}) },
    });
  }

  // Changement de mot de passe obligatoire — agents/agences créés par l'admin avec mdp temporaire
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // Cette route ne sert qu'au changement forcé du mot de passe temporaire
    // (agents/agences créés par l'admin). Un changement de mot de passe "volontaire"
    // doit passer par l'UI Clerk elle-même (qui vérifie l'ancien mot de passe).
    if (!user.mustChangePassword) {
      throw new ForbiddenException(
        'Cette route est réservée au changement du mot de passe temporaire initial.',
      );
    }

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

  // Acceptation des CGU générales — tous rôles. Appelé juste après l'inscription
  // (LOCATAIRE) ou via l'écran de blocage /accept-terms (comptes existants et
  // comptes créés par l'admin, après le changement de mot de passe obligatoire).
  // Idempotent : ne réécrase pas une acceptation déjà enregistrée.
  async acceptTerms(userId: string): Promise<User> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.termsAcceptedAt) return user;

    return this.prisma.user.update({
      where: { id: userId },
      data: { termsAcceptedAt: new Date() },
    });
  }

  // Création d'un AGENT_TERRAIN par l'ADMIN — compte Clerk créé automatiquement, credentials envoyés par mail
  async createAgentTerrain(
    adminId: string,
    dto: CreateAgentDto,
  ): Promise<User> {
    const admin = await this.prisma.user.findUniqueOrThrow({
      where: { id: adminId },
    });
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Admin only');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

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

    this.logger.log(
      `Création AGENT_TERRAIN → clerkId=${clerkId} email=${dto.email}`,
    );

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

    void this.mail.sendCredentials({
      to: dto.email,
      firstName: dto.firstName,
      role: 'agent',
      password,
    });

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
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const data = event.data as {
      id: string;
      email_addresses?: { email_address: string; id: string }[];
      primary_email_address_id?: string;
      first_name?: string;
      last_name?: string;
      phone_numbers?: { phone_number: string }[];
      two_factor_enabled?: boolean;
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
          firstName: data.first_name ?? '',
          lastName: data.last_name ?? '',
          phone: data.phone_numbers?.[0]?.phone_number ?? null,
          roles: [Role.LOCATAIRE],
          twoFactorEnabled: data.two_factor_enabled ?? false,
        },
        update: {
          // Met à jour le nom/email si le guard avait créé l'utilisateur avec des données placeholder
          ...(primaryEmail && { email: primaryEmail.email_address }),
          ...(data.first_name && { firstName: data.first_name }),
          ...(data.last_name !== undefined && {
            lastName: data.last_name ?? '',
          }),
          ...(data.phone_numbers?.[0]?.phone_number && {
            phone: data.phone_numbers[0].phone_number,
          }),
          ...(data.two_factor_enabled !== undefined && {
            twoFactorEnabled: data.two_factor_enabled,
          }),
        },
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
          // Activer/désactiver la 2FA (TOTP) dans Clerk déclenche un
          // événement user.updated — c'est ce qui garde en phase le flag
          // local utilisé par RolesGuard pour imposer la 2FA aux ADMIN.
          ...(data.two_factor_enabled !== undefined && {
            twoFactorEnabled: data.two_factor_enabled,
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
        : {
            roles: {
              hasSome: [
                Role.BAILLEUR,
                Role.PRO_AGENCE,
                Role.AGENT_TERRAIN,
                Role.ADMIN,
              ],
            },
          }),
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
        coverageZone: true,
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
      coverageZone: a.coverageZone,
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
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            rater: {
              select: { firstName: true, lastName: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!agent) throw new NotFoundException('Agent not found');

    const ratings = agent.agentRatings;
    const avgRating = ratings.length
      ? Math.round(
          (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10,
        ) / 10
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

  // Profil générique (n'importe quel utilisateur, bailleur simple ou non).
  // Le téléphone n'est révélé au viewer que s'il a une réservation qualifiante
  // (CONFIRMED/ACTIVE/COMPLETED) avec la cible — dans un sens ou l'autre —, ou
  // s'il consulte son propre profil, ou s'il est ADMIN. Même logique
  // anti-contournement que AgencesService.getPhoneForViewer (Task #120), mais
  // ici sur le endpoint générique qui couvre aussi les bailleurs individuels
  // (la vitrine d'agence, elle, ne fuite déjà plus jamais le téléphone —
  // Task #123).
  async findUserProfile(id: string, viewerId: string, viewerIsAdmin: boolean) {
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
    if (!user) throw new NotFoundException('User not found');

    if (viewerIsAdmin || viewerId === id) return user;

    const qualifyingBooking = await this.prisma.booking.findFirst({
      where: {
        status: {
          in: [
            BookingStatus.CONFIRMED,
            BookingStatus.ACTIVE,
            BookingStatus.COMPLETED,
          ],
        },
        OR: [
          { tenantId: viewerId, listing: { ownerId: id } },
          { tenantId: id, listing: { ownerId: viewerId } },
        ],
      },
      select: { id: true },
    });

    return { ...user, phone: qualifyingBooking ? user.phone : null };
  }

  async updateUser(
    targetId: string,
    adminId: string,
    dto: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      agencyName?: string | null;
    },
  ) {
    const admin = await this.prisma.user.findUniqueOrThrow({
      where: { id: adminId },
    });
    if (!admin.roles.includes(Role.ADMIN))
      throw new ForbiddenException('Admin only');

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.roles.includes(Role.ADMIN))
      throw new ForbiddenException('Cannot edit an administrator');

    return this.prisma.user.update({
      where: { id: targetId },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.agencyName !== undefined ? { agencyName: dto.agencyName } : {}),
      },
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
    });
  }

  async suspendUser(
    targetId: string,
    adminId: string,
  ): Promise<{ isSuspended: boolean }> {
    const admin = await this.prisma.user.findUniqueOrThrow({
      where: { id: adminId },
    });
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Admin only');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Cannot suspend an administrator');
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { isSuspended: !target.isSuspended },
      select: { isSuspended: true },
    });
    this.logger.log(
      `suspendUser → targetId=${targetId} isSuspended=${String(updated.isSuspended)}`,
    );

    if (updated.isSuspended) {
      void this.mail.sendAccountSuspended({
        to: target.email,
        firstName: target.firstName,
        locale: target.locale,
      });
    } else {
      void this.mail.sendAccountReactivated({
        to: target.email,
        firstName: target.firstName,
        locale: target.locale,
      });
    }

    return updated;
  }

  async deleteUser(
    targetId: string,
    adminId: string,
  ): Promise<{ deleted: boolean }> {
    const admin = await this.prisma.user.findUniqueOrThrow({
      where: { id: adminId },
    });
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Admin only');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Cannot delete an administrator');
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
    const admin = await this.prisma.user.findUniqueOrThrow({
      where: { id: adminId },
    });
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Admin only');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

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

    this.logger.log(
      `Création PRO_AGENCE → clerkId=${clerkId} email=${dto.email} agence=${dto.agencyName}`,
    );

    // Sa page vitrine (/agences/:slug) existe dès la création du compte,
    // sans que l'agence n'ait jamais à choisir/saisir un slug elle-même.
    const agencySlug = await this.generateUniqueAgencySlug(dto.agencyName);

    const user = await this.prisma.user.create({
      data: {
        clerkId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone ?? null,
        agencyName: dto.agencyName,
        agencySlug,
        roles: [Role.PRO_AGENCE],
        mustChangePassword: true,
      },
    });

    void this.mail.sendCredentials({
      to: dto.email,
      firstName: dto.firstName,
      role: 'agence',
      password,
      agencyName: dto.agencyName,
    });

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
      throw new ForbiddenException('Admin only');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!target) throw new NotFoundException('User not found');

    const newRoles = target.roles.filter((r) => r !== Role.BAILLEUR);

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { roles: newRoles },
    });
  }

  // ── 2FA email admin — remplace le TOTP Clerk (fonctionnalité payante sur
  // ce plan), cf. décision du 2026-09-25. Un code est requis à chaque
  // nouvelle session Clerk (claim "sid" du JWT) plutôt qu'un flag permanent
  // sur le compte, pour se comporter comme un vrai 2FA "à chaque connexion".

  async sendAdminLoginOtp(
    admin: Pick<User, 'id' | 'email' | 'locale' | 'roles'>,
  ): Promise<{ sent: boolean; expiresInSeconds: number }> {
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Admin only');
    }
    const code = String(randomInt(100_000, 1_000_000));
    const salt = makeSalt();
    await this.prisma.adminLoginOtp.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        codeHash: hashCode(code, salt),
        codeSalt: salt,
        expiresAt: new Date(Date.now() + ADMIN_OTP_TTL_MS),
      },
    });
    await this.mail.sendAdminLoginOtp({
      to: admin.email,
      code,
      locale: admin.locale,
    });
    this.logger.log(`Code OTP connexion admin envoyé à ${admin.email}`);
    return { sent: true, expiresInSeconds: ADMIN_OTP_TTL_MS / 1000 };
  }

  async verifyAdminLoginOtp(
    admin: Pick<User, 'id' | 'roles'>,
    sessionId: string | undefined,
    code: string,
  ): Promise<{ verified: true }> {
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Admin only');
    }
    if (!sessionId) {
      throw new BadRequestException('Session Clerk introuvable.');
    }

    // Verrouillage anti-brute-force — indépendant du @Throttle par IP de la
    // route, qu'un attaquant distribuant ses requêtes sur plusieurs IP
    // pourrait contourner. Compte les échecs consécutifs tous codes
    // confondus (redemander un code ne réinitialise pas le compteur).
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: admin.id },
      select: { adminOtpFailedAttempts: true, adminOtpLockedUntil: true },
    });
    if (
      current.adminOtpLockedUntil &&
      current.adminOtpLockedUntil > new Date()
    ) {
      const minutesLeft = Math.ceil(
        (current.adminOtpLockedUntil.getTime() - Date.now()) / 60_000,
      );
      throw new ForbiddenException(
        `Trop de tentatives échouées. Réessayez dans ${minutesLeft} min.`,
      );
    }

    const otp = await this.prisma.adminLoginOtp.findFirst({
      where: {
        adminId: admin.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    const isValid =
      !!otp && safeEqual(hashCode(code, otp.codeSalt), otp.codeHash);

    if (!isValid) {
      const attempts = current.adminOtpFailedAttempts + 1;
      const lockedOut = attempts >= ADMIN_OTP_MAX_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: admin.id },
        data: {
          adminOtpFailedAttempts: lockedOut ? 0 : attempts,
          ...(lockedOut
            ? {
                adminOtpLockedUntil: new Date(
                  Date.now() + ADMIN_OTP_LOCKOUT_MS,
                ),
              }
            : {}),
        },
      });
      if (lockedOut) {
        this.logger.warn(
          `Verrouillage 2FA admin — ${ADMIN_OTP_MAX_ATTEMPTS} échecs consécutifs pour adminId=${admin.id}`,
        );
        throw new ForbiddenException(
          `Trop de tentatives échouées. Réessayez dans ${Math.round(ADMIN_OTP_LOCKOUT_MS / 60_000)} min.`,
        );
      }
      throw new BadRequestException('Code invalide ou expiré.');
    }

    await this.prisma.$transaction([
      this.prisma.adminLoginOtp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.adminVerifiedSession.upsert({
        where: { adminId_sessionId: { adminId: admin.id, sessionId } },
        create: {
          adminId: admin.id,
          sessionId,
          expiresAt: new Date(Date.now() + ADMIN_SESSION_VERIFIED_TTL_MS),
        },
        update: {
          verifiedAt: new Date(),
          expiresAt: new Date(Date.now() + ADMIN_SESSION_VERIFIED_TTL_MS),
        },
      }),
      this.prisma.user.update({
        where: { id: admin.id },
        data: { adminOtpFailedAttempts: 0, adminOtpLockedUntil: null },
      }),
    ]);

    return { verified: true };
  }

  async isAdminLoginSessionVerified(
    adminId: string,
    sessionId: string | undefined,
  ): Promise<boolean> {
    if (!sessionId) return false;
    const row = await this.prisma.adminVerifiedSession.findUnique({
      where: { adminId_sessionId: { adminId, sessionId } },
    });
    return !!row && row.expiresAt > new Date();
  }

  // Purge quotidienne des codes OTP admin et sessions vérifiées expirés —
  // pur ménage (aucune des deux tables n'est jamais lue par date, seulement
  // par adminId/sessionId + comparaison à `now`), pour ne pas laisser
  // grossir indéfiniment ces tables sur une plateforme censée tourner des
  // années.
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredAdminAuthRecords(): Promise<void> {
    const now = new Date();
    const [otps, sessions] = await Promise.all([
      this.prisma.adminLoginOtp.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { consumedAt: { not: null } }],
        },
      }),
      this.prisma.adminVerifiedSession.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
    ]);
    if (otps.count || sessions.count) {
      this.logger.log(
        `Purge 2FA admin : ${otps.count} code(s) OTP, ${sessions.count} session(s) vérifiée(s) expiré(s)`,
      );
    }
  }
}

const ADMIN_OTP_TTL_MS = 10 * 60 * 1000;
// Durée de vie d'une session admin validée — plafond de sécurité, calé sur
// la durée de vie habituelle d'une session Clerk ; en pratique, une
// nouvelle connexion (nouveau "sid") redemande de toute façon un code.
const ADMIN_SESSION_VERIFIED_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Anti-brute-force du code de connexion admin — indépendant du throttle par
// IP de la route (contournable en distribuant les requêtes sur plusieurs
// IP) : au-delà de ce nombre d'échecs consécutifs, verrouillage temporaire.
const ADMIN_OTP_MAX_ATTEMPTS = 5;
const ADMIN_OTP_LOCKOUT_MS = 15 * 60 * 1000;

function makeSalt(): string {
  return randomBytes(16).toString('hex');
}

function hashCode(code: string, salt: string): string {
  return scryptSync(code, salt, 64).toString('hex');
}

function safeEqual(candidateHex: string, expectedHex: string): boolean {
  const a = Buffer.from(candidateHex, 'hex');
  const b = Buffer.from(expectedHex, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
