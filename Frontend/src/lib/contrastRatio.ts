/**
 * Ratio de contraste WCAG 2.x entre deux couleurs hexadécimales (#RRGGBB).
 * Formule officielle : https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 * Sert à vérifier par le calcul (pas à l'œil) qu'un token de texte atteint
 * le seuil AA requis sur un fond donné — cf. lot « recette » (contraste or).
 */
function channelLuminance(c: number): number {
  const srgb = c / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}
