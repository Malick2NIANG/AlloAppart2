import { PartialType } from '@nestjs/mapped-types';
import { CreateListingDto } from './create-listing.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ListingStatus } from '@prisma/client';

export class UpdateListingDto extends PartialType(CreateListingDto) {
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}
