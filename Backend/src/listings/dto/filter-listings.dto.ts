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
import { ListingType, TransactionType } from '@prisma/client';
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
}
