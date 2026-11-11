import { extractCriteria } from '../extractCriteria';
import { detectFaqIntent } from './detectFaq';

/** Helper : reproduit exactement le flux réel (extractCriteria puis
 * detectFaqIntent sur strictFilters), comme milo.service.ts. */
function faqFor(text: string) {
  const { strictFilters } = extractCriteria(text);
  return detectFaqIntent(text, strictFilters);
}

describe('detectFaqIntent — la recherche gagne toujours en cas de doute', () => {
  it.each([
    'studio a Mermoz comment payer 300k',
    'villa Saly 3 chambres',
    'combien coute un studio a Yoff',
    'je veux louer un studio',
    'appart meuble a Dakar',
    'chambre a louer pour 2 nuits',
    'villa a vendre a Thies',
    '2 bedrooms in Almadies under 300k',
  ])('"%s" : un critère de recherche présent → jamais de faq', (text) => {
    expect(faqFor(text)).toBeUndefined();
  });
});

describe('detectFaqIntent — sujets reconnus (FR)', () => {
  it.each([
    ['abonnement', 'tarifs_abonnements'],
    ["c'est quoi l'abonnement", 'tarifs_abonnements'],
    ['comment payer', 'moyens_paiement'],
    ['moyens de paiement', 'moyens_paiement'],
    ['remboursement', 'remboursement'],
    ['annuler ma reservation', 'remboursement'],
    ['commission', 'frais_commission'],
    ['caution', 'contrat_caution'],
    ['allo verifie', 'verification_bailleur'],
    ['quelles regions', 'zones_couvertes'],
    ['contact', 'contact_support'],
    ['signaler une annonce', 'signaler_annonce_arnaque'],
    ['arnaque', 'signaler_annonce_arnaque'],
    ['cgu', 'conditions_utilisation'],
    ['confidentialite', 'confidentialite'],
    ["c'est quoi alloappart", 'qu_est_ce_qu_alloappart'],
    ["c'est quoi milo", 'milo_c_est_quoi'],
    ['donne moi un exemple', 'milo_exemples'],
    ['devenir bailleur', 'devenir_bailleur'],
    ['comment devenir bailleur', 'devenir_bailleur'],
    ['creer un compte', 'creer_compte'],
    ['supprimer mon compte', 'supprimer_compte'],
    ["pourquoi ce bouton n'apparait pas", 'mode_vente'],
    ['comment publier une annonce', 'publier_annonce'],
    ['je veux publier', 'publier_annonce'],
    ['comment reserver', 'reserver'],
    ['difference entre locataire et bailleur', 'difference_roles'],
  ])('"%s" → %s', (text, expectedId) => {
    const faq = faqFor(text);
    expect(faq?.id).toBe(expectedId);
    expect(faq?.confidence).toBeGreaterThan(0);
  });
});

describe('detectFaqIntent — sujets reconnus (EN)', () => {
  it.each([
    ['subscription', 'tarifs_abonnements'],
    ['how much does the subscription cost', 'tarifs_abonnements'],
    ['how do i pay', 'moyens_paiement'],
    ['payment methods', 'moyens_paiement'],
    ['refund', 'remboursement'],
    ['cancel my booking', 'remboursement'],
    ['commission', 'frais_commission'],
    ['deposit amount', 'contrat_caution'],
    ['how to get verified', 'verification_bailleur'],
    ['which regions', 'zones_couvertes'],
    ['contact support', 'contact_support'],
    ['report a listing', 'signaler_annonce_arnaque'],
    ['scam', 'signaler_annonce_arnaque'],
    ['terms of use', 'conditions_utilisation'],
    ['privacy policy', 'confidentialite'],
    ['what is alloappart', 'qu_est_ce_qu_alloappart'],
    ['what is milo', 'milo_c_est_quoi'],
    ['what can you do', 'milo_c_est_quoi'],
    ['give me an example', 'milo_exemples'],
    ['how do i become a bailleur', 'devenir_bailleur'],
    ['how do i sign up', 'creer_compte'],
    ['delete my account', 'supprimer_compte'],
    ['why is this button greyed out', 'mode_vente'],
    ['how do i list my property', 'publier_annonce'],
    ['how do i book', 'reserver'],
  ])('"%s" → %s', (text, expectedId) => {
    expect(faqFor(text)?.id).toBe(expectedId);
  });
});

describe('detectFaqIntent — phrase floue sans sujet identifiable → unknown', () => {
  it.each([
    'comment ca marche',
    'comment ça marche',
    'aide',
    'help',
    'how does this work',
    '?',
  ])('"%s" → faq unknown (réponse honnête, jamais une devinette)', (text) => {
    const faq = faqFor(text);
    expect(faq?.id).toBe('unknown');
    expect(faq?.answerKey).toBe('unknown');
  });
});

describe('detectFaqIntent — ni recherche ni faq : comportement actuel inchangé', () => {
  it.each([
    'prix',
    '77 123 45 67',
    '',
    '   ',
    'bonjour',
    'studio moderne a Dakar',
  ])(
    '"%s" → undefined (ni une recherche avec critère, ni une question reconnaissable)',
    (text) => {
      expect(faqFor(text)).toBeUndefined();
    },
  );
});

describe('detectFaqIntent — pièges explicites du cahier des charges', () => {
  it('"studio à Mermoz comment payer 300k" = recherche, jamais faq paiement', () => {
    const { strictFilters } = extractCriteria(
      'studio a Mermoz comment payer 300k',
    );
    expect(strictFilters.type).toBe('STUDIO');
    expect(strictFilters.cityContains).toBe('Mermoz');
    expect(faqFor('studio a Mermoz comment payer 300k')).toBeUndefined();
  });

  it('"villa Saly 3 chambres" = recherche', () => {
    expect(faqFor('villa Saly 3 chambres')).toBeUndefined();
  });

  it('"combien coute un studio a Yoff" = RECHERCHE, jamais tarifs_abonnements', () => {
    const faq = faqFor('combien coute un studio a Yoff');
    expect(faq).toBeUndefined();
  });

  it('"je veux publier" vs "je veux louer un studio" : seul le premier est une faq', () => {
    expect(faqFor('je veux publier')?.id).toBe('publier_annonce');
    expect(faqFor('je veux louer un studio')).toBeUndefined();
  });

  it('"contact" vs "77 123 45 67" : seul le premier est une faq', () => {
    expect(faqFor('contact')?.id).toBe('contact_support');
    expect(faqFor('77 123 45 67')).toBeUndefined();
  });

  it('"abonnement" seul = faq tarifs, "prix" seul = pas de reponse', () => {
    expect(faqFor('abonnement')?.id).toBe('tarifs_abonnements');
    expect(faqFor('prix')).toBeUndefined();
  });

  it('une recherche ne devient jamais une faq même avec un mot-clé faq dedans ("abonnement" + critère)', () => {
    const faq = faqFor('studio a Dakar, comment marche abonnement pour agence');
    expect(faq).toBeUndefined();
  });
});
