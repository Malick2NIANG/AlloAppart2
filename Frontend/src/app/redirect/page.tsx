import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';

interface MeResponse {
  roles: string[];
  mustChangePassword: boolean;
}

export default async function RedirectPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect('/sign-in');

  const token = await getToken();
  let me: MeResponse;
  try {
    me = await api.get<MeResponse>('/auth/me', token ?? undefined);
  } catch {
    redirect('/locataire');
  }

  if (me.mustChangePassword) redirect('/change-password');

  const roles = me.roles ?? [];
  if (roles.includes('ADMIN'))         redirect('/espace');
  if (roles.includes('AGENT_TERRAIN')) redirect('/agent/verifications');
  if (roles.includes('PRO_AGENCE'))    redirect('/bailleur/listings');
  if (roles.includes('BAILLEUR'))      redirect('/bailleur/listings');
  redirect('/locataire');
}
