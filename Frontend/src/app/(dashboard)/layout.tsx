import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import type { User } from '@/types';
import DashboardShell, { type NavItem } from './DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, getToken } = await auth();
  if (!userId) redirect('/sign-in');

  const token = await getToken();
  let me: User;
  try {
    me = await api.get<User>('/auth/me', token ?? undefined);
  } catch {
    throw new Error('Impossible de charger votre profil. Veuillez réessayer.');
  }

  const roles = me.roles;
  const isBailleur = roles.includes('BAILLEUR') || roles.includes('PRO_AGENCE');
  const isLocataire = roles.includes('LOCATAIRE');
  const isAgent = roles.includes('AGENT_TERRAIN');
  const isAdmin = roles.includes('ADMIN');

  const navItems: NavItem[] = [
    ...(isLocataire ? [
      { label: 'Mes réservations',  href: '/locataire/bookings',  icon: 'fa-solid fa-calendar-check' },
      { label: 'Favoris',           href: '/locataire/favorites',  icon: 'fa-solid fa-heart'          },
      { label: 'Messages',          href: '/locataire/messages',   icon: 'fa-solid fa-comment-dots'   },
    ] : []),
    ...(isBailleur ? [
      { label: 'Mes annonces',  href: '/bailleur/listings',   icon: 'fa-solid fa-house'          },
      { label: 'Réservations',  href: '/bailleur/bookings',   icon: 'fa-solid fa-calendar-check' },
      { label: 'Statistiques',  href: '/bailleur/analytics',  icon: 'fa-solid fa-chart-line'     },
      { label: 'Messages',      href: '/bailleur/messages',   icon: 'fa-solid fa-comment-dots'   },
    ] : []),
    ...(isAgent ? [
      { label: 'Vérifications', href: '/agent/verifications', icon: 'fa-solid fa-shield-halved' },
    ] : []),
    ...(isAdmin ? [
      { label: 'Vue d\'ensemble', href: '/admin',                 icon: 'fa-solid fa-gauge'         },
      { label: 'Annonces',        href: '/admin/listings',        icon: 'fa-solid fa-house'         },
      { label: 'Utilisateurs',    href: '/admin/users',           icon: 'fa-solid fa-users'         },
      { label: 'Vérifications',   href: '/admin/verifications',   icon: 'fa-solid fa-shield-halved' },
      { label: 'Analytiques',     href: '/admin/analytics',       icon: 'fa-solid fa-chart-bar'     },
    ] : []),
  ];

  const userName = [me.firstName, me.lastName].filter(Boolean).join(' ') || 'Mon espace';

  return (
    <DashboardShell userName={userName} navItems={navItems}>
      {children}
    </DashboardShell>
  );
}
