import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, PageHeaderSkeleton } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <SkeletonContainer label={t('loading')} className="space-y-6">
      <PageHeaderSkeleton withAction />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
        <div className="h-96 animate-pulse rounded-2xl border border-line bg-card" />
        <div className="h-96 animate-pulse rounded-2xl border border-line bg-card" />
      </div>
    </SkeletonContainer>
  );
}
