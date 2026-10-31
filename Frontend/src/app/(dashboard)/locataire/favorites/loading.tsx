import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, ListingGridSkeleton } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <SkeletonContainer label={t('loading')}>
      <div className="mb-8 h-7 w-48 animate-pulse rounded-xl bg-line" />
      <ListingGridSkeleton count={6} />
    </SkeletonContainer>
  );
}
