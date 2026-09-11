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

  // ── Champs publics de la vitrine agence (page "Ma vitrine") — distincts de
  // bio/avatar/phone ci-dessus (profil personnel, utilisés pour le contact
  // direct sur une annonce). Cf. schema.prisma pour le raisonnement complet.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  agencyBio?: string;

  @IsOptional()
  @IsUrl()
  agencyAvatar?: string;

  @IsOptional()
  @IsPhoneNumber()
  agencyPhone?: string;

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
