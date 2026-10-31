/**
 * Repères/axes routiers — lot 7, règle 1.b. Jamais un cityContains (un axe
 * traverse plusieurs quartiers, le filtre renverrait zéro résultat) :
 * détectés à part, indépendants de la langue (comme places.data.ts),
 * jamais ajoutés à PLACES/QUARTIERS. "Corniche" rejoint la préférence
 * douce `near_sea` déjà existante (dictionaries/*.ts) — un axe réellement
 * bord de mer ; les autres (VDN, autoroute, aéroport) n'ont pas
 * d'équivalent et restent un mot compris mais non extrait (ambiguïté
 * "landmark" + mot non compris, cf. extractors/places.ts).
 */
export interface Landmark {
  /** Forme normalisée (minuscules, sans accent) — un ou plusieurs mots. */
  normalized: string;
  /** Préférence douce associée, si une correspond déjà (lot 1/6a). */
  softPreference?: string;
}

export const LANDMARKS: Landmark[] = [
  { normalized: 'vdn' },
  { normalized: 'corniche', softPreference: 'near_sea' },
  { normalized: 'la corniche', softPreference: 'near_sea' },
  { normalized: 'autoroute' },
  // "l'autoroute"/"l'aeroport" : élision FR ("de l'autoroute") collée au
  // mot suivant par la tokenisation (espace absent) — formes à part, pas
  // couvertes par l'entrée sans élision.
  { normalized: "l'autoroute" },
  { normalized: 'autoroute a peage' },
  { normalized: 'aeroport' },
  { normalized: "l'aeroport" },
  { normalized: 'route de' },
];
