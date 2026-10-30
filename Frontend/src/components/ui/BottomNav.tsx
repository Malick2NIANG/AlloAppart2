'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { isImmersiveRoute } from '@/lib/isImmersiveRoute';
import type { BottomNavItem } from '@/lib/getBottomNavItems';

/**
 * Événement custom permettant à une page de masquer temporairement la barre
 * du bas sans changer de route — cas de `/messages` (public), qui n'a pas de
 * route `[roomId]` dédiée (contrairement aux espaces locataire/bailleur/
 * agent) : ouvrir une conversation n'y change pas le chemin, donc
 * `isImmersiveRoute` seul ne peut pas le détecter. La page répartit l'état
 * ouvert/fermé via cet événement ; `BottomNav` l'écoute et se masque comme
 * sur une route immersive tant qu'il est actif.
 */
export const BOTTOM_NAV_TOGGLE_EVENT = 'aa-bottom-nav-toggle';

interface Props {
  items: BottomNavItem[];
  /** Ouvre le menu latéral existant (drawer) — pas de nouvelle feuille, cf. lot 0c. */
  showMore?: boolean;
  onMoreClick?: () => void;
  /** Pastille sur l'onglet dont la clé est "messages", si > 0. */
  unreadMessagesCount?: number;
}

/**
 * Barre de navigation fixe en bas d'écran, visible uniquement sous 768px
 * (`md:hidden`) — variante publique ou par rôle selon les `items` reçus
 * (cf. `getBottomNavItems`). Masquée sur les routes immersives
 * (`isImmersiveRoute`) : la page garde alors sa propre barre d'action
 * (ex. ListingContactCard) comme seule maîtresse du bas d'écran.
 *
 * Pose `data-bottom-nav="on"` sur <body> tant qu'elle est rendue, pour que
 * `globals.css` réserve l'espace (--bottom-nav-h) sous 768px et que les
 * autres éléments fixes bas (DemoDevBar, CookieConsentBanner, ToastProvider,
 * ListingContactCard) se replacent au-dessus via --bottom-offset.
 */
export default function BottomNav({ items, showMore = false, onMoreClick, unreadMessagesCount = 0 }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tNav = useTranslations('nav');
  const tDashboard = useTranslations('dashboard');
  const immersive = isImmersiveRoute(pathname);
  const [manuallyHidden, setManuallyHidden] = useState(false);
  const hidden = immersive || manuallyHidden;

  // Réinitialise le masquage manuel à chaque changement de route — évite
  // qu'il reste collé si la page qui l'a demandé (ex. /messages) est
  // quittée sans redispatcher explicitement `hidden: false` (changement
  // d'onglet, navigation directe par URL, etc.).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- réinitialisation ponctuelle au changement de route, pas une synchro continue
  useEffect(() => { setManuallyHidden(false); }, [pathname]);

  useEffect(() => {
    const handler = (e: Event) => setManuallyHidden(!!(e as CustomEvent<{ hidden: boolean }>).detail?.hidden);
    window.addEventListener(BOTTOM_NAV_TOGGLE_EVENT, handler);
    return () => window.removeEventListener(BOTTOM_NAV_TOGGLE_EVENT, handler);
  }, []);

  useEffect(() => {
    if (hidden) {
      document.body.removeAttribute('data-bottom-nav');
      return;
    }
    document.body.setAttribute('data-bottom-nav', 'on');
    return () => { document.body.removeAttribute('data-bottom-nav'); };
  }, [hidden]);

  if (hidden) return null;

  const translate = (item: BottomNavItem) =>
    item.i18nNamespace === 'nav' ? tNav(item.labelKey) : tDashboard(item.labelKey);

  // « Favoris » (public) redirige vers /listings?tab=favoris : sans ce test,
  // c'est l'onglet « Annonces » (même chemin /listings) qui restait en jaune.
  const onFavoritesTab = pathname === '/listings' && searchParams.get('tab') === 'favoris';

  const isActive = (href: string) => {
    if (href === '/favoris') {
      return pathname === href || pathname.startsWith(`${href}/`) || onFavoritesTab;
    }
    if (href === '/listings' && onFavoritesTab) return false;
    return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
  };

  return (
    <nav
      aria-label={tNav('bottomNavLabel')}
      className="md:hidden fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-line bg-card"
      style={{ height: 'calc(56px + var(--safe-bottom, 0px))', paddingBottom: 'var(--safe-bottom, 0px)' }}
    >
      {items.map((item) => {
        const active = isActive(item.href);
        const showBadge = item.key === 'messages' && unreadMessagesCount > 0;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`relative flex min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              active ? 'text-gold-dark' : 'text-sub'
            }`}
          >
            <span className="relative flex h-6 w-6 items-center justify-center">
              <i className={`${item.icon} text-base`} />
              {showBadge && (
                <span className="absolute -top-1 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
                  {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                </span>
              )}
            </span>
            <span className="truncate px-0.5">{translate(item)}</span>
          </Link>
        );
      })}
      {showMore && (
        <button
          type="button"
          onClick={onMoreClick}
          aria-label={tDashboard('navMore')}
          className="flex min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-sub transition-colors"
        >
          <span className="flex h-6 w-6 items-center justify-center">
            <i className="fa-solid fa-ellipsis text-base" />
          </span>
          <span className="truncate px-0.5">{tDashboard('navMore')}</span>
        </button>
      )}
    </nav>
  );
}
