import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, VitrineSkeleton } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <SkeletonContainer label={t('loading')} className="min-h-screen bg-bg">
      <VitrineSkeleton />
    </SkeletonContainer>
  );
}
