import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('notFound');

  return (
    <main className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gold-pale">
        <span className="text-5xl font-black text-gold-dark leading-none">404</span>
      </div>
      <h1 className="text-3xl font-bold text-text">{t('title')}</h1>
      <p className="mt-3 max-w-sm text-sub">{t('description')}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn-gold px-6 py-2.5">
          <i className="fa-solid fa-house mr-2" />
          {t('home')}
        </Link>
        <Link href="/listings" className="rounded-full border border-line px-6 py-2.5 text-sm font-medium text-text hover:bg-card transition">
          <i className="fa-solid fa-magnifying-glass mr-2" />
          {t('seeListings')}
        </Link>
      </div>
    </main>
  );
}
