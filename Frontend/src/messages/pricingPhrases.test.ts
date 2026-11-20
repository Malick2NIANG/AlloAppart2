import { describe, it, expect } from 'vitest';
import fr from './fr.json';
import en from './en.json';

/**
 * Lot « montants des phrases » — garde-fou anti-régression : les phrases
 * i18n qui citent un montant d'abonnement/boost/AlloVérifié ne doivent
 * JAMAIS réintroduire un chiffre en dur.
 * - publish.verifiedBadgeDesc / boostDesc : paramétrées ({price}), lues
 *   depuis src/lib/pricing.ts côté composant (voir publier/page.tsx).
 * - miloFaq.tarifs_abonnements / verification_bailleur : réponses FAQ
 *   Milo (Backend, sans accès à la config) — reformulées sans montant,
 *   avec lien vers /tarifs (voir FAQ_LINKS).
 * La CGU (cgu.allverifie.body) garde volontairement ses montants en
 * clair : texte légal, modifié selon le préavis contractuel (Article 7),
 * jamais lié en direct à la config — exclue de ce garde-fou.
 */
const FCFA_AMOUNT = /\d[\d ,]{2,}\s?FCFA/;

describe('Phrases i18n — montants plus jamais en dur', () => {
  it.each([
    ['fr', fr],
    ['en', en],
  ])('%s : miloFaq.tarifs_abonnements et verification_bailleur ne citent aucun montant', (_locale, messages) => {
    const m = messages as { miloFaq: Record<string, string> };
    expect(m.miloFaq.tarifs_abonnements).not.toMatch(FCFA_AMOUNT);
    expect(m.miloFaq.verification_bailleur).not.toMatch(FCFA_AMOUNT);
  });

  it.each([
    ['fr', fr],
    ['en', en],
  ])('%s : publish.verifiedBadgeDesc et boostDesc sont paramétrées ({price}), jamais un montant figé', (_locale, messages) => {
    const m = messages as { publish: Record<string, string> };
    expect(m.publish.verifiedBadgeDesc).not.toMatch(FCFA_AMOUNT);
    expect(m.publish.verifiedBadgeDesc).toContain('{price}');
    expect(m.publish.boostDesc).not.toMatch(FCFA_AMOUNT);
    expect(m.publish.boostDesc).toContain('{price}');
  });

  it.each([
    ['fr', fr],
    ['en', en],
  ])('%s : les replis « indisponible » existent et ne citent aucun montant', (_locale, messages) => {
    const m = messages as { publish: Record<string, string> };
    expect(m.publish.verifiedBadgeDescUnavailable).not.toMatch(FCFA_AMOUNT);
    expect(m.publish.boostDescUnavailable).not.toMatch(FCFA_AMOUNT);
  });
});
