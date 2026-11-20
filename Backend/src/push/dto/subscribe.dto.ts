import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
// Miroir de `Locale` (src/i18n/messages.ts) — pas de liste exportée là-bas.
const LOCALES = ['fr', 'en'] as const;

class PushKeysDto {
  @IsString() @IsNotEmpty() @MaxLength(200) p256dh!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) auth!: string;
}

/** Endpoint borné à 500 (même taille que la colonne) — toujours https, jamais
 * une autre origine que celle d'un service de push réel (validé par IsUrl). */
export class SubscribeDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;

  @IsOptional() @IsString() @MaxLength(200) userAgent?: string;

  @IsOptional() @IsIn(LOCALES) locale?: string;
}
