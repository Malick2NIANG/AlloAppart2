import {
  IsIn,
  IsOptional,
  IsString,
  IsPhoneNumber,
  IsUrl,
  MaxLength,
  Matches,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  /** Nom commercial de l'agence — affiché sur sa vitrine publique (/agences/:slug). */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  agencyName?: string;

  @IsOptional()
  @IsUrl()
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  coverageZone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Le slug ne peut contenir que des lettres minuscules, chiffres et tirets (ex: immobilier-dakar)',
  })
  agencySlug?: string;

  /** Langue de communication (emails, SMS, notifications). */
  @IsOptional()
  @IsIn(['fr', 'en'])
  locale?: 'fr' | 'en';
}
