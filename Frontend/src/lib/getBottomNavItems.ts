export type BottomNavContext = 'PUBLIC' | 'LOCATAIRE' | 'BAILLEUR' | 'DUAL' | 'AGENT' | 'ADMIN';

export interface BottomNavItem {
  key: string;
  href: string;
  icon: string;
  /** Namespace next-intl existant le plus proche — aucune nouvelle clé
   * n'est créée pour la variante connectée (tout vient déjà de
   * `dashboard.nav*`, réutilisé à l'identique depuis `navItems` du layout). */
  i18nNamespace: 'nav' | 'dashboard';
  labelKey: string;
}

export interface BottomNavResult {
  context: BottomNavContext;
  items: BottomNavItem[];
  /**
   * Un 5e emplacement « Plus » (ouvrant le menu latéral existant) est
   * nécessaire sauf pour l'agent terrain, dont les 4 raccourcis couvrent
   * déjà l'intégralité de sa navigation complète (aucune page cachée
   * derrière « Plus ») — cf. décision validée du chantier mobile.
   */
  showMore: boolean;
}

const PUBLIC_ITEMS = (isLoggedIn: boolean): BottomNavItem[] => [
  { key: 'home', href: '/', icon: 'fa-solid fa-house', i18nNamespace: 'nav', labelKey: 'home' },
  { key: 'listings', href: '/listings', icon: 'fa-solid fa-list', i18nNamespace: 'nav', labelKey: 'listings' },
  // Connecté : « Mon espace » remplace « Favoris » (doublon avec les onglets
  // « Toutes les annonces / Mes favoris » de /listings) ; /redirect envoie vers
  // l'espace du bon rôle. Visiteur : « Favoris » inchangé.
  isLoggedIn
    ? { key: 'space', href: '/redirect', icon: 'fa-solid fa-gauge', i18nNamespace: 'nav', labelKey: 'mySpace' }
    : { key: 'favorites', href: '/favoris', icon: 'fa-solid fa-heart', i18nNamespace: 'nav', labelKey: 'favorites' },
  { key: 'messages', href: isLoggedIn ? '/messages' : '/sign-in', icon: 'fa-solid fa-comment-dots', i18nNamespace: 'nav', labelKey: 'messages' },
  { key: 'account', href: isLoggedIn ? '/profil' : '/sign-in', icon: 'fa-solid fa-circle-user', i18nNamespace: 'nav', labelKey: 'account' },
];

/**
 * Items de la barre de navigation du bas — variante publique (5 items fixes,
 * `roles` vide) ou variante connectée (4 raccourcis par rôle, mêmes href et
 * libellés que `navItems` dans `(dashboard)/layout.tsx`, aucune nouvelle
 * route). Priorité en cas de rôles multiples : ADMIN > AGENT_TERRAIN > dual
 * (locataire+bailleur) > BAILLEUR/PRO_AGENCE > LOCATAIRE — même hiérarchie
 * que le rôle "dominant" déjà utilisé par DashboardShell pour son badge.
 */
