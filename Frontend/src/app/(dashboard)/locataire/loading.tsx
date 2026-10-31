import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, StatGridSkeleton } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <SkeletonContainer label={t('loading')} className="flex flex-col gap-8">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-line" />
      <StatGridSkeleton count={4} cols={4} />
      <div className="h-40 animate-pulse rounded-2xl border border-line bg-card" />
    </SkeletonContainer>
  );
}
