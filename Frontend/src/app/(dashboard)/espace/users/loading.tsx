import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, DashboardListPageSkeleton } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <SkeletonContainer label={t('loading')}>
      <DashboardListPageSkeleton rows={8} />
    </SkeletonContainer>
  );
}
