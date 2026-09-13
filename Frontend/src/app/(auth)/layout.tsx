import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import AuthCarousel from './AuthCarousel';
import { getTranslations } from 'next-intl/server';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth');

  // Un cookie de session Clerk survit à la fermeture de l'onglet/navigateur
  // (comportement normal, pas un bug) : sans ce garde-fou, un utilisateur
  // déjà connecté qui revient sur /sign-in ou /sign-up se retrouvait bloqué
  // avec une erreur brute Clerk "session_exists" en soumettant le
  // formulaire. On le redirige directement vers son espace à la place.
  const { userId } = await auth();
  if (userId) redirect('/redirect');

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Panneau gauche ── */}
      <div className="relative flex w-full flex-col lg:w-1/2">

        {/* Ligne dorée */}
        <div
          aria-hidden
          className="h-0.5 w-full shrink-0"
          style={{ background: 'linear-gradient(90deg, #facc15, #b58900, transparent)' }}
        />

        {/* Retour accueil */}
        <div className="shrink-0 px-6 pt-4 sm:px-10">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-sub hover:text-text transition-colors">
            <i className="fa-solid fa-arrow-left text-xs" />
            {t('backToSite')}
          </Link>
        </div>

        {/* Contenu centré + scroll de secours.
            Volontairement en grid (et non flex) pour le centrage : avec
            `overflow-y-auto` + `align-items: center`, un flex row/col classique
            rend la portion qui déborde AU-DESSUS du centre inaccessible au
            scroll dans certains navigateurs (bug connu de centrage flexbox +
            overflow) — la partie haute d'un formulaire un peu long (ex.
            inscription) se retrouvait alors tronquée sans moyen d'y remonter.
            Grid + place-items-center n'a pas ce défaut : le contenu reste
            centré quand il tient dans la hauteur dispo, et devient
            entièrement accessible au scroll (haut compris) sinon. */}
        <div className="flex-1 grid place-items-center overflow-y-auto px-6 py-6 sm:px-10">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>

        {/* Footer */}
        <p className="shrink-0 pb-3 text-center text-xs text-sub">
          © {new Date().getFullYear()} AlloAppart ·{' '}
          <Link href="/confidentialite" className="hover:text-gold-dark transition-colors">{t('privacy')}</Link>
          {' · '}
          <Link href="/cgu" className="hover:text-gold-dark transition-colors">{t('terms')}</Link>
        </p>
      </div>

      {/* ── Panneau droit — Carrousel ── */}
      <div className="hidden lg:block lg:w-1/2 h-full">
        <AuthCarousel />
      </div>
    </div>
  );
}
