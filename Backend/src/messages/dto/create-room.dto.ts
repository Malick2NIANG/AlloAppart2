import { IsUUID } from 'class-validator';

export class CreateRoomDto {
  @IsUUID() listingId!: string;
}
