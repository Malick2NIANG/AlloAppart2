import { describe, expect, it } from 'vitest';
import { computeStepProgress } from './stepperProgress';

describe('computeStepProgress', () => {
  it('première étape sur 6 — environ un sixième', () => {
    expect(computeStepProgress(0, 6)).toBeCloseTo(16.666, 2);
  });

  it('dernière étape sur 6 — 100%', () => {
    expect(computeStepProgress(5, 6)).toBe(100);
  });

  it('étape intermédiaire', () => {
    expect(computeStepProgress(2, 6)).toBeCloseTo(50, 5);
  });

  it('total à 0 — pas de division par zéro', () => {
    expect(computeStepProgress(0, 0)).toBe(0);
  });

  it('current au-delà de total — plafonné à 100', () => {
    expect(computeStepProgress(9, 6)).toBe(100);
  });
});
