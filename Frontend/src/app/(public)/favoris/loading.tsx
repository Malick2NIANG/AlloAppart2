import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, PageHeaderSkeleton, CardsSectionSkeleton } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <main className="py-10 px-4 bg-bg min-h-screen">
      <div className="aa-container">
        <SkeletonContainer label={t('loading')}>
          <PageHeaderSkeleton />
          <CardsSectionSkeleton count={6} title={false} />
        </SkeletonContainer>
      </div>
    </main>
  );
}
