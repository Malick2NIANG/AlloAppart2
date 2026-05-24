import Link from 'next/link';
import AuthCarousel from './AuthCarousel';
import { getTranslations } from 'next-intl/server';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth');

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

        {/* Contenu centré + scroll de secours */}
        <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-4 sm:px-10">
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