export function getBottomNavItems(roles: string[], isLoggedIn: boolean): BottomNavResult {
  if (!isLoggedIn || roles.length === 0) {
    return { context: 'PUBLIC', showMore: false, items: PUBLIC_ITEMS(isLoggedIn) };
  }

  const isAdmin = roles.includes('ADMIN');
  const isAgent = roles.includes('AGENT_TERRAIN');
  const isProAgence = roles.includes('PRO_AGENCE');
  const isBailleur = roles.includes('BAILLEUR') || isProAgence;
  const isLocataire = roles.includes('LOCATAIRE');
  const isDual = isLocataire && isBailleur;

  if (isAdmin) {
    return {
      context: 'ADMIN',
      showMore: true,
      items: [
        { key: 'overview', href: '/espace', icon: 'fa-solid fa-gauge', i18nNamespace: 'dashboard', labelKey: 'navAdminOverview' },
        { key: 'users', href: '/espace/users', icon: 'fa-solid fa-users', i18nNamespace: 'dashboard', labelKey: 'navUsers' },
        { key: 'listings', href: '/espace/listings', icon: 'fa-solid fa-house', i18nNamespace: 'dashboard', labelKey: 'navListings' },
        { key: 'verifications', href: '/espace/verifications', icon: 'fa-solid fa-shield-halved', i18nNamespace: 'dashboard', labelKey: 'navVerifications' },
      ],
    };
  }

  if (isAgent) {
    return {
      context: 'AGENT',
      showMore: false,
      items: [
        { key: 'overview', href: '/agent', icon: 'fa-solid fa-gauge', i18nNamespace: 'dashboard', labelKey: 'navOverview' },
        { key: 'missions', href: '/agent/verifications', icon: 'fa-solid fa-shield-halved', i18nNamespace: 'dashboard', labelKey: 'navMyMissions' },
        { key: 'messages', href: '/agent/messages', icon: 'fa-solid fa-comment-dots', i18nNamespace: 'dashboard', labelKey: 'navMessages' },
        { key: 'profile', href: '/agent/profil', icon: 'fa-solid fa-circle-user', i18nNamespace: 'dashboard', labelKey: 'navMyProfile' },
      ],
    };
  }

  if (isDual) {
    return {
      context: 'DUAL',
      showMore: true,
      items: [
        { key: 'overview', href: '/bailleur', icon: 'fa-solid fa-gauge', i18nNamespace: 'dashboard', labelKey: 'navOverview' },
        { key: 'listings', href: '/bailleur/listings', icon: 'fa-solid fa-house', i18nNamespace: 'dashboard', labelKey: 'navListings' },
        { key: 'messages', href: '/bailleur/messages', icon: 'fa-solid fa-comment-dots', i18nNamespace: 'dashboard', labelKey: 'navMessages' },
        { key: 'bookings', href: '/bailleur/bookings', icon: 'fa-solid fa-calendar-check', i18nNamespace: 'dashboard', labelKey: 'navBookings' },
      ],
    };
  }

  if (isBailleur) {
    return {
      context: 'BAILLEUR',
      showMore: true,
      items: [
        { key: 'overview', href: '/bailleur', icon: 'fa-solid fa-gauge', i18nNamespace: 'dashboard', labelKey: 'navOverview' },
        { key: 'listings', href: '/bailleur/listings', icon: 'fa-solid fa-house', i18nNamespace: 'dashboard', labelKey: 'navListings' },
        { key: 'bookings', href: '/bailleur/bookings', icon: 'fa-solid fa-calendar-check', i18nNamespace: 'dashboard', labelKey: 'navBookings' },
        { key: 'messages', href: '/bailleur/messages', icon: 'fa-solid fa-comment-dots', i18nNamespace: 'dashboard', labelKey: 'navMessages' },
      ],
    };
  }

  if (isLocataire) {
    return {
      context: 'LOCATAIRE',
      showMore: true,
      items: [
        { key: 'overview', href: '/locataire', icon: 'fa-solid fa-gauge', i18nNamespace: 'dashboard', labelKey: 'navOverview' },
        { key: 'bookings', href: '/locataire/bookings', icon: 'fa-solid fa-calendar-check', i18nNamespace: 'dashboard', labelKey: 'navMyBookings' },
        // « Favoris » retiré de la barre (4 emplacements au total avec « Plus »,
        // sinon les libellés se chevauchent) : reste accessible via « Plus ».
        { key: 'messages', href: '/locataire/messages', icon: 'fa-solid fa-comment-dots', i18nNamespace: 'dashboard', labelKey: 'navMessages' },
      ],
    };
  }

  // Connecté mais sans rôle reconnu (ne devrait pas arriver en pratique) :
  // repli sur la variante publique plutôt que de rendre une barre vide.
  return { context: 'PUBLIC', showMore: false, items: PUBLIC_ITEMS(isLoggedIn) };
}
