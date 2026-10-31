import { getTranslations } from 'next-intl/server';
import { SkeletonContainer } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-bg px-4 py-16">
      <SkeletonContainer label={t('loading')} className="flex w-full max-w-md flex-col items-center text-center">
        <div className="h-16 w-16 animate-pulse rounded-full bg-line" />
        <div className="mt-6 h-7 w-56 animate-pulse rounded-xl bg-line" />
        <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded-xl bg-line" />
        <div className="mt-8 h-32 w-full animate-pulse rounded-2xl bg-line" />
      </SkeletonContainer>
    </main>
  );
}
