/**
 * Aliases à valider par Malick — variantes courtes et sûres uniquement,
 * ajoutées à la main (clé déjà normalisée : minuscules, sans accent).
 * Chaque alias pointe vers une entrée canonique déjà présente dans
 * places.data.ts OU quartiers.ts (région, ville ou quartier) ; aucune
 * entrée nouvelle n'est inventée ici — résolues contre l'index complet
 * (places.ts § buildIndex), quartiers.ts compris depuis le lot 2b.
 * « Cap Skirring » n'a pas besoin d'alias : déjà canonique tel quel
 * (highlight de Ziguinchor).
 */
export const PLACE_ALIASES: Record<string, string> = {
  thies: 'Thiès',
  'saint louis': 'Saint-Louis',
  'st louis': 'Saint-Louis',
  almadie: 'Almadies',
  // "saly portudal" retiré (lot « quartiers complémentaires ») : "Saly
  // Portudal" est désormais son propre quartier composé dans quartiers.ts,
  // distinct de "Saly" (même principe que "Mermoz Sacré-Cœur") — l'alias
  // le collapserait à tort vers "Saly" seul.
  // Lot 7 bis, règle E — variantes d'orthographe/abréviations. "pa"/"sc3"
  // sont des abréviations courtes et peu sûres (needsValidation hérité de
  // la cible) : à confirmer par Malick avant de les considérer fiables.
  'sacre coeur': 'Sacré-Cœur',
  sc3: 'Sacré-Cœur',
  pointe: 'Point E',
  parcelles: 'Parcelles Assainies',
  pa: 'Parcelles Assainies',
  'grand-yoff': 'Grand Yoff',
  retba: 'Lac Rose',
  // Lot « quartiers complémentaires », règle 2 — variantes à tiret des
  // quartiers composés (normalizeText garde les tirets inchangés, "Sicap
  // Baobab" tapé "Sicap-Baobab" ne matcherait jamais l'entrée à espace sans
  // ça, même principe que "grand-yoff" ci-dessus).
  'sicap-baobab': 'Sicap Baobab',
  'saly-portudal': 'Saly Portudal',
  'golf-sud': 'Golf Sud',
  'cite-keur-gorgui': 'Cité Keur Gorgui',
};
