import { getTranslations } from 'next-intl/server';
import { SkeletonContainer } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16 max-md:min-h-dvh max-md:py-10">
      <SkeletonContainer label={t('loading')} className="w-full max-w-lg">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 h-16 w-16 animate-pulse rounded-full bg-line" />
          <div className="mx-auto h-7 w-48 animate-pulse rounded-xl bg-line" />
          <div className="mx-auto mt-3 h-4 w-64 animate-pulse rounded-xl bg-line" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="w-full rounded-2xl border border-line bg-card p-5">
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-line" />
                <div className="flex-1">
                  <div className="h-4 w-32 animate-pulse rounded-xl bg-line" />
                  <div className="mt-2 h-3.5 w-full animate-pulse rounded-xl bg-line" />
                </div>
                <div className="mt-0.5 h-5 w-5 shrink-0 animate-pulse rounded-full bg-line" />
              </div>
            </div>
          ))}
        </div>
      </SkeletonContainer>
    </main>
  );
}
