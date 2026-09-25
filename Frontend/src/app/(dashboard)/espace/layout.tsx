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

  // 2FA obligatoire pour accéder à l'espace admin — un code envoyé par email
  // doit être validé à CHAQUE connexion (remplace le TOTP Clerk, payant sur
  // ce plan, cf. décision du 2026-09-25). Le statut est propre à la session
  // Clerk courante (pas un flag permanent sur le compte) — cf. RolesGuard
  // côté backend, qui bloquerait de toute façon le premier appel API. On
  // coupe court ici pour rediriger directement vers la saisie du code
  // plutôt que de laisser l'utilisateur atterrir sur un espace qui
  // plantera au premier fetch.
  const mfaStatus = await api
    .get<{ verified: boolean }>('/auth/admin-mfa/status', token ?? undefined)
    .catch(() => ({ verified: false }));
  if (!mfaStatus.verified) redirect('/verification-admin');

  return <>{children}</>;
}
