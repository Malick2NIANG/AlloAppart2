/**
 * Logique pure de fermeture par glissement d'une feuille (BottomSheet).
 * Séparée du composant pour être testable sans DOM.
 */
export interface SheetDismissParams {
  /** Distance glissée vers le bas, en pixels (négatif ou nul = vers le haut/aucun geste → jamais de fermeture). */
  dragDistance: number;
  /** Vitesse de relâchement, en pixels/ms, vers le bas (négatif = vers le haut). */
  velocity: number;
  /** Hauteur totale de la feuille, en pixels. */
  sheetHeight: number;
}

/** Glissement rapide ("flick") qui ferme la feuille même sur une courte distance. */
export const SHEET_DISMISS_VELOCITY_THRESHOLD = 0.5;
/** Distance glissée, en proportion de la hauteur de la feuille, qui ferme la feuille même lentement. */
export const SHEET_DISMISS_DISTANCE_RATIO = 0.25;

export function shouldDismissSheet({ dragDistance, velocity, sheetHeight }: SheetDismissParams): boolean {
  if (sheetHeight <= 0 || dragDistance <= 0) return false;
  if (velocity >= SHEET_DISMISS_VELOCITY_THRESHOLD) return true;
  return dragDistance / sheetHeight >= SHEET_DISMISS_DISTANCE_RATIO;
}
