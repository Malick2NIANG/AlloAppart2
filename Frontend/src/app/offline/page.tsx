'use client';

// Page hors connexion (lot 0d, PWA) — pré-mise en cache à l'installation du
// service worker (voir public/sw.js), servie quand une navigation échoue
// faute de réseau. Doit s'afficher SANS réseau : aucun appel API, aucun
// hook Clerk, aucune donnée dynamique — uniquement du texte statique et un
// bouton qui recharge la page (déclenche une nouvelle tentative réseau).
import { useTranslations } from 'next-intl';

export default function OfflinePage() {
  const t = useTranslations('offline');

  return (
    <main className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gold-pale">
        <i className="fa-solid fa-wifi-slash text-4xl text-gold-dark" />
      </div>
      <h1 className="text-3xl font-bold text-text">{t('title')}</h1>
      <p className="mt-3 max-w-sm text-sub">{t('description')}</p>
      <button type="button" onClick={() => window.location.reload()} className="btn-gold mt-8 px-6 py-2.5">
        <i className="fa-solid fa-rotate-right mr-2" />
        {t('retry')}
      </button>
    </main>
  );
}
