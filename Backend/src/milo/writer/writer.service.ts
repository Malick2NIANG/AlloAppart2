import { Injectable, Logger } from '@nestjs/common';
import { generateDescription } from './generateDescription';
import { verifyDescription } from './verifyDescription';
import type { WriterInput, WriterResult } from './types';

@Injectable()
export class WriterService {
  private readonly logger = new Logger(WriterService.name);

  /**
   * Génère une description, la vérifie contre les champs, et replie sur une
   * version minimale sûre en cas d'échec du contrôle (cf. Milo.md § Writer).
   * Ne journalise jamais de donnée personnelle — uniquement le type de bien
   * et les raisons techniques de l'échec.
   */
  write(input: WriterInput): WriterResult {
    const text = generateDescription(input);
    const check = verifyDescription(text, input);
    if (check.ok) return { text, fallback: false };

    this.logger.warn(
      `Contrôle anti-invention échoué (type=${input.type}, locale=${input.locale}) : ${check.reasons.join('; ')}`,
    );

    // Repli 1 — mêmes champs sans équipements ni ameublement (sources les
    // plus probables d'un mot interdit via un futur gabarit).
    const minimal: WriterInput = {
      ...input,
      amenities: undefined,
      furnished: undefined,
    };
    const fallbackText = generateDescription(minimal);
    const fallbackCheck = verifyDescription(fallbackText, minimal);
    if (fallbackCheck.ok) return { text: fallbackText, fallback: true };

    this.logger.warn(
      `Repli minimal également en échec (type=${input.type}, locale=${input.locale}) : ${fallbackCheck.reasons.join('; ')} — repli ultime sans aucun champ numérique.`,
    );

    // Repli 2 (ultime) — type + lieu uniquement, aucun nombre, ne peut pas
    // échouer le contrôle (aucun champ numérique ni équipement à vérifier).
    const bare: WriterInput = {
      locale: input.locale,
      type: input.type,
      transactionType: input.transactionType,
      rentalMode: input.rentalMode,
      city: input.city,
      region: input.region,
    };
    return { text: generateDescription(bare), fallback: true };
  }
}
