import { describe, expect, it } from 'vitest';
import { pointerToCanvas } from './pointerToCanvas';

describe('pointerToCanvas', () => {
  it('facteur 1 — canvas affiché à sa taille intrinsèque (≥768px)', () => {
    expect(pointerToCanvas(100, 0, 480, 480)).toBe(100);
  });

  it('facteur réduit — canvas affiché plus petit que sa taille intrinsèque (<768px)', () => {
    expect(pointerToCanvas(100, 0, 240, 480)).toBe(200);
  });

  it('bord haut-gauche du rectangle affiché', () => {
    expect(pointerToCanvas(50, 50, 240, 480)).toBe(0);
  });

  it('bord bas-droit du rectangle affiché', () => {
    expect(pointerToCanvas(50 + 240, 50, 240, 480)).toBe(480);
  });
});
