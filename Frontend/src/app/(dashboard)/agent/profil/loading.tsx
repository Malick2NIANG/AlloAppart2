import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, StatGridSkeleton, ListRowsSkeleton } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <SkeletonContainer label={t('loading')} className="space-y-5">
      <div className="h-6 w-48 animate-pulse rounded-xl bg-line" />
      <StatGridSkeleton count={4} cols={4} />
      <ListRowsSkeleton count={3} />
    </SkeletonContainer>
  );
}
