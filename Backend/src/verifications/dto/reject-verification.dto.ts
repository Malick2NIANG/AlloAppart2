import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectVerificationDto {
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
