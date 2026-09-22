import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import type { User } from '@/types';

export default async function EspaceLayout({ children }: { children: React.ReactNode }) {
  const { userId, getToken } = await auth();
  if (!userId) redirect('/sign-in');

  const token = await getToken();
  let me: User;
  try {
    me = await api.get<User>('/auth/me', token ?? undefined);
  } catch {
    redirect('/sign-in');
  }

  if (!me.roles.includes('ADMIN')) redirect('/');

  // 2FA obligatoire pour accéder à l'espace admin — cf. RolesGuard côté
  // backend, qui bloquerait de toute façon le premier appel API. On coupe
  // court ici pour rediriger directement vers l'activation plutôt que de
  // laisser l'utilisateur atterrir sur un espace qui plantera au premier
  // fetch.
  if (!me.twoFactorEnabled) redirect('/profil/securite?require2fa=1');

  return <>{children}</>;
}
