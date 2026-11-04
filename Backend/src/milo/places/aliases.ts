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
  'saly portudal': 'Saly',
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
};
