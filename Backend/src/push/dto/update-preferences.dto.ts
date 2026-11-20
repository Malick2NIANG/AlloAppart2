import { IsBoolean, IsOptional } from 'class-validator';

/** Les 4 catégories de NotificationPreference — toutes optionnelles, seules
 * celles envoyées sont modifiées (préférences existantes sinon inchangées). */
export class UpdatePreferencesDto {
  @IsOptional() @IsBoolean() messages?: boolean;
  @IsOptional() @IsBoolean() bookings?: boolean;
  @IsOptional() @IsBoolean() payments?: boolean;
  @IsOptional() @IsBoolean() listings?: boolean;
}
