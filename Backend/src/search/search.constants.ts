/**
 * Milo Search v0 — lot 6b : source unique des champs filtrables/triables
 * Meilisearch, partagée entre SearchController (validation des requêtes
 * entrantes) et SearchService (configuration de l'index au démarrage) —
 * avant ce lot, seul le contrôleur les connaissait, l'index Meilisearch
 * n'était jamais configuré en conséquence (filterableAttributes/
 * sortableAttributes vides, cf. audit PLAN_SEARCH_V0.md § 1.b).
 */
export const ALLOWED_FILTER_FIELDS = [
  'type',
  'city',
  'region',
  'isVerified',
  'boostScore',
  'price',
];

export const ALLOWED_SORT_FIELDS = ['boostScore', 'createdAt', 'price'];

/**
 * Synonymes FR/EN de base pour la recherche texte (`q`) — chaque mot doit
 * lister explicitement les autres comme synonymes, Meilisearch n'infère pas
 * la symétrie automatiquement.
 */
export const SEARCH_SYNONYMS: Record<string, string[]> = {
  appart: ['appartement', 'apartment'],
  appartement: ['appart', 'apartment'],
  apartment: ['appart', 'appartement'],
  villa: ['maison', 'house'],
  maison: ['villa', 'house'],
  house: ['villa', 'maison'],
  chambre: ['room', 'bedroom'],
  room: ['chambre', 'bedroom'],
  bedroom: ['chambre', 'room'],
  bureau: ['office'],
  office: ['bureau'],
  terrain: ['land'],
  land: ['terrain'],
};
