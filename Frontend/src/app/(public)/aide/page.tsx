import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import AideContent from './AideContent';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('aide');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default function AidePage() {
  return <AideContent />;
}
