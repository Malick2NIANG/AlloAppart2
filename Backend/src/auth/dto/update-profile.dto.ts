import {
  IsIn,
  IsOptional,
  IsString,
  IsPhoneNumber,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { AGENCY_COLOR_KEYS } from '../agency-color-palette';

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

  /** Adresse affichée sur la vitrine — distincte de l'adresse des annonces. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  agencyAddress?: string;

  /** Clé de palette prédéfinie (cf. agency-color-palette.ts) — pas de hex libre. */
  @IsOptional()
  @IsIn(AGENCY_COLOR_KEYS)
  agencyColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  coverageZone?: string;

  // agencySlug n'est plus modifiable par l'agence — assigné automatiquement une
  // seule fois (cf. AuthService.generateUniqueAgencySlug), "Ma vitrine" reste
  // une page AlloAppart et non un nom de domaine à configurer soi-même.

  /** Langue de communication (emails, SMS, notifications). */
  @IsOptional()
  @IsIn(['fr', 'en'])
  locale?: 'fr' | 'en';
}
