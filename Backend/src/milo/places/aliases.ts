/**
 * Aliases à valider par Malick — variantes courtes et sûres uniquement,
 * ajoutées à la main (clé déjà normalisée : minuscules, sans accent).
 * Chaque alias pointe vers une entrée canonique déjà présente dans
 * places.data.ts (région, ville ou quartier) ; aucune entrée nouvelle n'est
 * inventée ici.
 *
 * Exclus volontairement (absents de Frontend/src/lib/regions.ts à ce jour,
 * donc aucune cible canonique existante — cf. rapport du lot 2) :
 * Sacré-Cœur/Sacre Coeur, Point E, Parcelles Assainies, Keur Massar.
 * « Cap Skirring » n'a pas besoin d'alias : déjà canonique tel quel
 * (highlight de Ziguinchor).
 */
export const PLACE_ALIASES: Record<string, string> = {
  thies: 'Thiès',
  'saint louis': 'Saint-Louis',
  'st louis': 'Saint-Louis',
  almadie: 'Almadies',
  'saly portudal': 'Saly',
};
