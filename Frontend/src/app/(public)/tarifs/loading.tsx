import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, PageHeaderSkeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <main className="min-h-screen bg-bg py-14 px-4">
      <div className="aa-container max-w-5xl">
        <SkeletonContainer label={t('loading')}>
          <PageHeaderSkeleton />
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <SkeletonCard height="280px" />
            <SkeletonCard height="280px" />
          </div>
        </SkeletonContainer>
      </div>
    </main>
  );
}
