import type { ListingType } from '@prisma/client';
import type { WriterInput } from './types';
import {
  AMENITY_LABEL_EN,
  AMENITY_LABEL_FR,
  TYPE_LABEL_EN,
  TYPE_LABEL_FR,
} from './dictionaries/labels';

export interface VerifyResult {
  ok: boolean;
  /** Raisons de l'échec (vide si ok) — jamais de donnée personnelle, sûr à journaliser. */
  reasons: string[];
}

/**
 * Mots/expressions jamais acceptés dans un texte généré, sauf exception
 * explicitement justifiée par un champ (cf. Milo.md § Writer — « Interdits
 * absolus »). Comparaison insensible à la casse et aux accents.
 */
const BANNED_FR: Array<{
  pattern: string;
  allowedIf?: (input: WriterInput) => boolean;
}> = [
  { pattern: 'calme' },
  { pattern: 'lumineux' },
  { pattern: 'lumineuse' },
  { pattern: 'proche de' },
  { pattern: 'securise' },
  { pattern: 'securisee' },
  { pattern: 'neuf' },
  { pattern: 'neuve' },
  { pattern: 'renove' },
  { pattern: 'renovee' },
  { pattern: 'ideal pour' },
  { pattern: 'ideale pour' },
  { pattern: 'sans frais' },
  {
    pattern: 'titre foncier',
    allowedIf: (i) => (i.amenities ?? []).includes('titre_foncier'),
  },
  { pattern: 'meilleur' },
  { pattern: 'meilleure' },
  { pattern: 'exceptionnel' },
  { pattern: 'exceptionnelle' },
  { pattern: 'incroyable' },
  { pattern: 'unique' },
  { pattern: 'parfait' },
  { pattern: 'parfaite' },
  { pattern: 'sublime' },
  { pattern: 'extraordinaire' },
  { pattern: 'excellent' },
  { pattern: 'excellente' },
  { pattern: 'superbe' },
  { pattern: 'magnifique' },
];

