/**
 * Traductions des communications sortantes (emails, SMS, notifications in-app).
 *
 * Pourquoi un dictionnaire en code plutôt qu'une bibliothèque :
 *  - volume faible (~40 messages), pas de dépendance à installer
 *  - typage TypeScript strict : une clé absente ou un paramètre manquant
 *    devient une erreur de compilation, pas un bug en production
 *
 * Le français est la référence : `MessageKey` est dérivé de l'objet `fr`, donc
 * toute clé ajoutée en français doit obligatoirement être traduite en anglais.
 */

export type Locale = 'fr' | 'en';

export const DEFAULT_LOCALE: Locale = 'fr';

/** Normalise une valeur douteuse (colonne DB, header) vers une locale supportée. */
export function toLocale(value: string | null | undefined): Locale {
  return value === 'en' ? 'en' : DEFAULT_LOCALE;
}

/* ── Dictionnaire ───────────────────────────────────────────────────────────
 * Les {placeholders} sont remplacés par le helper `t()`.
 * Convention de nommage : <canal><Sujet><Partie>
 *   mail* = email, sms* = SMS, push* = notification in-app
 */

const fr = {
  /* Commun */
  commonTeam: "L'équipe AlloAppart",
  commonHello: 'Bonjour {firstName}',
  commonSignIn: 'Se connecter',
  roleAgent: 'Agent terrain',
  roleAgence: 'Agence PRO',

  /* Email — identifiants de compte créé par l'admin */
  mailCredentialsSubject: 'Vos identifiants AlloAppart — {roleLabel}',
  mailCredentialsTitle: 'Bienvenue sur AlloAppart, {firstName} !',
  mailCredentialsIntro:
    'Votre compte {roleLabel}{agencySuffix} a été créé par l’administrateur.',
  mailCredentialsBoxTitle: 'Vos identifiants de connexion',
  mailCredentialsEmailLabel: 'Email :',
  mailCredentialsPasswordLabel: 'Mot de passe :',
  mailCredentialsAdvice:
    'Connectez-vous et changez votre mot de passe dès votre première connexion.',
  mailCredentialsIgnore: 'Si vous n’êtes pas concerné, ignorez cet email.',

  /* Email — suspension / réactivation de compte */
  mailSuspendedSubject: 'Votre compte AlloAppart a été suspendu',
  mailSuspendedTitle: 'Votre compte a été suspendu',
  mailSuspendedBody:
    'Votre compte AlloAppart a été suspendu par l’administrateur. Vous ne pouvez plus accéder à la plateforme.',
  mailSuspendedContact:
    'Si vous pensez qu’il s’agit d’une erreur, contactez-nous à',
  mailReactivatedSubject: 'Votre compte AlloAppart a été réactivé',
  mailReactivatedTitle: 'Votre compte a été réactivé',
  mailReactivatedBody:
    'Bonne nouvelle ! Votre compte AlloAppart a été réactivé. Vous pouvez à nouveau vous connecter et utiliser la plateforme.',

  /* Email — paiement confirmé */
  mailPaymentTenantSubject: 'Paiement confirmé — {listingTitle}',
  mailPaymentTenantAmount:
    'Votre paiement de <strong>{total} FCFA</strong> a été reçu avec succès.',
  mailPaymentTenantConfirmed:
    'Votre réservation pour <strong>{listingTitle}</strong> est confirmée.',
  mailPaymentLandlordSubject: 'Nouvelle réservation payée — {listingTitle}',
  mailPaymentLandlordBody:
    '<strong>{tenantName}</strong> a payé et réservé votre logement <strong>{listingTitle}</strong>.',
  mailPaymentTotalLabel: 'Montant total : <strong>{total} FCFA</strong>',
  mailPaymentFeeLabel: 'Commission AlloAppart : {fee} FCFA',
  mailPaymentNetLabel: 'Votre part nette : <strong>{net} FCFA</strong>',
  mailPaymentEscrowNote:
    'Les fonds sont sécurisés. Vous les recevrez à la fin du séjour.',

  /* Email — demande de réservation */
  mailBookingRequestTenantSubject: 'Votre demande de réservation — {listingTitle}',
  mailBookingRequestTenantBody:
    'Votre demande pour <strong>{listingTitle}</strong> à <strong>{city}</strong> a été reçue.',
  mailBookingRequestLandlordSubject: 'Nouvelle demande de réservation — {listingTitle}',
  mailBookingRequestLandlordBody:
    '<strong>{tenantName}</strong> a fait une demande pour <strong>{listingTitle}</strong>.',
  mailBookingRequestLandlordAction:
    'Connectez-vous à votre espace bailleur pour répondre.',
  mailAmountLabel: 'Montant : <strong>{amount} FCFA</strong>',
  mailRefLabel: 'Référence : <code>{ref}</code>',

  /* Email — réservation confirmée / annulée */
  mailBookingConfirmedSubject: 'Réservation confirmée — {listingTitle}',
  mailBookingConfirmedTitle: 'Bonne nouvelle, {firstName} !',
  mailBookingConfirmedBody:
    'Votre réservation pour <strong>{listingTitle}</strong> à <strong>{city}</strong> est <strong>confirmée</strong>.',
  mailBookingCancelledSubject: 'Réservation annulée — {listingTitle}',
  mailBookingCancelledBody:
    'Votre réservation pour <strong>{listingTitle}</strong> a été <strong>annulée</strong>.',
  mailContactLabel: 'Contact : {email}',

  /* SMS */
  smsCredentials:
    'AlloAppart — Bonjour {firstName} !\nVotre compte {roleLabel} a ete cree.\nEmail : {email}\nMot de passe : {password}\nConnexion : {url}/sign-in',
  smsBookingConfirmed:
    'AlloAppart — Bonjour {firstName} !\nVotre reservation pour "{listingTitle}" a ete confirmee par le bailleur.\nBonne installation !',
  smsBookingCancelled:
    'AlloAppart — Bonjour {firstName},\nVotre reservation pour "{listingTitle}" a ete annulee.\nConsultez nos autres annonces sur alloappart.sn',
  smsBookingRequest:
    'AlloAppart — Bonjour {firstName},\n{tenantName} a fait une demande de reservation pour "{listingTitle}".\nConnectez-vous pour accepter ou refuser.',
  smsSubscriptionExpiring:
    'AlloAppart — Bonjour {firstName},\nVotre abonnement PRO expire dans {daysLeft} jour(s).\nRenouvelez-le ici : {url}/bailleur/abonnement',
  smsSubscriptionSuspended:
    'AlloAppart — Bonjour {firstName},\nVotre abonnement PRO est arrive a expiration et a ete suspendu.\nRenouvelez-le : {url}/bailleur/abonnement',

  /* Notifications in-app — titres */
  pushPaymentConfirmedTitle: 'Paiement confirmé !',
  pushPaymentReceivedTitle: 'Réservation payée !',
  pushNewBookingTitle: 'Nouvelle demande de réservation',
  pushBookingConfirmedTitle: 'Réservation confirmée !',
  pushBookingCancelledTitle: 'Réservation annulée',
  pushBookingCancelledByTenantTitle: 'Réservation annulée par le locataire',
  pushReviewReceivedTitle: 'Nouvel avis reçu',
  pushVerifAssignedTitle: 'Nouvelle mission AlloVérifié',
  pushVerifScheduledTitle: 'Agent assigné à votre vérification',
  pushVerifInProgressTitle: 'Visite AlloVérifié en cours',
  pushVerifDoneTitle: '✅ Vérification terminée !',
  pushVerifDeclinedTitle: 'Agent indisponible pour votre mission',
  pushVerifValidatedTitle: '🏅 Badge AlloVérifié accordé !',
  pushListingReportedTitle: 'Nouveau signalement d’annonce',
  pushListingReportedUrgentTitle: '🚨 Annonce signalée plusieurs fois',
  pushDeclineRequestTitle: 'Demande de déclin à approuver',
  pushNewMessageTitle: 'Nouveau message',
  pushDisputeReportedLandlordTitle: '⚠️ Signalement de non-conformité',
  pushDisputeReportedAdminTitle: '⚠️ Nouveau litige à arbitrer',
  pushDisputeResolvedReleaseTenantTitle: 'Litige tranché',
  pushDisputeResolvedRefundTenantTitle: 'Litige tranché — remboursement',
  pushDisputeResolvedReleaseLandlordTitle: 'Litige tranché en votre faveur',
  pushDisputeResolvedRefundLandlordTitle: 'Litige tranché — remboursement du locataire',

  /* Notifications in-app — corps */
  pushPaymentConfirmedBody: 'Votre réservation pour « {listingTitle} » est confirmée.',
  pushPaymentReceivedBody: '{tenantName} a payé pour « {listingTitle} ».',
  pushNewBookingBody: '{tenantName} a demandé « {listingTitle} ».',
  pushBookingConfirmedBody: 'Votre réservation pour « {listingTitle} » est confirmée.',
  pushBookingCancelledBody: 'Votre réservation pour « {listingTitle} » a été annulée.',
  pushBookingCancelledByTenantBody:
    '{tenantName} a annulé sa réservation pour « {listingTitle} ».',
  pushReviewReceivedBody: '{tenantName} a laissé {stars} sur « {listingTitle} ».',
  pushVerifAssignedBody:
    'Vous avez été assigné à la vérification de « {listingTitle} ».',
  pushVerifScheduledBody: '{agentName} a été assigné pour vérifier « {listingTitle} ».',
  pushVerifInProgressBody: 'La vérification de « {listingTitle} » a démarré.',
  pushVerifDoneBody:
    'La visite de « {listingTitle} » est terminée. En attente de validation admin.',
  pushVerifDeclinedBody:
    'L’agent a décliné la mission pour « {listingTitle} ». Un autre agent sera assigné.',
  pushVerifValidatedBody:
    'Votre annonce « {listingTitle} » a obtenu le badge AlloVérifié.',
  pushListingReportedBody:
    '« {listingTitle} » signalée par {reporterName}. Motif : {reason}. ({count} signalement(s) au total)',
  pushDeclineRequestBody:
    'Un agent demande à décliner la mission « {listingTitle} ». Approbation requise.',
  pushNewMessageBody: '{senderName} vous a envoyé un message.',
  pushBookingRequestOneSignal: '{tenantName} — {listingTitle}',
  pushDisputeReportedLandlordBody:
    'Le locataire a signalé une non-conformité pour « {listingTitle} ». Les fonds sont gelés le temps de l’examen.',
  pushDisputeReportedAdminBody:
    'Signalement de non-conformité pour « {listingTitle} ». Examen requis.',
  pushDisputeResolvedReleaseTenantBody:
    'Votre signalement pour « {listingTitle} » a été examiné : les fonds ont été libérés au bailleur.',
  pushDisputeResolvedRefundTenantBody:
    'Votre signalement pour « {listingTitle} » a été examiné : vous avez été remboursé.',
  pushDisputeResolvedReleaseLandlordBody:
    'Le litige concernant « {listingTitle} » a été tranché en votre faveur. Les fonds vous ont été libérés.',
  pushDisputeResolvedRefundLandlordBody:
    'Le litige concernant « {listingTitle} » a été tranché en faveur du locataire, qui a été remboursé.',

  /* Motifs de signalement (utilisés dans les notifications admin) */
  reasonFRAUD: 'Arnaque / fraude',
  reasonWRONG_PRICE: 'Prix trompeur',
  reasonWRONG_PHOTOS: 'Photos trompeuses',
  reasonALREADY_RENTED: 'Bien déjà loué',
  reasonWRONG_LOCATION: 'Localisation incorrecte',
  reasonOFFENSIVE: 'Contenu offensant',
  reasonOTHER: 'Autre',
} as const;

