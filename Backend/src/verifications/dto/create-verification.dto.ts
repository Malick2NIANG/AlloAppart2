import { AuditType } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateVerificationDto {
  @IsUUID()
  @IsNotEmpty()
  listingId!: string;

  @IsEnum(AuditType)
  auditType!: AuditType;

  @IsDateString()
  scheduledAt!: string;
}
