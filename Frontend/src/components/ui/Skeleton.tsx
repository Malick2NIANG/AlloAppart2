export function SkeletonLine({ width = '100%' }: { width?: string }) {
  return (
    <div
      className="animate-pulse rounded-xl bg-line"
      style={{ width, height: '16px' }}
    />
  );
}

export function SkeletonCard({ height = '80px' }: { height?: string }) {
  return (
    <div
      className="w-full animate-pulse rounded-xl bg-line"
      style={{ height }}
    />
  );
}

export function SkeletonListRow() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-card p-4">
      <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-line" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded-xl bg-line" />
        <div className="h-3 w-1/2 animate-pulse rounded-xl bg-line" />
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="mb-4 h-10 w-10 animate-pulse rounded-xl bg-line" />
      <div className="mb-2 h-7 w-1/2 animate-pulse rounded-xl bg-line" />
      <div className="h-4 w-3/4 animate-pulse rounded-xl bg-line" />
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3">
      <div className="h-4 flex-[2] animate-pulse rounded-xl bg-line" />
      <div className="h-4 flex-[2] animate-pulse rounded-xl bg-line" />
      <div className="h-4 flex-1 animate-pulse rounded-xl bg-line" />
      <div className="h-4 flex-1 animate-pulse rounded-xl bg-line" />
    </div>
  );
}
