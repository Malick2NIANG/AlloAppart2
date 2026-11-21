import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ListingType, RentalMode, TransactionType } from '@prisma/client';

const MAX_AMENITIES = 20;

export class WriteDescriptionDto {
  @IsIn(['fr', 'en'])
  locale!: 'fr' | 'en';

  @IsEnum(ListingType)
  type!: ListingType;

  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType;

  @IsOptional()
  @IsEnum(RentalMode)
  rentalMode?: RentalMode;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  @Type(() => Number)
  surface?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  rooms?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  beds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  baths?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_AMENITIES)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  amenities?: string[];

  @IsOptional()
  @IsBoolean()
  furnished?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pricePerNight?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  @Type(() => Number)
  depositMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  @Type(() => Number)
  minLeaseMonths?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cleaningFee?: number;

  @IsOptional()
  @IsBoolean()
  chargesIncluded?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  minimumNights?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  maximumNights?: number;
}

/** Limite partagée avec le validateur de amenities côté generateDescription (défense en profondeur). */
export { MAX_AMENITIES };
