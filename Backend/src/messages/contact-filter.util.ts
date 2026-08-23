/**
 * Détecte et masque les tentatives de contournement de la plateforme dans les
 * messages du chat interne (numéros de téléphone, mentions d'apps de
 * messagerie externes) — pour éviter que locataire et bailleur ne quittent la
 * plateforme avant réservation/paiement (perte de commission).
 *
 * Approche volontairement permissive : on MASQUE plutôt qu'on BLOQUE, pour ne
 * pas créer de dead-end frustrant sur un faux positif (mêmes principes que
 * les grandes plateformes de location : Airbnb, Booking...).
 */

// Au moins 8 chiffres consécutifs (séparés par espace/point/tiret uniquement,
// jamais par '/' pour limiter les faux positifs sur les dates JJ/MM/AAAA).
// 8 chiffres exclut la plupart des prix ("25 000 FCFA" = 5 chiffres) tout en
// couvrant les numéros sénégalais (7X XXX XX XX = 9 chiffres) et formats +221.
const PHONE_PATTERN = /(?:\+?\d[\s.-]?){8,}\d/g;

const APP_KEYWORDS = [
  'whatsapp', 'wapp', 'telegram', 'signal', 'messenger', 'imo', 'viber',
];
const APP_PATTERN = new RegExp(`\\b(${APP_KEYWORDS.join('|')})\\b`, 'gi');

export interface FilterResult {
  content: string;
  wasFiltered: boolean;
}

export function sanitizeContactInfo(raw: string): FilterResult {
  let wasFiltered = false;

  let content = raw.replace(PHONE_PATTERN, () => {
    wasFiltered = true;
    return '[numéro masqué]';
  });

  content = content.replace(APP_PATTERN, () => {
    wasFiltered = true;
    return '[application masquée]';
  });

  return { content, wasFiltered };
}
