import { IsEnum, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Milo Search v0 — lot 4 (endpoint). `text` vide ou fait uniquement
 * d'espaces est VALIDE (200, `understood: false`) — seuls un champ
 * manquant, un mauvais type, ou plus de 300 caractères déclenchent un 400
 * (ValidationPipe global : whitelist + forbidNonWhitelisted + transform).
 */
export class ParseQueryDto {
  @IsString()
  @MaxLength(300)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  text!: string;

  @IsEnum(['fr', 'en'])
  defaultLocale!: 'fr' | 'en';
}
