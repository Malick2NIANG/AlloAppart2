/**
 * Identité visuelle AlloAppart — valeurs strictement identiques à
 * Frontend/src/app/globals.css (@theme inline + .btn-gold).
 * RÈGLE : le doré = AlloAppart / la solution. Jamais de doré dans l'acte 1.
 */
export const BRAND = {
  gold: '#facc15',
  goldDark: '#b58900',
  goldLight: '#F9E4B7',
  goldPale: '#fff5d6',
  goldButtonEnd: '#fbbf24',

  navy: '#0f172a',
  bgLight: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#1C1C1C',
  textSub: '#6B7280',

  darkCard: '#1e293b',
  darkText: '#e2e8f0',

  buttonText: '#1e1e1e',
} as const;

/** Couleurs "danger" — réservées à l'acte 1 (problème). */
export const DANGER = {
  red: '#ef4444',
  redSoft: 'rgba(239, 68, 68, 0.14)',
  orange: '#f97316',
  orangeSoft: 'rgba(249, 115, 22, 0.14)',
  grey: '#64748b',
  greyLine: 'rgba(148, 163, 184, 0.18)',
} as const;

export const GRADIENTS = {
  /** Bouton principal (identique à .btn-gold du frontend). */
  button: `linear-gradient(90deg, ${BRAND.gold}, ${BRAND.goldButtonEnd})`,
  /** Texte doré premium. */
  goldText: `linear-gradient(100deg, ${BRAND.goldLight} 0%, ${BRAND.gold} 38%, ${BRAND.goldButtonEnd} 62%, ${BRAND.goldDark} 100%)`,
  /** Dégradé du logo (favicon.svg). */
  logo: `linear-gradient(135deg, ${BRAND.gold}, ${BRAND.goldDark})`,
} as const;

export const FONTS = {
  poppins: '"Poppins", sans-serif',
  inter: '"Inter", sans-serif',
} as const;

/** Tokens de forme partagés — cohérence des rayons / bordures / ombres. */
export const SHAPE = {
  radiusCard: 28,
  radiusTile: 16,
  radiusPill: 999,
  border: '1px solid rgba(226, 232, 240, 0.08)',
  borderStrong: '1px solid rgba(226, 232, 240, 0.14)',
  shadowCard: '0 30px 60px -20px rgba(2, 6, 23, 0.7), 0 1px 0 rgba(255,255,255,0.04) inset',
} as const;

export const goldAlpha = (a: number) => `rgba(250, 204, 21, ${a})`;
export const paleAlpha = (a: number) => `rgba(255, 245, 214, ${a})`;
export const slateAlpha = (a: number) => `rgba(226, 232, 240, ${a})`;
