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
  const isProAgence = roles.includes('PRO_AGENCE');
  const isBailleur  = roles.includes('BAILLEUR') || isProAgence;
  const isLocataire = roles.includes('LOCATAIRE');
  const isAgent     = roles.includes('AGENT_TERRAIN');
  const isAdmin     = roles.includes('ADMIN');

  const userRole: 'ADMIN' | 'PRO_AGENCE' | 'AGENT_TERRAIN' | null =
    isAdmin ? 'ADMIN' : isProAgence ? 'PRO_AGENCE' : isAgent ? 'AGENT_TERRAIN' : null;

  const navItems: NavItem[] = [
    ...(isLocataire ? [
      { label: 'Tableau de bord',   href: '/locataire',           icon: 'fa-solid fa-gauge',          exact: true },
      { label: 'Mes réservations',  href: '/locataire/bookings',  icon: 'fa-solid fa-calendar-check' },
      { label: 'Favoris',           href: '/locataire/favorites',  icon: 'fa-solid fa-heart'          },
      { label: 'Messages',          href: '/locataire/messages',   icon: 'fa-solid fa-comment-dots'   },
    ] : []),
    ...(isBailleur ? [
      { label: 'Mes annonces',  href: '/bailleur/listings',    icon: 'fa-solid fa-house'          },
      { label: 'Réservations',  href: '/bailleur/bookings',    icon: 'fa-solid fa-calendar-check' },
      { label: 'Statistiques',  href: '/bailleur/analytics',   icon: 'fa-solid fa-chart-line'     },
      { label: 'Messages',      href: '/bailleur/messages',    icon: 'fa-solid fa-comment-dots'   },
      { label: 'Boost',         href: '/bailleur/boost',       icon: 'fa-solid fa-rocket'         },
      // Abonnement mensuel = réservé aux agences PRO_AGENCE, pas aux bailleurs individuels
      ...(isProAgence ? [{ label: 'Abonnement', href: '/bailleur/abonnement', icon: 'fa-solid fa-id-card' }] : []),
    ] : []),
    ...(isAgent ? [
      { label: 'Vérifications', href: '/agent/verifications', icon: 'fa-solid fa-shield-halved' },
    ] : []),
    ...(isAdmin ? [
      { label: 'Vue d\'ensemble', href: '/espace',                    icon: 'fa-solid fa-gauge',          exact: true },
      { label: 'Utilisateurs',    href: '/espace/users',              icon: 'fa-solid fa-users'         },
      { label: 'Annonces',        href: '/espace/listings',           icon: 'fa-solid fa-house'         },
      { label: 'Vérifications',   href: '/espace/verifications',      icon: 'fa-solid fa-shield-halved' },
      { label: 'Abonnements',     href: '/espace/subscriptions',      icon: 'fa-solid fa-id-card'       },
      { label: 'Réservations',    href: '/espace/bookings',           icon: 'fa-solid fa-calendar-check'},
      { label: 'Avis',            href: '/espace/reviews',            icon: 'fa-solid fa-star'          },
      { label: 'Analytiques',     href: '/espace/analytics',          icon: 'fa-solid fa-chart-bar'     },
      { label: 'Communications',  href: '/espace/communications',     icon: 'fa-solid fa-bell'          },
      { label: 'Configuration',   href: '/espace/config',             icon: 'fa-solid fa-sliders'       },
    ] : []),
  ];

  const userName = [me.firstName, me.lastName].filter(Boolean).join(' ') || 'Mon espace';

  return (
    <DashboardShell userName={userName} roles={roles} navItems={navItems} isProAgence={isProAgence} userRole={userRole}>
      {children}
    </DashboardShell>
  );
}
