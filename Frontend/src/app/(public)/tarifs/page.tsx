import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { fetchPublicPricing } from '@/lib/pricing';
import TarifsContent from './TarifsContent';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('tarifs');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    // Lot « boutons retour » — ?from=aide&sujet=<id> (marqueur BackButton)
    // ne doit jamais entrer dans l'URL canonique.
    alternates: { canonical: '/tarifs' },
  };
}

export const revalidate = 3600;

export default async function TarifsPage() {
  const pricing = await fetchPublicPricing();
  return <TarifsContent pricing={pricing} />;
}
