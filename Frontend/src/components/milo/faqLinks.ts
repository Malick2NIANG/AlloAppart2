/**
 * Milo FAQ (lot « Milo FAQ ») — lien optionnel par sujet (routage pur, pas
 * de texte : le texte vient du namespace i18n `miloFaq.*`). `href` absent =
 * la carte n'affiche pas de lien, seulement le texte de réponse.
 */
export const FAQ_LINKS: Record<string, string> = {
  // Lot « page /tarifs » : les deux sujets tarifaires pointent désormais
  // vers la page publique dédiée plutôt que vers l'espace bailleur connecté.
  tarifs_abonnements: '/tarifs',
  moyens_paiement: '/tarifs',
  remboursement: '/cgu',
  frais_commission: '/cgu',
  contrat_caution: '/cgu',
  verification_bailleur: '/cgu',
  conditions_utilisation: '/cgu',
  confidentialite: '/confidentialite',
  devenir_bailleur: '/become-bailleur',
  creer_compte: '/sign-up',
  supprimer_compte: '/cgu',
  mode_vente: '/cgu',
  publier_annonce: '/publier',
  zones_couvertes: '/listings',
  // Lot « FAQ procédurales ».
  photos_annonce: '/publier',
  modifier_supprimer_annonce: '/bailleur/listings',
  favoris: '/locataire/favorites',
  messagerie: '/messages',
  notifications: '/notifications',
  avis: '/locataire/bookings',
  contacter_bailleur: '/listings',
  // Lot « FAQ : décisions de contenu ».
  connexion_probleme: '/sign-in',
  annonce_validation: '/cgu',
  // app_mobile : pas de lien — rien à ouvrir, l'installation se fait depuis
  // le navigateur lui-même (menu natif), pas depuis une page de l'app.
};
