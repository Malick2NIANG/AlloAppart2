import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsString,
  IsArray,
  Max,
  Min,
} from 'class-validator';
import { ListingType, RentalMode, TransactionType } from '@prisma/client';
import { Type, Transform } from 'class-transformer';

export type OwnerType = 'PARTICULIER' | 'AGENCE';

export class FilterListingsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  city?: string;

  /** Filtre tolérant (Milo, lot 2b) : city contient la valeur, insensible à
   * la casse et aux accents. N'affecte jamais `city` (égalité exacte,
   * inchangée pour le PC) — un filtre en plus, jamais à la place. */
  @IsOptional()
  @IsString()
  cityContains?: string;

  @IsOptional()
  @IsEnum(ListingType)
  type?: ListingType;

  /** Location ou vente directe — absent = les deux. */
  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxPrice?: number;

  @IsOptional()
  @Transform(({ value }: { value: string }) => value === 'true')
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minRooms?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxRooms?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minBeds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxBeds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minSurface?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxSurface?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: string | string[] }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  amenities?: string[];

  @IsOptional()
  @IsEnum(['PARTICULIER', 'AGENCE'])
  ownerType?: OwnerType;

  /** Préférences floues (Milo, lot 6a) : CLASSENT les résultats, n'en
   * excluent jamais — pas de @IsEnum ici volontairement : une valeur
   * inconnue doit être ignorée silencieusement (ListingsService), pas
   * rejetée en 400 (contrairement aux autres enums de ce DTO). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: string | string[] }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  prefs?: string[];

  /** true/false seulement — une annonce `furnished: null` (non précisé)
   * est toujours exclue quand ce filtre est actif (ni meublé ni non
   * meublé, le filtre n'a pas de réponse pour elle). */
  @IsOptional()
  @Transform(({ value }: { value: string }) => value === 'true')
  @IsBoolean()
  furnished?: boolean;

  /** NIGHTLY inclut aussi les annonces MIXED (proposent les deux) ; même
   * principe pour MONTHLY. Absent = tous les modes. */
  @IsOptional()
  @IsEnum(RentalMode)
  rentalMode?: RentalMode;

  /** Porte sur `pricePerNight`, jamais sur `price` (mensuel) — n'importe
   * que pour les annonces NIGHTLY/MIXED (les annonces MONTHLY seules ont
   * `pricePerNight: null`, naturellement exclues par ce filtre). */
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minPricePerNight?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxPricePerNight?: number;

  /** « Près de moi » (lot « raccourci ») — position de l'utilisateur,
   * reçue uniquement pour trier/filtrer CETTE requête : jamais journalisée,
   * jamais enregistrée en base, jamais transmise à un outil d'analytics
   * (cf. ListingsService.findAll, aucun log ne doit jamais inclure ces deux
   * champs). Rayon optionnel, borné 1 à 50 km. */
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  lng?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  radiusKm?: number;
}
