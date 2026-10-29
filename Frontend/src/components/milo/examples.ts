/**
 * Milo Search v0 — phrases alternant dans le placeholder de la barre hero
 * (lot 6.0 — remplace les pastilles cliquables du lot 5a, retirées : une
 * façon de montrer ce que Milo comprend sans qu'elles soient actionnables).
 * Vérifiées « compris » (understood: true) une par une contre le Backend
 * réel — voir scripts/milo-verify-examples.ts.
 */

export const MILO_EXAMPLES: Record<'fr' | 'en', readonly string[]> = {
  fr: [
    'F3 à Mermoz sous 400 000 FCFA',
    'Villa avec piscine à Saly à vendre',
    '2 chambres climatisées aux Almadies',
  ],
  en: [
    '2 bedrooms in Almadies under 300k',
    'Villa with pool for sale in Saly',
    'Apartment with AC to rent in Mermoz',
  ],
};
