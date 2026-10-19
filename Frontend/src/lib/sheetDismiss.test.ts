import { describe, expect, it } from 'vitest';
import { shouldDismissSheet } from './sheetDismiss';

describe('shouldDismissSheet', () => {
  it('ne ferme pas sans glissement (distance nulle ou négative)', () => {
    expect(shouldDismissSheet({ dragDistance: 0, velocity: 0, sheetHeight: 400 })).toBe(false);
    expect(shouldDismissSheet({ dragDistance: -50, velocity: 0, sheetHeight: 400 })).toBe(false);
  });

  it('ne ferme pas sous les deux seuils (distance courte, vitesse lente)', () => {
    expect(shouldDismissSheet({ dragDistance: 50, velocity: 0.1, sheetHeight: 400 })).toBe(false);
  });

  it('ferme au-delà du seuil de distance (25% de la hauteur), même lentement', () => {
    expect(shouldDismissSheet({ dragDistance: 101, velocity: 0, sheetHeight: 400 })).toBe(true);
    expect(shouldDismissSheet({ dragDistance: 99, velocity: 0, sheetHeight: 400 })).toBe(false);
  });

  it('ferme sur un glissement rapide ("flick"), même sur une courte distance', () => {
    expect(shouldDismissSheet({ dragDistance: 10, velocity: 0.6, sheetHeight: 400 })).toBe(true);
  });

  it('garde-fou : hauteur de feuille nulle ou négative ne ferme jamais', () => {
    expect(shouldDismissSheet({ dragDistance: 200, velocity: 1, sheetHeight: 0 })).toBe(false);
    expect(shouldDismissSheet({ dragDistance: 200, velocity: 1, sheetHeight: -10 })).toBe(false);
  });
});
