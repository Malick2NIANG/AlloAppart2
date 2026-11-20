/**
 * Milo FAQ (lot « page /aide ») — miroir, côté Frontend, des ids de
 * Backend/src/milo/faq/faqTopics.ts (FAQ_TOPICS). Le Backend ne connaît que
 * les mots-clés de détection ; le Frontend connaît déjà chaque id (clés
 * i18n `miloFaq.*`, `miloFaqQuestions.*`, `FAQ_LINKS`) — cette liste sert à
 * les énumérer pour /aide (boutons « questions courantes » + accordéon),
 * sans dupliquer la logique de détection elle-même.
 *
 * À garder synchronisé à la main avec FAQ_TOPICS (même ordre, mêmes ids) —
 * aucun sujet désactivé/retiré de FAQ_TOPICS ne doit rester ici.
 */
export const FAQ_TOPIC_IDS = [
  'tarifs_abonnements',
  'moyens_paiement',
  'remboursement',
  'frais_commission',
  'contrat_caution',
  'verification_bailleur',
  'zones_couvertes',
  'contact_support',
  'signaler_annonce_arnaque',
  'conditions_utilisation',
  'confidentialite',
  'qu_est_ce_qu_alloappart',
  'milo_c_est_quoi',
  'milo_exemples',
  'devenir_bailleur',
  'creer_compte',
  'supprimer_compte',
  'mode_vente',
  'publier_annonce',
  'reserver',
  'difference_roles',
  'photos_annonce',
  'modifier_supprimer_annonce',
  'favoris',
  'messagerie',
  'notifications',
  'avis',
  'contacter_bailleur',
  'app_mobile',
  'connexion_probleme',
  'annonce_validation',
] as const;
