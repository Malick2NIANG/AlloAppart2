import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, PageHeaderSkeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <main className="min-h-screen bg-bg py-14 px-4">
      <div className="aa-container max-w-3xl">
        <SkeletonContainer label={t('loading')}>
          <PageHeaderSkeleton />
          <SkeletonCard height="56px" />
          <div className="mt-6 flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 w-32 animate-pulse rounded-full bg-line" />
            ))}
          </div>
          <div className="mt-6">
            <SkeletonCard height="320px" />
          </div>
        </SkeletonContainer>
      </div>
    </main>
  );
}
