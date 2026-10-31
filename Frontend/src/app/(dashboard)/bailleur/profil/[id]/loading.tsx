import { getTranslations } from 'next-intl/server';
import { SkeletonContainer } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <SkeletonContainer label={t('loading')} className="space-y-4">
      <div className="h-32 animate-pulse rounded-2xl bg-line" />
      <div className="h-24 animate-pulse rounded-2xl bg-line" />
    </SkeletonContainer>
  );
}
