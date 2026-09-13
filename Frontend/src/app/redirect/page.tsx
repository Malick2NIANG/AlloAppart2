'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

interface MeResponse {
  roles: string[];
  mustChangePassword: boolean;
  termsAcceptedAt: string | null;
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1200;

export default function RedirectPage() {
  const router = useRouter();
  const t = useTranslations('redirectPage');
  // useAuth() expose l'état RÉEL de chargement de Clerk (isLoaded) et la même
  // méthode getToken() utilisée partout ailleurs dans l'app (ContractCard,
  // pages bailleur/locataire, etc.) — pas de délai fixe à deviner, pas d'accès
  // à des propriétés internes de Clerk, pas de lecture du cookie __session
  // (qui est HttpOnly et donc jamais lisible depuis document.cookie).
  // Ancienne implémentation : réimplémentait sa propre récupération de token
  // avec un abandon après 4s fixes — en dev, un premier chargement de page
  // (compilation Next.js) peut dépasser ce délai, ce qui renvoyait à tort
  // vers /sign-in un utilisateur pourtant bien connecté.
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isLoaded) return; // attend que Clerk ait fini de charger la session, sans délai arbitraire
    if (!isSignedIn) { router.replace('/sign-in'); return; }

    let cancelled = false;

    const doRedirect = async () => {
      const token = await getToken();
      if (!token) { if (!cancelled) router.replace('/sign-in'); return; }

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const me = await api.get<MeResponse>('/auth/me', token);
          if (cancelled) return;

          if (me.mustChangePassword) { router.replace('/change-password'); return; }
          if (!me.termsAcceptedAt)   { router.replace('/accept-terms');    return; }

          const roles = me.roles ?? [];
          if (roles.includes('ADMIN'))         { router.replace('/espace');              return; }
          if (roles.includes('AGENT_TERRAIN')) { router.replace('/agent/verifications'); return; }
          if (roles.includes('PRO_AGENCE'))    { router.replace('/bailleur/listings');   return; }
          if (roles.includes('BAILLEUR'))      { router.replace('/bailleur/listings');   return; }
          router.replace('/locataire');
          return;
        } catch (err: unknown) {
          const status = (err as { status?: number } | undefined)?.status;
          // Le backend dit explicitement que le token n'est pas valide
          // (401/403) : l'utilisateur n'est réellement pas authentifié,
          // retour légitime vers /sign-in.
          if (status === 401 || status === 403) {
            if (!cancelled) router.replace('/sign-in');
            return;
          }
          // Toute autre erreur (backend indisponible, 5xx, coupure réseau —
          // pas de `status` du tout si `fetch` lui-même a échoué) est
          // probablement transitoire. Avant, on renvoyait immédiatement vers
          // /sign-in un utilisateur pourtant bien connecté côté Clerk — bug
          // rapporté : "la redirection quand on est déjà connecté ne marche
          // pas". On réessaie quelques fois avant d'abandonner.
          if (attempt < MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }
          if (!cancelled) setFailed(true);
          return;
        }
      }
    };

    void doRedirect();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, getToken, router]);

  if (failed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <i className="fa-solid fa-triangle-exclamation text-2xl text-red-500" />
        <p className="max-w-xs text-sm text-sub">{t('failedMessage')}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-gold text-sm"
        >
          <i className="fa-solid fa-rotate-right mr-1.5" />
          {t('retryBtn')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
    </div>
  );
}
