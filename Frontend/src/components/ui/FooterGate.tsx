'use client';

import { usePathname } from 'next/navigation';
import { locales } from '@/i18n/config';

/**
 * Lot « footer mobile limité » — sous 768px, le pied de page n'a sa place
 * que sur l'accueil et les pages d'information (longues, qu'on consulte
 * puis quitte) : ailleurs (listings, fiches, espaces connectés, messagerie…)
 * c'est une app, pas un site vitrine — le pied de page n'y est qu'un mur de
 * liens interminable avant la BottomNav. Seule source de vérité pour cette
 * liste : toute nouvelle page d'information doit être ajoutée ici.
 *
 * Aucun préfixe de langue dans ce projet (la locale vient d'un cookie,
 * jamais de l'URL — voir src/i18n/request.ts) : le retrait ci-dessous n'a
 * donc jamais d'effet aujourd'hui, posé seulement par robustesse si ça
 * changeait un jour.
 */
const MOBILE_FOOTER_WHITELIST = ['/', '/aide', '/tarifs', '/a-propos', '/plan-du-site', '/confidentialite', '/cgu', '/cookies'];

function stripLocalePrefix(pathname: string): string {
  const match = pathname.match(/^\/([a-z]{2})(\/.*)?$/);
  if (match && (locales as readonly string[]).includes(match[1])) {
    return match[2] ?? '/';
  }
  return pathname;
}

function showsFooterOnMobile(pathname: string): boolean {
  return MOBILE_FOOTER_WHITELIST.includes(stripLocalePrefix(pathname));
}

/**
 * /messages (public) calcule déjà elle-même sa hauteur totale en soustrayant
 * --bottom-offset (cf. son propre page.tsx) pour occuper exactement l'écran
 * restant sous la navbar — y ajouter l'espaceur générique créerait un espace
 * vide supplémentaire après un contenu déjà pile à la bonne taille. Seule
 * page publique dans ce cas aujourd'hui (vérifié : grep de --bottom-offset
 * dans src/app/(public)).
 */
function managesOwnBottomOffset(pathname: string): boolean {
  const path = stripLocalePrefix(pathname);
  return path === '/messages' || path.startsWith('/messages/');
}

/**
 * Pied de page masqué sous 768px partout sauf sur la liste blanche
 * ci-dessus — masquage CSS (`max-md:hidden`), jamais retiré du HTML, pour
 * que ses liens restent toujours indexables/accessibles. Un espaceur de la
 * hauteur exacte de la BottomNav (`--bottom-offset`, 0 si elle est absente,
 * ex. route immersive) prend alors sa place pour qu'aucun contenu ne reste
 * caché derrière elle — sauf sur une page qui réserve déjà cet espace
 * elle-même (voir `managesOwnBottomOffset`). Sans effet à partir de 768px
 * dans tous les cas.
 */
export default function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (showsFooterOnMobile(pathname)) return <>{children}</>;
  return (
    <>
      <div className="max-md:hidden">{children}</div>
      {!managesOwnBottomOffset(pathname) && (
        <div aria-hidden className="hidden max-md:block" style={{ height: 'var(--bottom-offset, 0px)' }} />
      )}
    </>
  );
}
