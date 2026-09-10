'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';

interface MeResponse {
  roles: string[];
  mustChangePassword: boolean;
  termsAcceptedAt: string | null;
}

export default function RedirectPage() {
  const router = useRouter();
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

  useEffect(() => {
    if (!isLoaded) return; // attend que Clerk ait fini de charger la session, sans délai arbitraire
    if (!isSignedIn) { router.replace('/sign-in'); return; }

    const doRedirect = async () => {
      const token = await getToken();
      if (!token) { router.replace('/sign-in'); return; }

      let me: MeResponse;
      try {
        me = await api.get<MeResponse>('/auth/me', token);
      } catch {
        router.replace('/sign-in');
        return;
      }

      if (me.mustChangePassword) { router.replace('/change-password'); return; }
      if (!me.termsAcceptedAt)   { router.replace('/accept-terms');    return; }

      const roles = me.roles ?? [];
      if (roles.includes('ADMIN'))         { router.replace('/espace');              return; }
      if (roles.includes('AGENT_TERRAIN')) { router.replace('/agent/verifications'); return; }
      if (roles.includes('PRO_AGENCE'))    { router.replace('/bailleur/listings');   return; }
      if (roles.includes('BAILLEUR'))      { router.replace('/bailleur/listings');   return; }
      router.replace('/locataire');
    };

    void doRedirect();
  }, [isLoaded, isSignedIn, getToken, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
    </div>
  );
}
