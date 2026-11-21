import { describe, it, expect } from 'vitest';
import { contrastRatio } from './contrastRatio';

const AA_NORMAL_TEXT = 4.5;

// Valeurs copiées de src/app/globals.css — à resynchroniser si le token y
// change (cf. lot « recette » : contraste AA du texte or en mode clair).
const GOLD_TEXT_LIGHT = '#8a6a00';
const GOLD_DARK_LEGACY = '#b58900';
const WHITE = '#ffffff';
const PAGE_BG_LIGHT = '#fafafa';
const GOLD_PALE_LIGHT = '#fff5d6';

describe('contrastRatio (utilitaire WCAG)', () => {
  it('calcule 21:1 entre noir et blanc (cas de référence)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('est symétrique (ordre des couleurs sans effet sur le résultat)', () => {
    expect(contrastRatio(GOLD_TEXT_LIGHT, WHITE)).toBeCloseTo(contrastRatio(WHITE, GOLD_TEXT_LIGHT), 5);
  });
});

describe('--color-gold-text (lot « recette » — accessibilité AA)', () => {
  it("l'ancien token --color-gold-dark n'atteint PAS 4,5:1 sur blanc (c'est le bug corrigé)", () => {
    expect(contrastRatio(GOLD_DARK_LEGACY, WHITE)).toBeLessThan(AA_NORMAL_TEXT);
  });

  it('--color-gold-text atteint AU MOINS 4,5:1 sur fond blanc pur', () => {
    expect(contrastRatio(GOLD_TEXT_LIGHT, WHITE)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('--color-gold-text atteint AU MOINS 4,5:1 sur le fond de page clair (--aa-bg #FAFAFA)', () => {
    expect(contrastRatio(GOLD_TEXT_LIGHT, PAGE_BG_LIGHT)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('--color-gold-text atteint AU MOINS 4,5:1 sur le fond doré pâle des badges (--aa-gold-pale)', () => {
    expect(contrastRatio(GOLD_TEXT_LIGHT, GOLD_PALE_LIGHT)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});
