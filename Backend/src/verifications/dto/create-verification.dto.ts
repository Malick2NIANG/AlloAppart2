import { AuditType } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateVerificationDto {
  @IsUUID()
  @IsNotEmpty()
  listingId!: string;

  @IsEnum(AuditType)
  auditType!: AuditType;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsUUID()
  preferredAgentId?: string;
}
