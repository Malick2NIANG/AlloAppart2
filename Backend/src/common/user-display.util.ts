/**
 * Détecte un email placeholder généré côté serveur pour les comptes Clerk
 * sans email réel (inscription par téléphone seul, ou tout premier appel
 * authentifié avant que le webhook Clerk n'ait synchronisé le vrai profil —
 * voir AuthService.handleWebhook et ClerkAuthGuard, tous deux susceptibles
 * d'écrire `<clerkId>@clerk.local` dans `User.email`, colonne non nullable).
 * Ce placeholder ne doit jamais être affiché à un utilisateur ni utilisé
 * comme destinataire d'un email transactionnel.
 */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith('@clerk.local');
}

/**
 * Email à afficher dans un document ou une interface : l'email réel, ou
 * `null` si c'est un placeholder — à l'appelant de choisir le repli
 * (téléphone, mention « non renseigné », simple omission de la ligne...).
 */
export function displayableEmail(
  email: string | null | undefined,
): string | null {
  if (!email || isPlaceholderEmail(email)) return null;
  return email;
}
