import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpdatePlatformConfigDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  starterPriceFcfa?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  proPriceFcfaMonthly?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  nightlyCommissionRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyCommissionMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  auditBasicPriceFcfa?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  boostPriceFcfa?: number;

  /** Méthode de confirmation choisie par l'admin pour valider ce changement. */
  @IsIn(['PIN', 'OTP'])
  confirmMethod!: 'PIN' | 'OTP';

  /** Code PIN (si confirmMethod === 'PIN') ou code reçu par email (si 'OTP'). */
  @IsString()
  @Matches(/^[0-9]{4,8}$/)
  confirmCode!: string;

  /**
   * Délai (en jours) avant l'entrée en vigueur — préavis CGU Article 7
   * (30 jours par défaut si omis). 0 = application immédiate, à réserver aux
   * corrections urgentes (ex. erreur de saisie).
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  effectiveInDays?: number;
}
