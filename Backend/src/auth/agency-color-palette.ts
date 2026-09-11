/**
 * Palette de couleurs d'accent prédéfinies pour la vitrine agence
 * (page "Ma vitrine"). Volontairement fermée (pas de picker hex libre) pour
 * garantir un rendu toujours lisible/cohérent sur la page publique
 * /agences/:slug. Les valeurs hex vivent côté frontend (lib/agencyColors.ts) —
 * ici on ne valide que la clé.
 */
export const AGENCY_COLOR_KEYS = [
  'gold',
  'blue',
  'emerald',
  'rose',
  'purple',
  'amber',
  'teal',
  'indigo',
] as const;

export type AgencyColorKey = (typeof AGENCY_COLOR_KEYS)[number];
