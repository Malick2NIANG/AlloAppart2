import { IsOptional, IsUUID } from 'class-validator';

export class CreateRoomDto {
  @IsUUID() listingId!: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
