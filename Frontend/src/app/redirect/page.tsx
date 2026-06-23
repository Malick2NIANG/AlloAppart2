import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';

export default async function RedirectPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect('/sign-in');

  const token = await getToken();
  try {
    const me = await api.get<{ roles: string[] }>('/auth/me', token ?? undefined);
    const roles = me.roles ?? [];
    if (roles.includes('ADMIN'))         redirect('/espace');
    if (roles.includes('AGENT_TERRAIN')) redirect('/agent/verifications');
    if (roles.includes('PRO_AGENCE'))    redirect('/bailleur/listings');
    if (roles.includes('BAILLEUR'))      redirect('/bailleur/listings');
    redirect('/locataire');
  } catch {
    redirect('/locataire');
  }
}
