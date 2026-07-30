'use client';

import { useUser } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';

export default function GreetingCTA({
  firstName: propFirstName,
  fallback,
}: {
  firstName: string | null;
  fallback: string;
}) {
  const t         = useTranslations('greeting');
  const { user }  = useUser();
  const firstName = propFirstName || user?.firstName || null;

  if (!firstName) return <>{fallback}</>;

  const hour = new Date().getHours();
  const salut =
    hour >= 5 && hour < 12
      ? t('morning')
      : hour >= 12 && hour < 18
        ? t('afternoon')
        : t('evening');

  return <>{`${salut} ${firstName}`}</>;
}
