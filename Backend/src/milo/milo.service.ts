import { Injectable } from '@nestjs/common';
import { extractCriteria } from './extractCriteria';
import { detectLanguage } from './language/detectLanguage';
import type { ParseQueryDto } from './dto/parse-query.dto';
import type {
  DetectedLanguage,
  DetectionMethod,
} from './language/detectLanguage';
import type { MiloAmbiguity, MiloStrictFilters } from './types';

export interface ParseQueryResponse {
  detectedLanguage: DetectedLanguage;
  languageConfidence: number;
  languageMethod: DetectionMethod;
  strictFilters: MiloStrictFilters;
  softPreferences: string[];
  unmatchedTokens: string[];
  ambiguities: MiloAmbiguity[];
  understood: boolean;
}

@Injectable()
export class MiloService {
  /**
   * Aucune journalisation du texte ici (vie privée — un texte peut contenir
   * un numéro de téléphone, cf. rapport du lot 4). `text` vide/espaces
   * seulement n'est pas un cas spécial : le pipeline d'extraction et la
   * détection de langue gèrent déjà nativement une entrée vide
   * (`strictFilters: {}`, `understood: false`).
   */
  parseQuery(dto: ParseQueryDto): ParseQueryResponse {
    const { text, defaultLocale } = dto;
    const extraction = extractCriteria(text);
    const language = detectLanguage(text, defaultLocale);

    const understood =
      Object.keys(extraction.strictFilters).length > 0 ||
      extraction.softPreferences.length > 0;

    return {
      detectedLanguage: language.language,
      languageConfidence: language.confidence,
      languageMethod: language.method,
      strictFilters: extraction.strictFilters,
      softPreferences: extraction.softPreferences,
      unmatchedTokens: extraction.unmatchedTokens,
      ambiguities: extraction.ambiguities,
      understood,
    };
  }
}