/** Toute clé de `fr` doit exister en `en` — garanti par ce type. */
export type MessageKey = keyof typeof fr;

const en: Record<MessageKey, string> = {
  /* Common */
  commonTeam: 'The AlloAppart team',
  commonHello: 'Hello {firstName}',
  commonSignIn: 'Sign in',
  roleAgent: 'Field agent',
  roleAgence: 'PRO agency',

  /* Email — account credentials created by admin */
  mailCredentialsSubject: 'Your AlloAppart credentials — {roleLabel}',
  mailCredentialsTitle: 'Welcome to AlloAppart, {firstName}!',
  mailCredentialsIntro:
    'Your {roleLabel} account{agencySuffix} has been created by the administrator.',
  mailCredentialsBoxTitle: 'Your sign-in credentials',
  mailCredentialsEmailLabel: 'Email:',
  mailCredentialsPasswordLabel: 'Password:',
  mailCredentialsAdvice: 'Sign in and change your password on first login.',
  mailCredentialsIgnore: 'If this does not concern you, please ignore this email.',

  /* Email — account suspension / reactivation */
  mailSuspendedSubject: 'Your AlloAppart account has been suspended',
  mailSuspendedTitle: 'Your account has been suspended',
  mailSuspendedBody:
    'Your AlloAppart account has been suspended by the administrator. You can no longer access the platform.',
  mailSuspendedContact: 'If you believe this is a mistake, contact us at',
  mailReactivatedSubject: 'Your AlloAppart account has been reactivated',
  mailReactivatedTitle: 'Your account has been reactivated',
  mailReactivatedBody:
    'Good news! Your AlloAppart account has been reactivated. You can sign in and use the platform again.',

  /* Email — payment confirmed */
  mailPaymentTenantSubject: 'Payment confirmed — {listingTitle}',
  mailPaymentTenantAmount:
    'Your payment of <strong>{total} FCFA</strong> was received successfully.',
  mailPaymentTenantConfirmed:
    'Your booking for <strong>{listingTitle}</strong> is confirmed.',
  mailPaymentLandlordSubject: 'New paid booking — {listingTitle}',
  mailPaymentLandlordBody:
    '<strong>{tenantName}</strong> has paid for and booked your property <strong>{listingTitle}</strong>.',
  mailPaymentTotalLabel: 'Total amount: <strong>{total} FCFA</strong>',
  mailPaymentFeeLabel: 'AlloAppart commission: {fee} FCFA',
  mailPaymentNetLabel: 'Your net share: <strong>{net} FCFA</strong>',
  mailPaymentEscrowNote:
    'The funds are held securely. You will receive them at the end of the stay.',

  /* Email — booking request */
  mailBookingRequestTenantSubject: 'Your booking request — {listingTitle}',
  mailBookingRequestTenantBody:
    'Your request for <strong>{listingTitle}</strong> in <strong>{city}</strong> has been received.',
  mailBookingRequestLandlordSubject: 'New booking request — {listingTitle}',
  mailBookingRequestLandlordBody:
    '<strong>{tenantName}</strong> has made a request for <strong>{listingTitle}</strong>.',
  mailBookingRequestLandlordAction: 'Sign in to your landlord space to reply.',
  mailAmountLabel: 'Amount: <strong>{amount} FCFA</strong>',
  mailRefLabel: 'Reference: <code>{ref}</code>',

  /* Email — booking confirmed / cancelled */
  mailBookingConfirmedSubject: 'Booking confirmed — {listingTitle}',
  mailBookingConfirmedTitle: 'Good news, {firstName}!',
  mailBookingConfirmedBody:
    'Your booking for <strong>{listingTitle}</strong> in <strong>{city}</strong> is <strong>confirmed</strong>.',
  mailBookingCancelledSubject: 'Booking cancelled — {listingTitle}',
  mailBookingCancelledBody:
    'Your booking for <strong>{listingTitle}</strong> has been <strong>cancelled</strong>.',
  mailContactLabel: 'Contact: {email}',

  /* SMS */
  smsCredentials:
    'AlloAppart — Hello {firstName}!\nYour {roleLabel} account has been created.\nEmail: {email}\nPassword: {password}\nSign in: {url}/sign-in',
  smsBookingConfirmed:
    'AlloAppart — Hello {firstName}!\nYour booking for "{listingTitle}" has been confirmed by the landlord.\nEnjoy your stay!',
  smsBookingCancelled:
    'AlloAppart — Hello {firstName},\nYour booking for "{listingTitle}" has been cancelled.\nBrowse our other listings on alloappart.sn',
  smsBookingRequest:
    'AlloAppart — Hello {firstName},\n{tenantName} has made a booking request for "{listingTitle}".\nSign in to accept or decline.',
  smsSubscriptionExpiring:
    'AlloAppart — Hello {firstName},\nYour PRO subscription expires in {daysLeft} day(s).\nRenew it here: {url}/bailleur/abonnement',
  smsSubscriptionSuspended:
    'AlloAppart — Hello {firstName},\nYour PRO subscription has expired and been suspended.\nRenew it: {url}/bailleur/abonnement',

  /* In-app notifications — titles */
  pushPaymentConfirmedTitle: 'Payment confirmed!',
  pushPaymentReceivedTitle: 'Booking paid!',
  pushNewBookingTitle: 'New booking request',
  pushBookingConfirmedTitle: 'Booking confirmed!',
  pushBookingCancelledTitle: 'Booking cancelled',
  pushBookingCancelledByTenantTitle: 'Booking cancelled by the tenant',
  pushReviewReceivedTitle: 'New review received',
  pushVerifAssignedTitle: 'New AlloVerified mission',
  pushVerifScheduledTitle: 'Agent assigned to your verification',
  pushVerifInProgressTitle: 'AlloVerified visit in progress',
  pushVerifDoneTitle: '✅ Verification completed!',
  pushVerifDeclinedTitle: 'Agent unavailable for your mission',
  pushVerifValidatedTitle: '🏅 AlloVerified badge granted!',
  pushListingReportedTitle: 'New listing report',
  pushListingReportedUrgentTitle: '🚨 Listing reported multiple times',
  pushDeclineRequestTitle: 'Decline request to approve',
  pushNewMessageTitle: 'New message',
  pushDisputeReportedLandlordTitle: '⚠️ Non-conformity report',
  pushDisputeReportedAdminTitle: '⚠️ New dispute to arbitrate',
  pushDisputeResolvedReleaseTenantTitle: 'Dispute resolved',
  pushDisputeResolvedRefundTenantTitle: 'Dispute resolved — refund',
  pushDisputeResolvedReleaseLandlordTitle: 'Dispute resolved in your favour',
  pushDisputeResolvedRefundLandlordTitle: 'Dispute resolved — tenant refunded',

  /* In-app notifications — bodies */
  pushPaymentConfirmedBody: 'Your booking for “{listingTitle}” is confirmed.',
  pushPaymentReceivedBody: '{tenantName} has paid for “{listingTitle}”.',
  pushNewBookingBody: '{tenantName} requested “{listingTitle}”.',
  pushBookingConfirmedBody: 'Your booking for “{listingTitle}” is confirmed.',
  pushBookingCancelledBody: 'Your booking for “{listingTitle}” has been cancelled.',
  pushBookingCancelledByTenantBody:
    '{tenantName} cancelled their booking for “{listingTitle}”.',
  pushReviewReceivedBody: '{tenantName} left {stars} on “{listingTitle}”.',
  pushVerifAssignedBody: 'You have been assigned to verify “{listingTitle}”.',
  pushVerifScheduledBody: '{agentName} has been assigned to verify “{listingTitle}”.',
  pushVerifInProgressBody: 'The verification of “{listingTitle}” has started.',
  pushVerifDoneBody:
    'The visit for “{listingTitle}” is complete. Awaiting admin approval.',
  pushVerifDeclinedBody:
    'The agent declined the mission for “{listingTitle}”. Another agent will be assigned.',
  pushVerifValidatedBody:
    'Your listing “{listingTitle}” has been awarded the AlloVerified badge.',
  pushListingReportedBody:
    '“{listingTitle}” reported by {reporterName}. Reason: {reason}. ({count} report(s) in total)',
  pushDeclineRequestBody:
    'An agent is requesting to decline the mission “{listingTitle}”. Approval required.',
  pushNewMessageBody: '{senderName} sent you a message.',
  pushBookingRequestOneSignal: '{tenantName} — {listingTitle}',
  pushDisputeReportedLandlordBody:
    'The tenant has reported a non-conformity for “{listingTitle}”. Funds are frozen pending review.',
  pushDisputeReportedAdminBody:
    'Non-conformity report for “{listingTitle}”. Review required.',
  pushDisputeResolvedReleaseTenantBody:
    'Your report for “{listingTitle}” has been reviewed: the funds were released to the landlord.',
  pushDisputeResolvedRefundTenantBody:
    'Your report for “{listingTitle}” has been reviewed: you have been refunded.',
  pushDisputeResolvedReleaseLandlordBody:
    'The dispute regarding “{listingTitle}” was resolved in your favour. The funds have been released to you.',
  pushDisputeResolvedRefundLandlordBody:
    'The dispute regarding “{listingTitle}” was resolved in favour of the tenant, who has been refunded.',

  /* Report reasons (used in admin notifications) */
  reasonFRAUD: 'Scam / fraud',
  reasonWRONG_PRICE: 'Misleading price',
  reasonWRONG_PHOTOS: 'Misleading photos',
  reasonALREADY_RENTED: 'Already rented',
  reasonWRONG_LOCATION: 'Incorrect location',
  reasonOFFENSIVE: 'Offensive content',
  reasonOTHER: 'Other',
};

const CATALOG: Record<Locale, Record<MessageKey, string>> = { fr, en };

/**
 * Traduit une clé dans la langue donnée en interpolant les {paramètres}.
 *
 * Un paramètre absent laisse le placeholder intact plutôt que d'afficher
 * "undefined" — un email légèrement cassé vaut mieux qu'un email absurde.
 */
export function t(
  locale: Locale,
  key: MessageKey,
  params: Record<string, string | number> = {},
): string {
  const template = CATALOG[locale][key] ?? CATALOG[DEFAULT_LOCALE][key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Format monétaire/numérique cohérent avec la langue. */
export function formatNumber(locale: Locale, value: number): string {
  return value.toLocaleString(locale === 'en' ? 'en-US' : 'fr-SN');
}

/** Libellé traduit d'un motif de signalement. */
export function reasonLabel(locale: Locale, reason: string): string {
  const key = `reason${reason}` as MessageKey;
  return key in CATALOG[locale] ? t(locale, key) : reason;
}
