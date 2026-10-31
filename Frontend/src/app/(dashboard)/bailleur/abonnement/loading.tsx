import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, PageHeaderSkeleton } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <SkeletonContainer label={t('loading')}>
      <PageHeaderSkeleton />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-80 animate-pulse rounded-2xl border border-line bg-card" />
        <div className="h-80 animate-pulse rounded-2xl border border-line bg-card" />
      </div>
    </SkeletonContainer>
  );
}
