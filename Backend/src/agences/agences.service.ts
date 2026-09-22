import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, ListingStatus, Role } from '@prisma/client';

// Statuts de réservation considérés comme une relation commerciale réelle
// entre le locataire et le bailleur/agence — condition d'accès au vrai
// numéro de téléphone (Task #120 : anti-contournement/désintermédiation).
const QUALIFYING_BOOKING_STATUSES = [
  BookingStatus.CONFIRMED,
  BookingStatus.ACTIVE,
  BookingStatus.COMPLETED,
];

const AGENCY_PUBLIC_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  agencyName: true,
  agencySlug: true,
  // Champs dédiés à la vitrine publique (page "Ma vitrine"), distincts de
  // avatar/bio (profil personnel) — voir schema.prisma. Les personnels
  // restent sélectionnés en repli tant qu'une agence n'a pas renseigné les
  // champs vitrine (agences déjà existantes avant cette migration).
  //
  // Le téléphone (phone/agencyPhone) est délibérément ABSENT de ce select :
  // avant toute réservation confirmée, le numéro ne doit pas être exposé sur
  // les routes publiques (findAll/findBySlug). Il n'est révélé qu'via
  // getPhoneForViewer(), après vérification d'une réservation qualifiante
  // (Task #120).
  avatar: true,
  bio: true,
  agencyAvatar: true,
  agencyBio: true,
  agencyAddress: true,
  agencyColor: true,
  createdAt: true,
  roles: true,
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
  id: true,
  title: true,
  price: true,
  // Nécessaires pour afficher le bon tarif (nuitée/mensuel/les deux) sur la
  // vitrine — `price` seul peut être un équivalent mensuel dérivé pour une
  // annonce NIGHTLY (cf. resolveMonthlyPrice, listings.service.ts).
  rentalMode: true,
  pricePerNight: true,
  type: true,
  city: true,
  region: true,
  address: true,
  images: true,
  rooms: true,
  surface: true,
  beds: true,
  baths: true,
  boostUntil: true,
  boostScore: true,
  isVerified: true,
  createdAt: true,
} as const;

@Injectable()
export class AgencesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Résout les champs vitrine (agencyBio/agencyAvatar, saisis depuis "Ma
   * vitrine") en priorité, avec repli sur bio/avatar (profil personnel) —
   * utile pour les agences créées avant l'ajout de ces champs dédiés et qui
   * n'ont pas encore rempli leur vitrine. Le téléphone n'est plus résolu ici
   * du tout : voir la note sur AGENCY_PUBLIC_SELECT et getPhoneForViewer().
   */
  private resolveVitrineFields<
    T extends {
      agencyBio: string | null;
      agencyAvatar: string | null;
      bio: string | null;
      avatar: string | null;
    },
  >(agency: T) {
    const { agencyBio, agencyAvatar, ...rest } = agency;
    return {
      ...rest,
      bio: agencyBio ?? agency.bio,
      avatar: agencyAvatar ?? agency.avatar,
    };
  }

  /**
   * Révèle le vrai numéro de téléphone du bailleur/agence à un visiteur
   * connecté, mais seulement s'il a une réservation qualifiante (CONFIRMED/
   * ACTIVE/COMPLETED) sur au moins une annonce de cette agence. Sinon,
   * renvoie `null` — le frontend affiche alors un CTA "Contacter via la
   * messagerie" à la place. Route protégée par l'auth standard (pas
   * `@Public()`) : un visiteur non connecté ne peut par définition avoir
   * aucune réservation, donc n'a jamais accès à cet endpoint.
   */
  async getPhoneForViewer(
    slug: string,
    viewerId: string,
  ): Promise<{ phone: string | null }> {
    const agency = await this.prisma.user.findUnique({
      where: { agencySlug: slug },
      select: {
        id: true,
        phone: true,
        agencyPhone: true,
        roles: true,
        isSuspended: true,
      },
    });

    if (
      !agency ||
      !agency.roles?.includes(Role.PRO_AGENCE) ||
      agency.isSuspended
    ) {
      throw new NotFoundException('Agency not found.');
    }

    const qualifyingBooking = await this.prisma.booking.findFirst({
      where: {
        tenantId: viewerId,
        status: { in: QUALIFYING_BOOKING_STATUSES },
        listing: { ownerId: agency.id },
      },
      select: { id: true },
    });

    if (!qualifyingBooking) return { phone: null };
    return { phone: agency.agencyPhone ?? agency.phone ?? null };
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
          orderBy: [{ boostScore: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (
      !agency ||
      !agency.roles?.includes(Role.PRO_AGENCE) ||
      agency.isSuspended
    ) {
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
}
