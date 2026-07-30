'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface MeResponse {
  roles: string[];
  mustChangePassword: boolean;
}

async function getClerkToken(): Promise<string | null> {
  // 1. Via session Clerk en mémoire (navigation client-side)
  const session = (window as any).Clerk?.session;
  if (session) {
    try {
      const raw = session.lastActiveToken?.getRawString?.() ?? null;
      if (raw) return raw;
      const tok = await session.getToken?.();
      if (tok) return tok;
    } catch {}
  }

  // 2. Cookie __session (non-HttpOnly, présent après sign-in)
  const match = document.cookie.split('; ').find(c => c.startsWith('__session='));
  if (match) return decodeURIComponent(match.split('=').slice(1).join('='));

  // 3. Attendre que Clerk charge (max 4s) puis réessayer
  let retries = 0;
  while (!(window as any).Clerk?.session && retries < 20) {
    await new Promise(r => setTimeout(r, 200));
    retries++;
  }
  const s2 = (window as any).Clerk?.session;
  if (s2) {
    try {
      const raw2 = s2.lastActiveToken?.getRawString?.() ?? null;
      if (raw2) return raw2;
      return await s2.getToken?.() ?? null;
    } catch {}
  }

  return null;
}

export default function RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const doRedirect = async () => {
      const token = await getClerkToken();
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
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
    </div>
  );
}
