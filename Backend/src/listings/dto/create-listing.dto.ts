import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  Min,
} from 'class-validator';
import { ListingType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateListingDto {
  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price!: number;

  @IsEnum(ListingType)
  type!: ListingType;

  @IsNumber()
  @Type(() => Number)
  lat!: number;

  @IsNumber()
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
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}
