import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import type { User } from '@/types';
import DashboardShell, { type NavItem } from './DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, getToken } = await auth();
  if (!userId) redirect('/sign-in');

  const token = await getToken();
  if (!token) redirect('/sign-in');

  let me: User;
  try {
    me = await api.get<User>('/auth/me', token);
  } catch {
    redirect('/sign-in');
  }

  const td = await getTranslations('dashboard');

  const roles = me.roles;
  const isProAgence = roles.includes('PRO_AGENCE');
  const isBailleur  = roles.includes('BAILLEUR') || isProAgence;
  const isLocataire = roles.includes('LOCATAIRE');
  const isAgent     = roles.includes('AGENT_TERRAIN');
  const isAdmin     = roles.includes('ADMIN');

  const userRole: 'ADMIN' | 'PRO_AGENCE' | 'AGENT_TERRAIN' | null =
    isAdmin ? 'ADMIN' : isProAgence ? 'PRO_AGENCE' : isAgent ? 'AGENT_TERRAIN' : null;

  // Nav fusionnée pour les comptes locataire+bailleur
  const isDual = isLocataire && isBailleur;

  const navItems: NavItem[] = [
    ...(isDual ? [
      // ── Commun ──
      { label: td('navOverview'),        href: '/bailleur', icon: 'fa-solid fa-gauge', exact: true },
      // ── Bailleur ──
      { label: td('navLandlordSection'), href: '/bailleur',               icon: 'fa-solid fa-gauge',         exact: true, separator: true },
      { label: td('navMyListings'),      href: '/bailleur/listings',      icon: 'fa-solid fa-house'          },
      { label: td('navReceivedBookings'),href: '/bailleur/bookings',      icon: 'fa-solid fa-calendar-check' },
      { label: td('navMessages'),        href: '/bailleur/messages',      icon: 'fa-solid fa-comment-dots'   },
      { label: td('navAlloVerifie'),     href: '/bailleur/verifications', icon: 'fa-solid fa-shield-halved'  },
      { label: td('navBoost'),           href: '/bailleur/boost',         icon: 'fa-solid fa-rocket'         },
      ...(isProAgence ? [
        { label: td('navMyShowcase'),         href: '/bailleur/ma-vitrine', icon: 'fa-solid fa-store'     },
        { label: td('navShowcaseAnalytics'),  href: '/bailleur/analytics',  icon: 'fa-solid fa-chart-bar' },
        { label: td('navSubscription'),       href: '/bailleur/abonnement', icon: 'fa-solid fa-id-card'   },
      ] : []),
      // ── Locataire ──
      { label: td('navTenantSection'),  href: '/locataire',              icon: 'fa-solid fa-gauge',         exact: true, separator: true },
      { label: td('navMyBookings'),     href: '/locataire/bookings',     icon: 'fa-solid fa-calendar-check' },
      { label: td('navFavorites'),      href: '/locataire/favorites',    icon: 'fa-solid fa-heart'          },
      { label: td('navMyPayments'),     href: '/locataire/paiements',    icon: 'fa-solid fa-wallet'         },
      { label: td('navMessages'),       href: '/locataire/messages',     icon: 'fa-solid fa-comment-dots'   },
    ] : []),
    ...(!isDual && isLocataire ? [
      { label: td('navOverview'),       href: '/locataire',           icon: 'fa-solid fa-gauge',             exact: true },
      { label: td('navMyBookings'),     href: '/locataire/bookings',  icon: 'fa-solid fa-calendar-check'    },
      { label: td('navFavorites'),      href: '/locataire/favorites', icon: 'fa-solid fa-heart'             },
      { label: td('navMyPayments'),     href: '/locataire/paiements', icon: 'fa-solid fa-wallet'            },
      { label: td('navMessages'),       href: '/locataire/messages',  icon: 'fa-solid fa-comment-dots'      },
      { label: td('navBecomeLandlord'), href: '/become-bailleur',     icon: 'fa-solid fa-house-chimney-user'},
    ] : []),
    ...(!isDual && isBailleur ? [
      { label: td('navOverview'),       href: '/bailleur',               icon: 'fa-solid fa-gauge',         exact: true },
      { label: td('navMyListings'),     href: '/bailleur/listings',      icon: 'fa-solid fa-house'          },
      { label: td('navBookings'),       href: '/bailleur/bookings',      icon: 'fa-solid fa-calendar-check' },
      { label: td('navMessages'),       href: '/bailleur/messages',      icon: 'fa-solid fa-comment-dots'   },
      { label: td('navAlloVerifie'),    href: '/bailleur/verifications', icon: 'fa-solid fa-shield-halved'  },
      { label: td('navBoost'),          href: '/bailleur/boost',         icon: 'fa-solid fa-rocket'         },
      ...(isProAgence ? [
        { label: td('navMyShowcase'),        href: '/bailleur/ma-vitrine', icon: 'fa-solid fa-store'     },
        { label: td('navShowcaseAnalytics'), href: '/bailleur/analytics',  icon: 'fa-solid fa-chart-bar' },
        { label: td('navSubscription'),      href: '/bailleur/abonnement', icon: 'fa-solid fa-id-card'   },
      ] : []),
    ] : []),
    ...(isAgent ? [
      { label: td('navOverview'),    href: '/agent',              icon: 'fa-solid fa-gauge',           exact: true },
      { label: td('navMyMissions'),  href: '/agent/verifications', icon: 'fa-solid fa-shield-halved'  },
      { label: td('navCalendar'),    href: '/agent/calendrier',    icon: 'fa-regular fa-calendar-days' },
      { label: td('navMessages'),    href: '/agent/messages',      icon: 'fa-solid fa-comment-dots'   },
      { label: td('navMyProfile'),   href: '/agent/profil',        icon: 'fa-solid fa-user-circle'    },
    ] : []),
    ...(isAdmin ? [
      { label: td('navAdminOverview'),  href: '/espace',                icon: 'fa-solid fa-gauge',         exact: true },
      { label: td('navUsers'),          href: '/espace/users',          icon: 'fa-solid fa-users'          },
      { label: td('navListings'),       href: '/espace/listings',       icon: 'fa-solid fa-house'          },
      { label: td('navVerifications'),  href: '/espace/verifications',  icon: 'fa-solid fa-shield-halved'  },
      { label: td('navSubscriptions'),  href: '/espace/subscriptions',  icon: 'fa-solid fa-id-card'        },
      { label: td('navBookings'),       href: '/espace/bookings',       icon: 'fa-solid fa-calendar-check' },
      { label: td('navReviews'),        href: '/espace/reviews',        icon: 'fa-solid fa-star'           },
      { label: td('navReports'),        href: '/espace/reports',        icon: 'fa-solid fa-flag'           },
      { label: td('navAnalytics'),      href: '/espace/analytics',      icon: 'fa-solid fa-chart-bar'      },
      { label: td('navCommunications'), href: '/espace/communications', icon: 'fa-solid fa-bell'           },
      { label: td('navConfig'),         href: '/espace/config',         icon: 'fa-solid fa-sliders'        },
    ] : []),
  ];

  const userName   = [me.firstName, me.lastName].filter(Boolean).join(' ') || td('spaceFallback');
  const userAvatar = me.avatar ?? null;
  const initials   = [me.firstName?.[0], me.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';

  // Badge compteur vérifications en attente — admin uniquement (non bloquant)
  let pendingVerifCount = 0;
  if (isAdmin) {
    try {
      const vc = await api.get<{ count: number }>('/verifications/pending-count', token ?? undefined);
      pendingVerifCount = vc.count;
    } catch { /* non bloquant */ }
  }

  return (
    <DashboardShell
      userName={userName}
      userId={me.id}
      roles={roles}
      navItems={navItems}
      isProAgence={isProAgence}
      userRole={userRole}
      userAvatar={userAvatar}
      userInitials={initials}
      pendingVerifCount={pendingVerifCount}
    >
      {children}
    </DashboardShell>
  );
}
