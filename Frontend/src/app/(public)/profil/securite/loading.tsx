import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, FormSkeleton } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <main className="py-10 px-4 bg-bg min-h-screen max-md:min-h-dvh max-md:py-6">
      <div className="aa-container max-w-2xl space-y-6">
        <SkeletonContainer label={t('loading')}>
          <div className="h-3.5 w-24 animate-pulse rounded-xl bg-line" />
          <div className="mt-3 h-6 w-40 animate-pulse rounded-xl bg-line" />
          <div className="mt-6 rounded-2xl border border-line bg-card p-6 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0">
            <div className="h-4 w-36 animate-pulse rounded-xl bg-line" />
            <div className="mt-4">
              <FormSkeleton fields={3} />
            </div>
          </div>
        </SkeletonContainer>
      </div>
    </main>
  );
}
