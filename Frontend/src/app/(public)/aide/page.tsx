import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import AideContent from './AideContent';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('aide');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    // Lot « boutons retour » — ?from=aide&sujet=<id> ne doit jamais entrer
    // dans l'URL canonique ni dans un aperçu partagé (toujours /aide nu,
    // quels que soient les paramètres réellement présents dans l'URL visitée).
    alternates: { canonical: '/aide' },
  };
}

export default function AidePage() {
  return <AideContent />;
}
