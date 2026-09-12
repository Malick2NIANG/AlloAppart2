'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

// Cible de redirectUrl pour authenticateWithRedirect() (Google OAuth) depuis
// SignInForm/SignUpForm. Sans cette page, le retour de Google ne finalise
// jamais la session : authenticateWithRedirect() a besoin qu'une page dédiée
// appelle handleRedirectCallback() (via ce composant) pour terminer le
// handshake OAuth et activer la session — un simple retour sur /sign-in ou
// /sign-up ne suffit pas, Clerk ne le fait pas automatiquement pour un flux
// personnalisé (signIn.create/signUp.create + authenticateWithRedirect).
// /redirect gère ensuite la redirection finale selon le rôle + les garde-fous
// (mot de passe à changer, CGU non acceptées).
export default function SSOCallbackPage() {
  return (
    <div className="flex items-center justify-center py-10">
      <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl="/redirect"
        signUpForceRedirectUrl="/redirect"
      />
    </div>
  );
}
