/**
 * Milo FAQ (coût zéro, aucun modèle externe) — sujets détectés par
 * mots-clés/synonymes FR+EN, comme le reste du parseur. Chaque `answerKey`
 * est une clé i18n Frontend (`miloFaq.<id>`) : le Backend ne connaît jamais
 * le texte de la réponse, seulement l'identifiant du sujet (même séparation
 * que `strictFilters.type`/`amenities`, qui sont des ids, jamais du texte).
 *
 * Seuls les sujets dont la réponse recopie un contenu RÉELLEMENT documenté
 * ailleurs dans le projet (CGU, page abonnement, examples.ts, Footer…) sont
 * listés ici — jamais un sujet inventé.
 *
 * app_mobile/connexion_probleme/annonce_validation (lot « FAQ : décisions de
 * contenu ») : les trois étaient en attente faute de contenu vérifié.
 * - app_mobile : aucune bannière/texte PWA existant trouvé dans le code —
 *   formulation générique (menu navigateur Android, Safari « Partager » sur
 *   iPhone), aucune app sur les stores annoncée.
 * - connexion_probleme : seuls « Mot de passe oublié ? » (reset par code
 *   e-mail) et « Continuer avec Google » existent réellement sur /sign-in
 *   (SignInForm.tsx) — pas de connexion par code e-mail autonome (le code
 *   e-mail n'intervient que pour réinitialiser le mot de passe ou pour la
 *   2FA, jamais comme mode de connexion à part entière).
 * - annonce_validation : activé — le code confirme qu'une annonce soumise
 *   avec status ACTIVE est publiée immédiatement (listings.service.ts
 *   `create()`, `wantsToPublish`), sans validation admin préalable ; seule
 *   une suspension a posteriori est possible (`suspendListing`, ADMIN).
 *   Aucun délai documenté nulle part — jamais mentionné dans la réponse.
 */
export interface FaqTopic {
  id: string;
  answerKey: string;
  keywords: { fr: string[]; en: string[] };
}

