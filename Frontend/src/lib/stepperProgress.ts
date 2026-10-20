/** Progression (0-100) d'un stepper à `total` étapes, à l'étape `current` (0-indexée). */
export function computeStepProgress(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, ((current + 1) / total) * 100));
}
