'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface MeResponse {
  roles: string[];
  mustChangePassword: boolean;
}

export default function RedirectPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
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