export const FAQ_TOPICS: FaqTopic[] = [
  {
    id: 'tarifs_abonnements',
    answerKey: 'tarifs_abonnements',
    keywords: {
      fr: [
        'abonnement',
        'abonnements',
        "c'est quoi l'abonnement",
        "qu'est ce que l'abonnement",
        "combien coute l'abonnement",
        'tarif abonnement',
        'tarifs abonnement',
        "prix de l'abonnement",
      ],
      en: [
        'subscription',
        'subscriptions',
        'what is the subscription',
        'how much does the subscription cost',
        'subscription price',
        'subscription plan',
      ],
    },
  },
  {
    id: 'moyens_paiement',
    answerKey: 'moyens_paiement',
    keywords: {
      fr: [
        'moyens de paiement',
        'moyen de paiement',
        'comment payer',
        'methode de paiement',
        'orange money',
        'wave',
        'paydunya',
        'comment je paye',
      ],
      en: [
        'payment methods',
        'payment method',
        'how do i pay',
        'how to pay',
        'orange money',
        'wave',
        'paydunya',
      ],
    },
  },
  {
    id: 'remboursement',
    answerKey: 'remboursement',
    keywords: {
      fr: [
        'remboursement',
        'se faire rembourser',
        'annuler ma reservation',
        'annulation reservation',
        "politique d'annulation",
      ],
      en: [
        'refund',
        'get refunded',
        'cancel my booking',
        'cancel my reservation',
        'cancellation policy',
      ],
    },
  },
  {
    id: 'frais_commission',
    answerKey: 'frais_commission',
    keywords: {
      fr: [
        'commission',
        'frais de commission',
        'quels sont les frais',
        'quels frais',
        'frais de la plateforme',
      ],
      en: ['commission', 'what fees', 'platform fees', 'service fees'],
    },
  },
  {
    id: 'contrat_caution',
    answerKey: 'contrat_caution',
    keywords: {
      fr: ['caution', 'depot de garantie', 'montant de la caution'],
      // "security deposit" volontairement absent : "security" seul est un
      // synonyme EN de l'équipement "gardien" (dict amenities) — la
      // recherche doit gagner, jamais cette phrase.
      en: ['deposit amount', 'how much is the deposit', 'what is the deposit'],
    },
  },
  {
    id: 'verification_bailleur',
    answerKey: 'verification_bailleur',
    keywords: {
      fr: [
        'allo verifie',
        'alloverifie',
        'comment etre verifie',
        'badge verifie',
        'verification bailleur',
      ],
      en: ['alloverifie', 'how to get verified', 'verified badge'],
    },
  },
  {
    id: 'zones_couvertes',
    answerKey: 'zones_couvertes',
    keywords: {
      fr: [
        'quelles regions',
        'quelles sont les regions',
        'zones couvertes',
        'regions couvertes',
        'villes couvertes',
      ],
      en: ['which regions', 'covered areas', 'covered regions', 'which cities'],
    },
  },
  {
    id: 'contact_support',
    answerKey: 'contact_support',
    keywords: {
      fr: [
        'contact',
        'contacter le support',
        'joindre le support',
        'service client',
      ],
      // "contact" nu volontairement absent côté EN (contrairement au FR) :
      // "contact" est aussi le verbe nu de "contact the landlord"/"contact
      // landlord" (lot « FAQ procédurales »), même token exact — jamais la
      // bonne réponse dans ce cas. Le FR "contacter" (forme conjuguée) ne
      // collisionne pas avec le "contact" nu, d'où l'asymétrie assumée.
      en: ['contact support', 'customer service', 'support team'],
    },
  },
  {
    id: 'signaler_annonce_arnaque',
    answerKey: 'signaler_annonce_arnaque',
    keywords: {
      fr: [
        'signaler une annonce',
        'signaler cette annonce',
        'arnaque',
        'escroquerie',
        'annonce suspecte',
      ],
      en: ['report a listing', 'report this listing', 'scam', 'fraud listing'],
    },
  },
  {
    id: 'conditions_utilisation',
    answerKey: 'conditions_utilisation',
    keywords: {
      fr: ["conditions d'utilisation", 'cgu', 'conditions generales'],
      // "terms of service" volontairement absent : "service" seul est un
      // synonyme EN de l'équipement "viabilise" (dict amenities) — la
      // recherche doit gagner, jamais cette phrase.
      en: ['terms of use', 'terms and conditions'],
    },
  },
  {
    id: 'confidentialite',
    answerKey: 'confidentialite',
    keywords: {
      fr: [
        'confidentialite',
        'politique de confidentialite',
        'protection des donnees',
      ],
      en: ['privacy', 'privacy policy', 'data protection'],
    },
  },
  {
    id: 'qu_est_ce_qu_alloappart',
    answerKey: 'qu_est_ce_qu_alloappart',
    keywords: {
      fr: [
        "c'est quoi alloappart",
        "qu'est ce qu'alloappart",
        "a propos d'alloappart",
      ],
      en: ['what is alloappart', 'about alloappart'],
    },
  },
  {
    id: 'milo_c_est_quoi',
    answerKey: 'milo_c_est_quoi',
    keywords: {
      fr: [
        "c'est quoi milo",
        "qu'est ce que milo",
        'qui es tu',
        'tu fais quoi',
      ],
      en: ['what is milo', 'what can you do', 'who are you'],
    },
  },
  {
    id: 'milo_exemples',
    answerKey: 'milo_exemples',
    keywords: {
      fr: [
        'donne moi un exemple',
        'exemple de recherche',
        'comment te parler',
        'comment chercher avec toi',
      ],
      en: ['give me an example', 'example search', 'how do i talk to you'],
    },
  },
  {
    id: 'devenir_bailleur',
    answerKey: 'devenir_bailleur',
    keywords: {
      fr: ['devenir bailleur', 'comment devenir bailleur'],
      en: [
        'become a landlord',
        'how do i become a bailleur',
        'how to become a landlord',
      ],
    },
  },
  {
    id: 'creer_compte',
    answerKey: 'creer_compte',
    keywords: {
      fr: [
        'creer un compte',
        'comment creer un compte',
        "s'inscrire",
        "comment m'inscrire",
      ],
      en: [
        'create an account',
        'how do i sign up',
        'sign up',
        'how to register',
      ],
    },
  },
  {
    id: 'supprimer_compte',
    answerKey: 'supprimer_compte',
    keywords: {
      fr: ['supprimer mon compte', 'supprimer le compte', 'fermer mon compte'],
      en: ['delete my account', 'delete account', 'close my account'],
    },
  },
  {
    id: 'mode_vente',
    answerKey: 'mode_vente',
    keywords: {
      // "vente"/"vendre"/"acheter" volontairement absents de toute phrase
      // ici : ce sont des mots-clés de transaction (dict.transaction), la
      // recherche doit toujours gagner sur ces mots, même dans une question
      // sur le bouton lui-même (règle absolue de la tâche) — une limite
      // assumée, pas un oubli.
      fr: [
        "pourquoi ce bouton n'apparait pas",
        'option reservee aux agences',
        'bouton grise sur mon compte',
      ],
      en: [
        'why is this button greyed out',
        'option only for subscribed agencies',
      ],
    },
  },
  {
    id: 'publier_annonce',
    answerKey: 'publier_annonce',
    keywords: {
      fr: [
        'comment publier une annonce',
        'comment publier',
        'je veux publier',
        'publier mon bien',
      ],
      en: [
        'how do i list my property',
        'how to publish a listing',
        'i want to publish',
        'list my property',
      ],
    },
  },
  {
    id: 'reserver',
    answerKey: 'reserver',
    keywords: {
      fr: ['comment reserver', 'comment faire une reservation'],
      en: ['how do i book', 'how to book', 'how do i make a reservation'],
    },
  },
  {
    id: 'difference_roles',
    answerKey: 'difference_roles',
    keywords: {
      fr: [
        'difference entre locataire et bailleur',
        'quelle est la difference entre les comptes',
        'quels sont les roles',
      ],
      en: [
        'difference between tenant and landlord',
        'what are the account roles',
      ],
    },
  },

  // ── Lot « FAQ procédurales » : parcours réels, aucune limite/délai inventé ──
  {
    id: 'photos_annonce',
    answerKey: 'photos_annonce',
    keywords: {
      fr: [
        'comment ajouter des photos',
        'comment mettre des photos',
        'ajouter des photos a mon annonce',
        'comment uploader des photos',
        'format des photos',
        'taille des photos',
      ],
      en: [
        'how do i add photos',
        'how to add photos',
        'how do i upload photos',
        'photo format',
        'photo size limit',
      ],
    },
  },
  {
    id: 'modifier_supprimer_annonce',
    answerKey: 'modifier_supprimer_annonce',
    keywords: {
      fr: [
        'comment modifier mon annonce',
        'comment supprimer mon annonce',
        'supprimer une annonce',
        'modifier une annonce',
      ],
      en: [
        'how do i edit my listing',
        'how do i delete my listing',
        'delete a listing',
        'edit a listing',
      ],
    },
  },
  {
    id: 'favoris',
    answerKey: 'favoris',
    keywords: {
      fr: [
        'comment ajouter aux favoris',
        'comment voir mes favoris',
        'ou sont mes favoris',
        'liste de mes favoris',
      ],
      en: [
        'how do i save a listing',
        'how do i see my favorites',
        'where are my favorites',
        'my favorites list',
      ],
    },
  },
  {
    id: 'messagerie',
    answerKey: 'messagerie',
    keywords: {
      fr: [
        'comment voir mes messages',
        'ou sont mes messages',
        'comment repondre a un message',
        'ma messagerie',
      ],
      en: [
        'where are my messages',
        'how do i see my messages',
        'how do i reply to a message',
        'my messages',
      ],
    },
  },
  {
    id: 'notifications',
    answerKey: 'notifications',
    keywords: {
      fr: [
        'comment voir mes notifications',
        'a quoi servent les notifications',
        'mes notifications',
      ],
      en: [
        'how do i see my notifications',
        'what are notifications for',
        'my notifications',
      ],
    },
  },
  {
    id: 'avis',
    answerKey: 'avis',
    keywords: {
      fr: [
        'comment laisser un avis',
        'comment noter un logement',
        'laisser une note',
      ],
      en: [
        'how do i leave a review',
        'how do i rate a property',
        'leave a rating',
      ],
    },
  },
  {
    id: 'contacter_bailleur',
    answerKey: 'contacter_bailleur',
    keywords: {
      fr: [
        'comment contacter le bailleur',
        'comment contacter un bailleur',
        'comment joindre le bailleur',
        'parler au proprietaire',
      ],
      en: [
        'how do i contact the landlord',
        'how do i reach the landlord',
        'talk to the landlord',
      ],
    },
  },

  // ── Lot « FAQ : décisions de contenu » — voir doc en tête de fichier ──
  {
    id: 'app_mobile',
    answerKey: 'app_mobile',
    keywords: {
      fr: [
        'avez vous une application',
        'avez vous une app',
        'application mobile',
        'app mobile',
        "comment installer l'application",
        "comment installer l'app",
        "installer l'application",
        "telecharger l'application",
        "telecharger l'app",
        'y a t il une application',
      ],
      en: [
        'do you have an app',
        'do you have a mobile app',
        'mobile app',
        'how do i install the app',
        'install the app',
        'download the app',
        'is there an app',
      ],
    },
  },
  {
    id: 'connexion_probleme',
    answerKey: 'connexion_probleme',
    keywords: {
      fr: [
        'mot de passe oublie',
        "j'ai oublie mon mot de passe",
        "je n'arrive pas a me connecter",
        'impossible de me connecter',
        'probleme de connexion',
        'je ne peux pas me connecter',
        'comment me connecter',
      ],
      en: [
        'forgot my password',
        'forgot password',
        "i can't log in",
        'i cannot log in',
        'unable to log in',
        'login problem',
        'trouble signing in',
      ],
    },
  },
  {
    id: 'annonce_validation',
    answerKey: 'annonce_validation',
    keywords: {
      fr: [
        'mon annonce est elle validee',
        'annonce validee par un admin',
        "validation de l'annonce",
        'mon annonce doit elle etre validee',
        'mon annonce est elle en attente de validation',
        'annonce en attente',
        'mon annonce est elle visible immediatement',
      ],
      en: [
        'is my listing reviewed before publishing',
        'does my listing need approval',
        'is my listing pending approval',
        'is my listing live immediately',
      ],
    },
  },
];

/** Marqueurs génériques de question (règle « phrase floue sans sujet
 * identifiable ») — aucun sujet précis reconnu mais clairement une question,
 * jamais une recherche : réponse honnête « je n'ai pas la réponse », jamais
 * un sujet deviné. Le "?" littéral est vérifié à part (retiré par
 * normalizeText, donc jamais présent dans les tokens). */
export const GENERIC_QUESTION_MARKERS: { fr: string[]; en: string[] } = {
  fr: ['comment ca marche', 'comment ça marche', 'aide', "besoin d'aide"],
  en: ['how does this work', 'help', 'need help'],
};
