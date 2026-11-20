import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import NotificationsSettings from './NotificationsSettings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pushSettings');
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export default function NotificationsSettingsPage() {
  return <NotificationsSettings />;
}
