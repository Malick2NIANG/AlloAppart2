import { IsIn, IsString, Matches } from 'class-validator';

export class ChangePinDto {
  /** Méthode utilisée pour confirmer l'identité avant de changer le PIN. */
  @IsIn(['PIN', 'OTP'])
  confirmMethod!: 'PIN' | 'OTP';

  /** Code PIN actuel ou code reçu par email, selon confirmMethod. */
  @IsString()
  @Matches(/^[0-9]{4,8}$/)
  confirmCode!: string;

  /** Nouveau code PIN (4 à 8 chiffres). */
  @IsString()
  @Matches(/^[0-9]{4,8}$/)
  newPin!: string;
}
