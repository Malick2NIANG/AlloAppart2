import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListingStatus, Role } from '@prisma/client';

const AGENCY_PUBLIC_SELECT = {
  id:          true,
  firstName:   true,
  lastName:    true,
  agencyName:  true,
  agencySlug:  true,
  // Champs dédiés à la vitrine publique (page "Ma vitrine"), distincts de
  // avatar/bio/phone (profil personnel) — voir schema.prisma. Les personnels
  // restent sélectionnés en repli tant qu'une agence n'a pas renseigné les
  // champs vitrine (agences déjà existantes avant cette migration).
  avatar:      true,
  bio:         true,
  phone:       true,
  agencyAvatar: true,
  agencyBio:   true,
  agencyPhone: true,
  createdAt:   true,
  roles:       true,
  isSuspended: true,
  subscription: {
    select: { plan: true, status: true },
  },
  _count: {
    select: {
      listings: { where: { status: ListingStatus.ACTIVE } },
    },
  },
} as const;

const LISTING_PUBLIC_SELECT = {
  id:        true,
  title:     true,
  price:     true,
  type:      true,
  city:      true,
  region:    true,
  address:   true,
  images:    true,
  rooms:     true,
  surface:   true,
  beds:      true,
  baths:     true,
  boostUntil: true,
  boostScore: true,
  isVerified: true,
  createdAt:  true,
} as const;

@Injectable()
export class AgencesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Résout les champs vitrine (agencyBio/agencyAvatar/agencyPhone, saisis
   * depuis "Ma vitrine") en priorité, avec repli sur bio/avatar/phone
   * (profil personnel) — utile pour les agences créées avant l'ajout de ces
   * champs dédiés et qui n'ont pas encore rempli leur vitrine. Le contrat
   * public (bio/avatar/phone) reste inchangé pour ne pas casser le frontend
   * existant ; les champs bruts agencyX ne sont jamais exposés tels quels.
   */
  private resolveVitrineFields<
    T extends { agencyBio: string | null; agencyAvatar: string | null; agencyPhone: string | null; bio: string | null; avatar: string | null; phone: string | null },
  >(agency: T) {
    const { agencyBio, agencyAvatar, agencyPhone, ...rest } = agency;
    return {
      ...rest,
      bio: agencyBio ?? agency.bio,
      avatar: agencyAvatar ?? agency.avatar,
      phone: agencyPhone ?? agency.phone,
    };
  }

  /** Liste publique de toutes les agences actives, triées par plan puis par date */
  async findAll() {
    const agencies = await this.prisma.user.findMany({
      where: {
        roles: { has: Role.PRO_AGENCE },
        isSuspended: false,
        // N'afficher que les agences qui ont au moins une annonce active
        listings: { some: { status: ListingStatus.ACTIVE } },
      },
      select: AGENCY_PUBLIC_SELECT,
      orderBy: { createdAt: 'asc' },
    });

    // Tri : abonnement PRO > STARTER > sans abonnement
    return agencies
      .sort((a, b) => {
        const planScore = (sub: typeof a.subscription) => {
          if (!sub || sub.status !== 'ACTIVE') return 0;
          return sub.plan === 'PRO' ? 2 : 1;
        };
        return planScore(b.subscription) - planScore(a.subscription);
      })
      .map((a) => this.resolveVitrineFields(a));
  }

  /** Profil public d'une agence + ses annonces actives */
  async findBySlug(slug: string) {
    const agency = await this.prisma.user.findUnique({
      where: { agencySlug: slug },
      select: {
        ...AGENCY_PUBLIC_SELECT,
        listings: {
          where: { status: ListingStatus.ACTIVE },
          select: LISTING_PUBLIC_SELECT,
          orderBy: [
            { boostScore: 'desc' },
            { createdAt:  'desc' },
          ],
        },
      },
    });

    if (!agency || !agency.roles?.includes(Role.PRO_AGENCE) || agency.isSuspended) {
      throw new NotFoundException('Agency not found.');
    }

    return this.resolveVitrineFields(agency);
  }

  /** Incrémente le compteur de vues de la vitrine */
  async incrementProfileViews(slug: string) {
    await this.prisma.user.updateMany({
      where: { agencySlug: slug },
      data: { profileViews: { increment: 1 } },
    });
  }

  /** Vérifie la disponibilité d'un slug (route publique) */
  async checkSlug(slug: string, excludeUserId?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { agencySlug: slug },
      select: { id: true },
    });
    const available = !existing || existing.id === excludeUserId;
    return { slug, available };
  }
}
