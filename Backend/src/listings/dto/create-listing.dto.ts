import {
  IsEnum,
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
} from 'class-validator';
import { ListingStatus, ListingType } from '@prisma/client';
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

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price!: number;

  @IsEnum(ListingType)
  type!: ListingType;

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

  /** Tarif par nuit (optionnel — pour les séjours courts < 25 jours) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pricePerNight?: number;

  /** Durée minimum de séjour en nuits */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  minimumNights?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  /** DRAFT (défaut) ou ACTIVE pour publier directement à la création */
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}
