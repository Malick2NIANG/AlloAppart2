import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ListingStatus, ListingType, RentalMode } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateListingDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  description!: string;

  /**
   * Tarif mensuel (référence principale). Requis pour MONTHLY/MIXED — pour
   * NIGHTLY seul, le service le calcule automatiquement (pricePerNight × 30)
   * si absent, car le champ n'a pas de sens à faire remplir par le bailleur.
   */
  @ValidateIf((o: CreateListingDto) => o.rentalMode !== RentalMode.NIGHTLY)
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price!: number;

  @IsEnum(ListingType)
  type!: ListingType;

  /** Mode de location proposé par le bailleur : nuitée, mensuel, ou les deux */
  @IsEnum(RentalMode)
  rentalMode!: RentalMode;

  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  lng!: number;

  @IsNotEmpty()
  @IsString()
  city!: string;

  @IsNotEmpty()
  @IsString()
  region!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  rooms?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  beds?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  baths?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  surface?: number;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  @Matches(/^https:\/\/res\.cloudinary\.com\//, {
    each: true,
    message: 'Images must be hosted on Cloudinary',
  })
  images?: string[];

  /** Tarif par nuit — requis en mode NIGHTLY ou MIXED */
  @ValidateIf(
    (o: CreateListingDto) =>
      o.rentalMode === RentalMode.NIGHTLY || o.rentalMode === RentalMode.MIXED,
  )
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pricePerNight?: number;

  /** Durée minimum de séjour en nuits (mode NIGHTLY ou MIXED) */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  minimumNights?: number;

  /**
   * Séjour maximum en nuits — optionnel, mode NIGHTLY uniquement. Passé ce
   * nombre de nuits, la réservation nuitée est refusée (pas d'alternative
   * mensuelle sur une annonce NIGHTLY pure, contrairement au mode MIXTE).
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maximumNights?: number;

  /** Frais de ménage fixes (mode NIGHTLY ou MIXED) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cleaningFee?: number;

  /** Caution exprimée en nombre de mois de loyer — requis en mode MONTHLY ou MIXED */
  @ValidateIf(
    (o: CreateListingDto) =>
      o.rentalMode === RentalMode.MONTHLY || o.rentalMode === RentalMode.MIXED,
  )
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  depositMonths?: number;

  /** Charges (eau/électricité) incluses dans le loyer mensuel ou non */
  @IsOptional()
  @IsBoolean()
  chargesIncluded?: boolean;

  /**
   * Durée minimale de bail en mois. Optionnelle en mode MONTHLY (information
   * pour le locataire), mais requise en mode MIXED : c'est ce nombre de mois
   * (converti en jours) qui délimite le seuil nuitée/mensuel — en dessous, le
   * séjour reste facturé au tarif nuitée, au-delà il bascule vers la demande
   * de location au mois (caution). Voir bookings.service.ts#create.
   */
  @ValidateIf((o: CreateListingDto) => o.rentalMode === RentalMode.MIXED)
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  minLeaseMonths?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  /** DRAFT (défaut) ou ACTIVE pour publier directement à la création */
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}
