import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, ProseDocSkeleton } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <main className="py-12 px-4 bg-bg min-h-screen">
      <div className="aa-container max-w-4xl">
        <SkeletonContainer label={t('loading')}>
          <ProseDocSkeleton />
        </SkeletonContainer>
      </div>
    </main>
  );
}
