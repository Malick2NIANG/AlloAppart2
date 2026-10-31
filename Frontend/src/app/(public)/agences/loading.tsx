import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, PageHeaderSkeleton, CardsSectionSkeleton } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <main className="min-h-screen bg-bg py-14 px-4">
      <div className="aa-container">
        <SkeletonContainer label={t('loading')}>
          <PageHeaderSkeleton />
          <CardsSectionSkeleton count={8} title={false} />
        </SkeletonContainer>
      </div>
    </main>
  );
}
