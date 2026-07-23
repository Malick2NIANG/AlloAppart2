import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeclineVerificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
