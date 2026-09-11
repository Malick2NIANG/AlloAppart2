/**
 * Palette de couleurs d'accent prédéfinies pour la vitrine agence
 * (page "Ma vitrine"). Les clés DOIVENT rester synchronisées avec
 * Backend/src/auth/agency-color-palette.ts (AGENCY_COLOR_KEYS) — c'est le
 * backend qui valide la clé envoyée, le frontend ne fait que la restituer
 * visuellement. Volontairement pas de picker hex libre : palette fermée pour
 * garantir un rendu toujours lisible sur la page publique /agences/:slug.
 */
export interface AgencyColorOption {
  key: string;
  /** Libellé affiché dans le sélecteur (fr) */
  label: string;
  /** Couleur d'accent principale (boutons, icônes, bordures) */
  hex: string;
  /** Variante plus claire (fonds, halos, badges) */
  hexLight: string;
}

export const AGENCY_COLORS: AgencyColorOption[] = [
  { key: 'gold', label: 'Or', hex: '#B8860B', hexLight: '#FDF3DA' },
  { key: 'blue', label: 'Bleu', hex: '#2563EB', hexLight: '#DBEAFE' },
  { key: 'emerald', label: 'Émeraude', hex: '#059669', hexLight: '#D1FAE5' },
  { key: 'rose', label: 'Rose', hex: '#E11D48', hexLight: '#FFE4E9' },
  { key: 'purple', label: 'Violet', hex: '#7C3AED', hexLight: '#EDE4FF' },
  { key: 'amber', label: 'Ambre', hex: '#D97706', hexLight: '#FEF0D6' },
  { key: 'teal', label: 'Sarcelle', hex: '#0D9488', hexLight: '#CCFBF1' },
  { key: 'indigo', label: 'Indigo', hex: '#4338CA', hexLight: '#E0E4FF' },
];

const DEFAULT_COLOR = AGENCY_COLORS[0];

/** Retourne la couleur d'accent (hex) pour une clé donnée, avec repli sur "gold". */
export function getAgencyColorHex(key?: string | null): string {
  return AGENCY_COLORS.find((c) => c.key === key)?.hex ?? DEFAULT_COLOR.hex;
}

/** Retourne la variante claire (hex) pour une clé donnée, avec repli sur "gold". */
export function getAgencyColorHexLight(key?: string | null): string {
  return AGENCY_COLORS.find((c) => c.key === key)?.hexLight ?? DEFAULT_COLOR.hexLight;
}

/** Retourne l'option complète pour une clé donnée, avec repli sur "gold". */
export function getAgencyColorOption(key?: string | null): AgencyColorOption {
  return AGENCY_COLORS.find((c) => c.key === key) ?? DEFAULT_COLOR;
}
