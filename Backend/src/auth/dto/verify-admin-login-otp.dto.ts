import { IsString, Matches } from 'class-validator';

export class VerifyAdminLoginOtpDto {
  @IsString()
  @Matches(/^[0-9]{6}$/)
  code!: string;
}
