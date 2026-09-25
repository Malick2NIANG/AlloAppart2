import { describe, expect, it } from 'vitest';
import {
  formatPrice,
  formatDate,
  isPlaceholderEmail,
  displayableEmail,
} from './utils';

describe('formatPrice', () => {
  // Espaces normalisés dans les assertions : Intl.NumberFormat utilise des
  // espaces insécables (U+00A0 / U+202F selon la version de Node/ICU) qu'on
  // ne veut pas comparer caractère pour caractère. Le résultat contient
  // "F CFA" avec un espace (rendu ICU du symbole XOF en fr-SN), pas "FCFA"
  // collé.
  it('formate un montant en FCFA (XOF) avec le séparateur de milliers fr-SN', () => {
    expect(formatPrice(150000).replace(/\s+/g, ' ')).toBe('150 000 F CFA');
  });

  it('accepte un montant fourni sous forme de chaîne', () => {
    expect(formatPrice('50000').replace(/\s+/g, ' ')).toBe('50 000 F CFA');
  });

  it('gère le montant zéro', () => {
    expect(formatPrice(0).replace(/\s+/g, ' ')).toBe('0 F CFA');
  });
});

describe('formatDate', () => {
  it('formate une date ISO au format moyen fr-SN', () => {
    // "medium" en fr donne "d MMM yyyy", ex. "15 mars 2026" — on vérifie la
    // présence de l'année et du jour plutôt que la chaîne exacte, plus
    // robuste aux variations d'espace insécable entre versions d'ICU.
    const result = formatDate('2026-03-15T00:00:00.000Z');
    expect(result).toContain('2026');
    expect(result).toContain('15');
  });
});

describe('isPlaceholderEmail', () => {
  it('détecte un email placeholder @clerk.local', () => {
    expect(isPlaceholderEmail('user_2abc123@clerk.local')).toBe(true);
  });

  it('est insensible à la casse du domaine', () => {
    expect(isPlaceholderEmail('user_2abc123@CLERK.LOCAL')).toBe(true);
  });

  it('retourne false pour un email réel', () => {
    expect(isPlaceholderEmail('fatou.diallo@example.com')).toBe(false);
  });

  it('retourne false pour null/undefined/chaîne vide', () => {
    expect(isPlaceholderEmail(null)).toBe(false);
    expect(isPlaceholderEmail(undefined)).toBe(false);
    expect(isPlaceholderEmail('')).toBe(false);
  });
});

describe('displayableEmail', () => {
  it('retourne null pour un placeholder', () => {
    expect(displayableEmail('user_2abc123@clerk.local')).toBeNull();
  });

  it('retourne null pour null/undefined', () => {
    expect(displayableEmail(null)).toBeNull();
    expect(displayableEmail(undefined)).toBeNull();
  });

  it('retourne l’email tel quel si ce n’est pas un placeholder', () => {
    expect(displayableEmail('fatou.diallo@example.com')).toBe(
      'fatou.diallo@example.com',
    );
  });
});
