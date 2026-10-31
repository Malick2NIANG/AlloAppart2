import { getTranslations } from 'next-intl/server';
import { SkeletonContainer, FormSkeleton } from '@/components/ui/Skeleton';

export default async function Loading() {
  const t = await getTranslations('skeleton');
  return (
    <main className="py-10 px-4 bg-bg min-h-screen max-md:min-h-dvh max-md:flex max-md:flex-col max-md:px-0 max-md:py-0">
      <div className="aa-container max-w-2xl max-md:flex max-md:flex-1 max-md:flex-col">
        <SkeletonContainer label={t('loading')} className="max-md:flex max-md:flex-1 max-md:flex-col">

          {/* Breadcrumb + titre — desktop uniquement, même agencement que la page réelle */}
          <div className="max-md:hidden">
            <div className="mb-6 h-3.5 w-40 animate-pulse rounded-xl bg-line" />
            <div className="mb-6 h-7 w-56 animate-pulse rounded-xl bg-line" />
          </div>

          {/* En-tête compact mobile — même hauteur que MobileStepperBar (md:hidden) */}
          <div className="sticky top-0 z-40 border-b border-line bg-card/95 pt-[calc(var(--safe-top,0)+0.625rem)] pb-2.5 md:hidden">
            <div className="flex items-center gap-2.5">
              <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-line" />
              <div className="min-w-0 flex-1">
                <div className="h-2.5 w-20 animate-pulse rounded bg-line" />
                <div className="mt-1.5 h-4 w-32 animate-pulse rounded bg-line" />
              </div>
            </div>
            <div className="mt-2 h-1 w-full animate-pulse rounded-full bg-line" />
          </div>

          {/* Indicateur d'étapes — desktop uniquement */}
          <div className="mt-6 max-md:hidden">
            <div className="h-10 w-full animate-pulse rounded-full bg-line" />
          </div>

          <div className="mt-8 rounded-2xl border border-line bg-card p-6 max-md:mt-3 max-md:flex-1 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0">
            <FormSkeleton fields={5} />
          </div>
        </SkeletonContainer>
      </div>
    </main>
  );
}
