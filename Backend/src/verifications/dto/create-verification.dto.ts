import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateVerificationDto {
  @IsUUID()
  @IsNotEmpty()
  listingId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsUUID()
  preferredAgentId?: string;
}
