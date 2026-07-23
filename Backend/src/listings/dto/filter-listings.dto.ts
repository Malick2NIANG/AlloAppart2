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
import { ListingType } from '@prisma/client';
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

  @IsOptional()
  @IsEnum(ListingType)
  type?: ListingType;

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
}
