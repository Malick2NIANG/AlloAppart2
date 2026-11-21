import type { ListingType, RentalMode, TransactionType } from '@prisma/client';

export type WriterLocale = 'fr' | 'en';

/**
 * Entrée du générateur : uniquement des champs déjà saisis dans le
 * formulaire (undefined = absent, jamais mentionné dans le texte). Pas de
 * titre, pas d'adresse exacte, pas de lat/lng — jamais de donnée
 * personnelle ni de détail de quartier non choisi explicitement (cf.
 * Milo.md § Writer).
 */
export interface WriterInput {
  locale: WriterLocale;
  type: ListingType;
  transactionType?: TransactionType;
  rentalMode?: RentalMode;
  city?: string;
  region?: string;
  surface?: number;
  rooms?: number;
  beds?: number;
  baths?: number;
  amenities?: string[];
  furnished?: boolean;
  price?: number;
  pricePerNight?: number;
  depositMonths?: number;
  minLeaseMonths?: number;
  cleaningFee?: number;
  chargesIncluded?: boolean;
  minimumNights?: number;
  maximumNights?: number;
}

export interface WriterResult {
  text: string;
  /** true si le texte a dû être replié sur la version minimale sûre. */
  fallback: boolean;
}
