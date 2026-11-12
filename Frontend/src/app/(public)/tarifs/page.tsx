import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { fetchPublicPricing } from './pricing';
import TarifsContent from './TarifsContent';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('tarifs');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export const revalidate = 3600;

export default async function TarifsPage() {
  const pricing = await fetchPublicPricing();
  return <TarifsContent pricing={pricing} />;
}
