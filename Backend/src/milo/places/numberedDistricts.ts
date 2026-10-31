/**
 * Quartiers numérotés (Liberté 5, HLM 3, Sicap Liberté IV…) — lot 7, règle
 * 1.c. Le numéro fait partie du NOM du lieu, jamais un mot non compris
 * séparé ; le cityContains vise le nom complet si le numéro précis est
 * connu (bases ci-dessous), sinon le nom SANS numéro + ambiguïté
 * "numberedDistrict" (ex. Parcelles Assainies : 1 à 26+ unités, aucune
 * liste fiable — toujours le nom seul).
 */
export interface NumberedDistrictBase {
  /** Base normalisée (minuscules, sans accent), un ou plusieurs mots. */
  base: string;
  /** Nom canonique affiché (accents conservés), sans le numéro. */
  canonicalBase: string;
  region: string;
  /** Numéros dont la graphie complète ("Liberté 6") est connue/courante —
   * liste volontairement courte, jamais inventée au-delà de ce qui est
   * notoire (lot 7 : "mieux vaut ne pas extraire qu'extraire faux"). */
  knownNumbers: number[];
}

export const NUMBERED_DISTRICT_BASES: NumberedDistrictBase[] = [
  {
    base: 'liberte',
    canonicalBase: 'Liberté',
    region: 'Dakar',
    knownNumbers: [1, 2, 3, 4, 5, 6],
  },
  {
    base: 'hlm',
    canonicalBase: 'HLM',
    region: 'Dakar',
    knownNumbers: [1, 2, 3, 4, 5],
  },
  {
    base: 'sicap liberte',
    canonicalBase: 'Sicap Liberté',
    region: 'Dakar',
    knownNumbers: [1, 2, 3, 4],
  },
  {
    base: 'parcelles assainies',
    canonicalBase: 'Parcelles Assainies',
    region: 'Dakar',
    knownNumbers: [], // unités 1 à 26+, jamais une liste fiable — toujours ambiguïté.
  },
];

/** Numéraux romains minuscules I à X — graphies alternatives rencontrées
 * sur les quartiers numérotés (ex. "Sicap Liberté IV"). */
const ROMAN_TO_ARABIC: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
};

/** Un token est-il un numéro de quartier (chiffre 1-30, ou romain i-x) ?
 * Retourne sa valeur arabe, ou null. */
export function parseDistrictNumber(raw: string): number | null {
  if (/^\d{1,2}$/.test(raw)) return Number(raw);
  if (raw in ROMAN_TO_ARABIC) return ROMAN_TO_ARABIC[raw];
  return null;
}
