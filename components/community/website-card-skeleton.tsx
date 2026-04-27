export function WebsiteCardSkeleton() {
  return (
    <div className="animate-pulse rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] overflow-hidden">
      <div className="aspect-[16/9] bg-[--color-bg-hover]" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-3/4 rounded bg-[--color-bg-hover]" />
        <div className="h-3 w-1/2 rounded bg-[--color-bg-hover]" />
        <div className="h-3 w-full rounded bg-[--color-bg-hover]" />
        <div className="h-3 w-2/3 rounded bg-[--color-bg-hover]" />
        <div className="flex gap-1.5">
          <div className="h-5 w-14 rounded-full bg-[--color-bg-hover]" />
          <div className="h-5 w-12 rounded-full bg-[--color-bg-hover]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-[--color-bg-hover]" />
          <div className="h-3 w-16 rounded bg-[--color-bg-hover]" />
        </div>
      </div>
    </div>
  )
}
