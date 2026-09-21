import { IsIn, IsString, Matches } from 'class-validator';

/** Confirmation PIN/OTP requise pour une action de configuration sans autre
 * payload (ex. annuler un changement tarifaire programmé). */
export class ConfirmActionDto {
  @IsIn(['PIN', 'OTP'])
  confirmMethod!: 'PIN' | 'OTP';

  @IsString()
  @Matches(/^[0-9]{4,8}$/)
  confirmCode!: string;
}
