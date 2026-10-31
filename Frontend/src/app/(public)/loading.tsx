import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, HeroSkeleton, StatsRowSkeleton, CardsSectionSkeleton } from '@/components/ui/Skeleton';

/**
 * Accueil — héro + rangée de stats + grille d'annonces, même gabarit que
 * PublicSkeletonOverlay (changement de langue) : un seul composant pour les
 * deux cas (HeroSkeleton/StatsRowSkeleton/CardsSectionSkeleton, cf.
 * Skeleton.tsx). Le héro et la barre Milo ne « clignotent » pas : cette page
 * reproduit la même section plein écran avant l'arrivée du vrai contenu, pas
 * de flash blanc entre les deux.
 */
export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <SkeletonContainer label={t('loading')}>
      <HeroSkeleton />
      <StatsRowSkeleton />
      <CardsSectionSkeleton count={8} />
    </SkeletonContainer>
  );
}
