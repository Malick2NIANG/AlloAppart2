'use client';

import { useTranslations } from 'next-intl';

export default function Greeting({ firstName }: { firstName: string }) {
  const t    = useTranslations('greeting');
  const hour = new Date().getHours();

  const salut =
    hour >= 5 && hour < 12
      ? t('morning')
      : hour >= 12 && hour < 18
        ? t('afternoon')
        : t('evening');

  return (
    <h1 className="text-2xl font-bold text-text">
      {salut}, {firstName}
    </h1>
  );
}
