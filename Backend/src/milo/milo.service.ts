import { Injectable } from '@nestjs/common';
import { extractCriteria } from './extractCriteria';
import { detectLanguage } from './language/detectLanguage';
import { detectFaqIntent, type MiloFaqResult } from './faq/detectFaq';
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
  /** Milo FAQ (lot « Milo FAQ ») — présent uniquement quand la phrase est
   * une question sur la plateforme sans aucun critère de recherche de
   * logement. Un critère de recherche gagne toujours, même en cas de doute
   * (voir detectFaqIntent). */
  faq?: MiloFaqResult;
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

    const faq = detectFaqIntent(text, extraction.strictFilters);
    // Un sujet FAQ précis compte comme "compris" ; le sujet `unknown`
    // (question sans réponse identifiée) ne l'est pas — même sémantique
    // que pour une recherche : `understood` reflète si Milo a vraiment
    // reconnu quelque chose, jamais juste "ce n'est pas une recherche".
    const faqUnderstood = faq !== undefined && faq.id !== 'unknown';

    return {
      detectedLanguage: language.language,
      languageConfidence: language.confidence,
      languageMethod: language.method,
      strictFilters: extraction.strictFilters,
      softPreferences: extraction.softPreferences,
      unmatchedTokens: extraction.unmatchedTokens,
      ambiguities: extraction.ambiguities,
      understood: understood || faqUnderstood,
      ...(faq && { faq }),
    };
  }
}