const BANNED_EN: Array<{
  pattern: string;
  allowedIf?: (input: WriterInput) => boolean;
}> = [
  { pattern: 'quiet' },
  { pattern: 'bright' },
  { pattern: 'close to' },
  { pattern: 'near the' },
  { pattern: 'secure' },
  { pattern: 'secured' },
  { pattern: 'brand new' },
  { pattern: 'renovated' },
  { pattern: 'ideal for' },
  { pattern: 'free of charge' },
  { pattern: 'no fees' },
  {
    pattern: 'land title',
    allowedIf: (i) => (i.amenities ?? []).includes('titre_foncier'),
  },
  { pattern: 'best' },
  { pattern: 'exceptional' },
  { pattern: 'incredible' },
  { pattern: 'unique' },
  { pattern: 'perfect' },
  { pattern: 'stunning' },
  { pattern: 'extraordinary' },
  { pattern: 'excellent' },
  { pattern: 'superb' },
  { pattern: 'gorgeous' },
  { pattern: 'amazing' },
];

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalize(s: string): string {
  return stripAccents(s.toLowerCase());
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Correspondance sur mot(s) entier(s) — jamais une simple sous-chaîne.
 * Indispensable : des libellés courts ('room', 'chambre'…) sont de vraies
 * sous-chaînes d'autres mots légitimes ('bedroom', 'chambres') qui n'ont
 * aucun rapport avec le type de bien ou l'équipement recherché. `text` et
 * `phrase` doivent déjà être passés par `normalize()`.
 */
function containsWord(text: string, phrase: string): boolean {
  return new RegExp(`\\b${escapeRegex(phrase)}\\b`).test(text);
}

/** Construit l'ensemble des nombres légitimement mentionnables, à partir des champs numériques. */
function allowedNumbers(input: WriterInput): Set<number> {
  const values = [
    input.surface !== undefined ? Math.round(input.surface) : undefined,
    input.rooms,
    input.beds,
    input.baths,
    input.price !== undefined ? Math.round(input.price) : undefined,
    input.pricePerNight !== undefined
      ? Math.round(input.pricePerNight)
      : undefined,
    input.depositMonths,
    input.minLeaseMonths,
    input.cleaningFee !== undefined ? Math.round(input.cleaningFee) : undefined,
    input.minimumNights,
    input.maximumNights,
  ];
  return new Set(values.filter((v): v is number => v !== undefined));
}

function extractNumbers(text: string): number[] {
  const matches = text.match(/\d[\d \u00A0]*\d|\d/g) ?? [];
  return matches.map((m) => Number(m.replace(/[ \u00A0]/g, '')));
}

export function verifyDescription(
  text: string,
  input: WriterInput,
): VerifyResult {
  const reasons: string[] = [];
  const normalizedText = normalize(text);

  // 1. Aucun nombre absent des champs.
  const allowed = allowedNumbers(input);
  for (const n of extractNumbers(text)) {
    if (!allowed.has(n)) reasons.push(`nombre non justifié : ${n}`);
  }

  // 2. Seuls les équipements cochés peuvent apparaître.
  const amenityLabels =
    input.locale === 'fr' ? AMENITY_LABEL_FR : AMENITY_LABEL_EN;
  const selected = new Set(input.amenities ?? []);
  for (const [key, label] of Object.entries(amenityLabels)) {
    if (containsWord(normalizedText, normalize(label)) && !selected.has(key)) {
      reasons.push(`équipement non coché mentionné : ${key}`);
    }
  }

  // 3. Le type mentionné (s'il y en a un) doit être celui du bien. Le
  // libellé du type CHAMBRE ('chambre'/'room') est un mot entier légitime
  // ailleurs : la phrase de décompte des chambres (FR, champ beds) ou des
  // pièces (EN, champ rooms) l'emploie aussi, au singulier comme au
  // pluriel — ex. « 1 chambre »/« 1 room ». containsWord() seul ne suffit
  // pas (ces mentions chiffrées SONT des mots entiers) : on les retire
  // d'abord (jamais le type lui-même, toujours précédé d'un déterminant
  // comme « cette »/« this », jamais d'un chiffre).
  const textForTypeCheck = normalizedText
    .replace(/\d+\s*chambres?/g, '')
    .replace(/\d+\s*rooms?/g, '');
  const typeLabels = input.locale === 'fr' ? TYPE_LABEL_FR : TYPE_LABEL_EN;
  for (const [type, label] of Object.entries(typeLabels) as Array<
    [ListingType, string]
  >) {
    if (type === input.type) continue;
    if (containsWord(textForTypeCheck, normalize(label))) {
      reasons.push(`type de bien incohérent mentionné : ${type}`);
    }
  }

  // 4. Ameublement : seulement si le champ est renseigné.
  const furnishedWordsFr = ['meuble', 'meublee'];
  const furnishedWordsEn = ['furnished', 'unfurnished'];
  const mentionsFurnished = (
    input.locale === 'fr' ? furnishedWordsFr : furnishedWordsEn
  ).some((w) => containsWord(normalizedText, normalize(w)));
  if (mentionsFurnished && input.furnished === undefined) {
    reasons.push('ameublement mentionné sans champ furnished');
  }

  // 5. Ville/région : jamais un lieu absent des champs — la génération ne
  // peut de toute façon produire un lieu non fourni (aucune recherche
  // supplémentaire ici : un gazetteer complet serait hors périmètre et
  // source de faux-négatifs sur des mots communs).

  // 6. Mots interdits (sauf exception justifiée par un champ).
  const banned = input.locale === 'fr' ? BANNED_FR : BANNED_EN;
  for (const { pattern, allowedIf } of banned) {
    if (containsWord(normalizedText, normalize(pattern))) {
      if (allowedIf?.(input)) continue;
      reasons.push(`mot interdit : ${pattern}`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}
