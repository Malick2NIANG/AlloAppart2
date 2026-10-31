import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, ProfileSkeleton } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <main className="py-16 px-4 bg-bg min-h-screen">
      <div className="aa-container max-w-2xl">
        <SkeletonContainer label={t('loading')}>
          <ProfileSkeleton />
        </SkeletonContainer>
      </div>
    </main>
  );
}
