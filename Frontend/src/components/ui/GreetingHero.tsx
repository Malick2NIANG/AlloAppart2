'use client';

import { useUser } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';

export default function GreetingHero({ firstName: propFirstName }: { firstName: string }) {
  const t         = useTranslations('greeting');
  const { user }  = useUser();
  const firstName = propFirstName || user?.firstName || '';
  const hour      = new Date().getHours();

  const salut =
    hour >= 5 && hour < 12
      ? t('morning')
      : hour >= 12 && hour < 18
        ? t('afternoon')
        : t('evening');

  return (
    <>
      {firstName ? (
        <>
          {salut},{' '}
          <span className="mt-1 block bg-linear-to-r from-gold to-gold-light bg-clip-text text-transparent">
            {firstName} !
          </span>
        </>
      ) : (
        <>
          {salut},{' '}
          <span className="mt-1 block bg-linear-to-r from-gold to-gold-light bg-clip-text text-transparent">
            {t('welcome')}
          </span>
        </>
      )}
    </>
  );
}
