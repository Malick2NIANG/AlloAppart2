import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, ListingDetailSkeleton } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <main className="px-4 py-10 bg-bg min-h-screen">
      <div className="aa-container">
        <SkeletonContainer label={t('loading')}>
          <ListingDetailSkeleton />
        </SkeletonContainer>
      </div>
    </main>
  );
}
