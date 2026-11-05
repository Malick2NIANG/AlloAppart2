import type { Token } from '../tokenize';
import type { MiloMatchedSpan } from '../types';

/**
 * Numéros de téléphone (lot 7 ter, règle 2) — jamais un prix, des pièces
 * ni des chambres. Indépendant de la langue (comme `places.ts`), lancé
 * AVANT le reste du pipeline pour que ses tokens soient déjà `consumed`
 * quand price.ts/roomsAndBeds.ts tournent (règle 7, même principe que les
 * lieux).
 */
export interface PhoneExtraction {
  consumed: Set<number>;
  matchedSpans: MiloMatchedSpan[];
}

/** "numéro"/"tél"/"tel."/"whatsapp" perdent accent/point à la
 * normalisation/tokenisation — une seule forme ("tel") couvre les deux. */
const PHONE_KEYWORDS = [
  'numero',
  'tel',
  'whatsapp',
  'wa',
  'contact',
  'appelez',
  'call',
  'phone',
  'joignable',
];

/** Un token "chiffre" au sens large : un nombre nu, un préfixe "+221", ou
 * une forme collée avec points/tirets internes ("77.123.45.67",
 * "77-123-45-67") — jamais de virgule (déjà réservée aux montants
 * anglo-saxons "12,000,000", traités ailleurs, jamais un téléphone). */
function isDigitToken(t: Token | undefined): boolean {
  return !!t && /^\+?\d+([.-]\d+)*$/.test(t.raw);
}

/** Les groupes de chiffres d'un token (découpé sur "." et "-" internes —
 * tokenize ne les sépare jamais en tokens distincts, ils restent collés). */
function digitGroups(raw: string): string[] {
  return raw.replace(/^\+/, '').split(/[.-]/).filter(Boolean);
}

/** Un regroupement n'est un séparateur de milliers que s'il respecte
 * STRICTEMENT 1 à 3 chiffres puis des groupes de 3 (règle 2 explicite :
 * "15 000", "1 500 000", "12.000.000" — jamais "77 123 45 67", groupes de
 * 2). Dans ce cas, jamais un téléphone (même si ≥ 7 chiffres au total). */
function isStrictThousandsGrouping(groups: string[]): boolean {
  if (groups.length === 0 || !/^\d{1,3}$/.test(groups[0])) return false;
  for (let i = 1; i < groups.length; i++) {
    if (!/^\d{3}$/.test(groups[i])) return false;
  }
  return true;
}

export function extractPhoneNumbers(tokens: Token[]): PhoneExtraction {
  const consumed = new Set<number>();
  const matchedSpans: MiloMatchedSpan[] = [];

  const spanText = (from: number, to: number) =>
    tokens
      .slice(from, to)
      .map((t) => t.raw)
      .join(' ');

  for (let i = 0; i < tokens.length; i++) {
    if (consumed.has(i)) continue;

    // Mot-clé téléphone suivi de chiffres : toujours un téléphone, quel
    // que soit le nombre de chiffres (règle 2 explicite). Une virgule/point
    // juste après (perdue à la tokenisation, retenue via `brokenAfter`)
    // arrête la consommation : "tel 77.123.45.67, 3 chambres" ne doit pas
    // happer le "3" d'une clause sans rapport (lot 7 ter, bug découvert
    // sur ce cas réel).
    if (PHONE_KEYWORDS.includes(tokens[i].raw)) {
      let j = i + 1;
      while (isDigitToken(tokens[j]) && !tokens[j - 1]?.brokenAfter) j++;
      if (j > i + 1) {
        for (let k = i; k < j; k++) consumed.add(k);
        matchedSpans.push({
          category: 'phone',
          text: spanText(i, j),
          value: 'phone',
        });
        i = j - 1;
        continue;
      }
    }

    if (!isDigitToken(tokens[i])) continue;

    // "budget" (mot-clé de prix FR/EN, présent dans les deux dictionnaires)
    // juste avant annule toute détection de téléphone pour ce nombre, même
    // nu et collé : un montant explicitement annoncé par un mot-clé de
    // budget l'emporte toujours (règle 2 explicite, "ne perds jamais le
    // montant explicite à cause d'un nombre parasite") — bug découvert sur
    // "budget 900000000" (9 chiffres nus, happé à tort comme téléphone).
    if (tokens[i - 1]?.raw === 'budget') continue;

    // Suite de tokens "chiffres" consécutifs (séparés par des espaces) —
    // même garde-fou sur la rupture de clause que ci-dessus.
    let j = i;
    const groups: string[] = [];
    while (isDigitToken(tokens[j]) && !(j > i && tokens[j - 1]?.brokenAfter)) {
      groups.push(...digitGroups(tokens[j].raw));
      j++;
    }
    const totalDigits = groups.reduce((n, g) => n + g.length, 0);
    const glued = j === i + 1;

    // `groups.length > 1` requis : un groupe UNIQUE (pas de séparateur du
    // tout, "1200000") échoue trivialement la règle "1 à 3 chiffres" dès
    // qu'il dépasse 3 chiffres, ce qui le faisait happer à tort comme
    // téléphone — bug découvert sur "villa 5 hectares minimum, 1200000"
    // (montant bare plausible, 7 chiffres, aucun séparateur). Un groupe
    // unique suit sa propre règle ci-dessous (`phoneByGluedLength`).
    const phoneByShape =
      groups.length > 1 &&
      !isStrictThousandsGrouping(groups) &&
      totalDigits >= 7;
    // Jeton unique nu, sans séparateur : seuil plus haut (9+ chiffres,
    // format sénégalais local 9 chiffres / international 12) pour ne
    // jamais happer un montant bare plausible ("2500000" = 7 chiffres,
    // 2,5 millions — décision prise seul, hors des formats explicitement
    // groupés/préfixés listés par la tâche).
    const phoneByGluedLength =
      glued && groups.length === 1 && groups[0].length >= 9;

    if (phoneByShape || phoneByGluedLength) {
      for (let k = i; k < j; k++) consumed.add(k);
      matchedSpans.push({
        category: 'phone',
        text: spanText(i, j),
        value: 'phone',
      });
      i = j - 1;
    }
  }

  return { consumed, matchedSpans };
}
