import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

type MaxWidth = "content" | "wide" | "full"

const moduleMaxWidth: Record<MaxWidth, string> = {
  content: "max-w-[1240px]",
  wide: "max-w-[1480px]",
  full: "max-w-[1760px]",
}

function block(className?: string) {
  return cn("rounded-full bg-slate-100", className)
}

function SkeletonBlock({ className }: { className?: string }) {
  return <span aria-hidden="true" className={block(className)} />
}

function SkeletonPanel({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.055)]", className)}>
      {children}
    </section>
  )
}

function ModuleHeroSkeleton() {
  return (
    <SkeletonPanel className="rounded-[22px]">
      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <SkeletonBlock className="size-12 shrink-0 rounded-[16px] bg-blue-50 sm:size-14" />
          <div className="min-w-0 flex-1 space-y-3">
            <SkeletonBlock className="h-7 w-48 max-w-full sm:h-9" />
            <SkeletonBlock className="h-4 w-[min(34rem,100%)]" />
            <SkeletonBlock className="h-4 w-[min(26rem,85%)]" />
            <div className="flex flex-wrap gap-2 pt-1">
              <SkeletonBlock className="h-9 w-28 rounded-[14px]" />
              <SkeletonBlock className="h-9 w-32 rounded-[14px]" />
              <SkeletonBlock className="h-9 w-24 rounded-[14px]" />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <SkeletonBlock className="h-10 w-28 rounded-full" />
          <SkeletonBlock className="h-10 w-32 rounded-full bg-blue-50" />
        </div>
      </div>
    </SkeletonPanel>
  )
}

function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.045)]">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="mt-3 h-8 w-16" />
          <SkeletonBlock className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  )
}

function ToolbarSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-slate-200/80 bg-white/88 p-3 shadow-[0_10px_26px_rgba(15,23,42,0.045)] sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <SkeletonBlock className="h-5 w-44" />
      <div className="flex gap-2">
        <SkeletonBlock className="h-10 w-28 rounded-full" />
        <SkeletonBlock className="h-10 w-32 rounded-full bg-blue-50" />
      </div>
    </div>
  )
}

function TableRowsSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_120px_120px_96px] md:items-center">
          <div className="min-w-0 space-y-2">
            <SkeletonBlock className="h-4 w-[min(18rem,86%)]" />
            <SkeletonBlock className="h-3 w-[min(26rem,64%)]" />
          </div>
          <SkeletonBlock className="h-7 w-24 rounded-full" />
          <SkeletonBlock className="h-7 w-24 rounded-full" />
          <SkeletonBlock className="h-8 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function CardListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-[18px] border border-slate-200/80 bg-white/86 p-4">
          <div className="flex min-w-0 gap-4">
            <SkeletonBlock className="hidden h-16 w-16 shrink-0 rounded-[16px] sm:block" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap gap-2">
                <SkeletonBlock className="h-4 w-20" />
                <SkeletonBlock className="h-4 w-24" />
              </div>
              <SkeletonBlock className="h-5 w-[min(28rem,82%)]" />
              <SkeletonBlock className="h-4 w-[min(36rem,72%)]" />
              <div className="flex flex-wrap gap-2">
                <SkeletonBlock className="h-7 w-16 rounded-full bg-blue-50" />
                <SkeletonBlock className="h-7 w-20 rounded-full bg-blue-50" />
                <SkeletonBlock className="h-7 w-14 rounded-full bg-blue-50" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ModuleContentLoading({
  rows = 7,
  table = true,
}: {
  rows?: number
  table?: boolean
}) {
  return (
    <div className="animate-pulse" aria-busy="true">
      {table ? <TableRowsSkeleton rows={rows} /> : <div className="p-4 sm:p-5"><CardListSkeleton rows={rows} /></div>}
    </div>
  )
}

export function AdminContentLoading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true">
      <StatGridSkeleton count={4} />
      <SkeletonPanel>
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <TableRowsSkeleton rows={8} />
      </SkeletonPanel>
    </div>
  )
}

export function ModulePageLoading({
  maxWidth = "wide",
  stats = 4,
  rows = 7,
  rail = false,
  table = true,
}: {
  maxWidth?: MaxWidth
  stats?: number
  rows?: number
  rail?: boolean
  table?: boolean
}) {
  return (
    <div className="module-page min-h-[calc(100vh-3.5rem)] bg-[#f4f7fb] text-slate-950">
      <div className={cn("mx-auto w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-10 xl:px-14", moduleMaxWidth[maxWidth])}>
        <div className="animate-pulse space-y-5" aria-busy="true">
          <ModuleHeroSkeleton />
          <StatGridSkeleton count={stats} />
          <ToolbarSkeleton />
          <div className={cn("grid gap-4", rail && "lg:grid-cols-[260px_minmax(0,1fr)]")}>
            {rail ? (
              <aside className="hidden space-y-3 rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.045)] lg:block">
                {Array.from({ length: 6 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-10 rounded-[14px]" />
                ))}
              </aside>
            ) : null}
            <SkeletonPanel>
              <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
                <SkeletonBlock className="h-5 w-36" />
                <SkeletonBlock className="mt-2 h-4 w-64 max-w-full" />
              </div>
              {table ? <TableRowsSkeleton rows={rows} /> : <div className="p-4 sm:p-5"><CardListSkeleton rows={rows} /></div>}
            </SkeletonPanel>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ArticleListLoading() {
  return (
    <div className="module-page min-h-[calc(100vh-3.5rem)] bg-[#f4f7fb] text-slate-950">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-4 sm:px-6 sm:py-6 lg:px-10 xl:px-14">
        <div className="animate-pulse space-y-5" aria-busy="true">
          <ModuleHeroSkeleton />
          <StatGridSkeleton count={3} />
          <SkeletonPanel>
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
              <SkeletonBlock className="h-5 w-32" />
              <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
                  <SkeletonBlock className="h-4 w-24" />
                  <SkeletonBlock className="mt-3 h-5 w-32" />
                  <SkeletonBlock className="mt-2 h-4 w-20" />
                </div>
              ))}
            </div>
          </SkeletonPanel>
          <SkeletonPanel>
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
              <SkeletonBlock className="h-5 w-36" />
              <SkeletonBlock className="mt-2 h-4 w-80 max-w-full" />
            </div>
            <div className="p-4 sm:p-5">
              <CardListSkeleton rows={6} />
            </div>
          </SkeletonPanel>
        </div>
      </div>
    </div>
  )
}

export function ArticleReaderLoading() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#f7f9fc] px-4 py-5 text-slate-950 sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-[1500px] animate-pulse gap-5 xl:grid-cols-[240px_minmax(0,1fr)_260px]" aria-busy="true">
        <aside className="hidden space-y-3 rounded-[18px] border border-slate-200 bg-white p-4 xl:block">
          {Array.from({ length: 8 }).map((_, index) => <SkeletonBlock key={index} className="h-9 rounded-[12px]" />)}
        </aside>
        <article className="min-w-0 rounded-[22px] border border-slate-200 bg-white px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.06)] sm:px-8 sm:py-8">
          <div className="mb-8 flex items-center justify-between gap-3">
            <SkeletonBlock className="h-10 w-28 rounded-full" />
            <div className="flex gap-2">
              <SkeletonBlock className="h-10 w-24 rounded-full" />
              <SkeletonBlock className="h-10 w-24 rounded-full bg-blue-50" />
            </div>
          </div>
          <SkeletonBlock className="h-10 w-[min(40rem,90%)] rounded-[12px]" />
          <div className="mt-6 grid gap-3 rounded-[18px] border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => <SkeletonBlock key={index} className="h-5 rounded-[10px]" />)}
          </div>
          <div className="mt-8 space-y-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <SkeletonBlock key={index} className={cn("h-4 rounded-[8px]", index % 4 === 0 ? "w-[72%]" : index % 3 === 0 ? "w-[84%]" : "w-full")} />
            ))}
          </div>
        </article>
        <aside className="hidden space-y-3 rounded-[18px] border border-slate-200 bg-white p-4 xl:block">
          <SkeletonBlock className="h-5 w-24" />
          {Array.from({ length: 7 }).map((_, index) => <SkeletonBlock key={index} className="h-4 rounded-[8px]" />)}
        </aside>
      </div>
    </div>
  )
}

export function ArticleEditorLoading() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#f7f9fc] px-3 py-3 text-slate-950 sm:px-5 sm:py-5">
      <div className="mx-auto grid h-[calc(var(--app-viewport-height)-5.5rem)] max-w-[1760px] animate-pulse gap-4 lg:grid-cols-[280px_minmax(0,1fr)_280px]" aria-busy="true">
        <aside className="hidden rounded-[20px] border border-slate-200 bg-white p-4 lg:block">
          <SkeletonBlock className="mb-5 h-10 w-28 rounded-full" />
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, index) => <SkeletonBlock key={index} className="h-9 rounded-[12px]" />)}
          </div>
        </aside>
        <main className="min-w-0 overflow-hidden rounded-[20px] border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <SkeletonBlock className="h-10 w-36 rounded-full" />
            <div className="flex gap-2">
              <SkeletonBlock className="h-10 w-24 rounded-full" />
              <SkeletonBlock className="h-10 w-24 rounded-full bg-blue-50" />
            </div>
          </div>
          <div className="space-y-5 p-5 sm:p-8">
            <SkeletonBlock className="h-11 w-[min(36rem,90%)] rounded-[12px]" />
            <div className="grid gap-3 sm:grid-cols-3">
              <SkeletonBlock className="h-11 rounded-[12px]" />
              <SkeletonBlock className="h-11 rounded-[12px]" />
              <SkeletonBlock className="h-11 rounded-[12px]" />
            </div>
            <div className="space-y-3 rounded-[18px] border border-slate-100 bg-slate-50 p-4">
              {Array.from({ length: 12 }).map((_, index) => (
                <SkeletonBlock key={index} className={cn("h-4 rounded-[8px]", index % 5 === 0 ? "w-[58%]" : index % 3 === 0 ? "w-[78%]" : "w-full")} />
              ))}
            </div>
          </div>
        </main>
        <aside className="hidden rounded-[20px] border border-slate-200 bg-white p-4 lg:block">
          <SkeletonBlock className="mb-5 h-5 w-28" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, index) => <SkeletonBlock key={index} className="h-4 rounded-[8px]" />)}
          </div>
        </aside>
      </div>
    </div>
  )
}

export function ChatMessagesLoading({ rows = 7 }: { rows?: number }) {
  return (
    <div className="space-y-4 py-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => {
        const mine = index % 3 === 1
        return (
          <div key={index} className={cn("flex items-end gap-2", mine && "justify-end")}>
            {!mine ? <SkeletonBlock className="size-8 shrink-0 rounded-full" /> : null}
            <div className={cn("max-w-[72%] space-y-2 rounded-[18px] px-4 py-3", mine ? "bg-blue-50" : "bg-slate-100")}>
              <SkeletonBlock className={cn("h-3 bg-white/70", mine ? "w-36" : "w-48")} />
              <SkeletonBlock className={cn("h-3 bg-white/70", mine ? "w-24" : "w-32")} />
            </div>
            {mine ? <SkeletonBlock className="size-8 shrink-0 rounded-full" /> : null}
          </div>
        )
      })}
    </div>
  )
}

export function FriendsHubInnerLoading() {
  return (
    <div className="friends-hub-viewport mobile-chat-viewport flex h-full min-h-0 animate-pulse flex-col gap-4" aria-busy="true">
          <div className="hidden items-end justify-between gap-4 lg:flex">
            <div className="space-y-2">
              <SkeletonBlock className="h-9 w-56 rounded-[12px]" />
              <SkeletonBlock className="h-4 w-96 max-w-full" />
            </div>
            <div className="flex gap-2">
              <SkeletonBlock className="h-10 w-24 rounded-full" />
              <SkeletonBlock className="h-10 w-32 rounded-full" />
              <SkeletonBlock className="h-10 w-32 rounded-full bg-blue-100" />
            </div>
          </div>
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_320px]">
            <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
              <div className="shrink-0 border-b border-slate-100 p-4">
                <div className="mb-4 flex items-center justify-between lg:hidden">
                  <div className="space-y-2">
                    <SkeletonBlock className="h-6 w-32 rounded-[10px]" />
                    <SkeletonBlock className="h-3 w-40" />
                  </div>
                  <div className="flex gap-2">
                    <SkeletonBlock className="size-9 rounded-full" />
                    <SkeletonBlock className="size-9 rounded-full bg-blue-50" />
                  </div>
                </div>
                <SkeletonBlock className="h-10 rounded-full" />
                <div className="mt-3 grid grid-cols-4 gap-1 rounded-full bg-slate-100 p-1">
                  {Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} className="h-8 rounded-full bg-white/70" />)}
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-3">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3 rounded-[16px] px-3 py-3">
                    <SkeletonBlock className="size-11 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <SkeletonBlock className="h-4 w-36" />
                      <SkeletonBlock className="h-3 w-48 max-w-full" />
                    </div>
                    <SkeletonBlock className="h-5 w-10 rounded-full" />
                  </div>
                ))}
              </div>
            </aside>
            <section className="hidden h-full min-h-0 overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)] lg:flex lg:flex-col">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <SkeletonBlock className="size-10 rounded-full" />
                  <div className="space-y-2">
                    <SkeletonBlock className="h-4 w-36" />
                    <SkeletonBlock className="h-3 w-56" />
                  </div>
                </div>
                <SkeletonBlock className="h-8 w-24 rounded-full" />
              </div>
              <div className="min-h-0 flex-1 overflow-hidden px-4 py-4">
                <ChatMessagesLoading />
              </div>
              <div className="shrink-0 border-t border-slate-100 p-3">
                <SkeletonBlock className="h-12 rounded-[16px]" />
              </div>
            </section>
            <aside className="hidden h-full min-h-0 overflow-hidden rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)] xl:block">
              <SkeletonBlock className="mx-auto size-20 rounded-full" />
              <SkeletonBlock className="mx-auto mt-4 h-5 w-36" />
              <SkeletonBlock className="mx-auto mt-2 h-3 w-48" />
              <div className="mt-6 space-y-3">
                {Array.from({ length: 7 }).map((_, index) => <SkeletonBlock key={index} className="h-10 rounded-[14px]" />)}
              </div>
            </aside>
          </div>
    </div>
  )
}

export function FriendsHubLoading() {
  return (
    <div className="h-[calc(var(--app-viewport-height)-3.5rem)] min-h-0 overflow-hidden bg-[#eef3f8] px-3 py-4 sm:px-4 lg:px-8 lg:py-6 xl:px-12">
      <div className="mx-auto h-full min-h-0 max-w-[1760px]">
        <FriendsHubInnerLoading />
      </div>
    </div>
  )
}

export function AIChatLoading() {
  return (
    <div className="soulwing-chat-page mobile-chat-viewport h-[calc(var(--app-viewport-height)-3.5rem)] overflow-hidden bg-[#f4f7fb] text-slate-950 md:h-[calc(100vh-3.5rem)]">
      <div className="mx-auto flex h-full w-full max-w-[1760px] animate-pulse flex-col px-0 py-0 sm:px-4 md:px-6 md:pb-5 md:pt-4 xl:px-8" aria-busy="true">
        <div className="grid min-h-0 flex-1 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="hidden min-h-0 border-r border-slate-100 p-4 lg:block">
            <SkeletonBlock className="h-11 rounded-full" />
            <div className="mt-5 space-y-2">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="rounded-[16px] border border-slate-100 p-3">
                  <SkeletonBlock className="h-4 w-44" />
                  <SkeletonBlock className="mt-2 h-3 w-32" />
                </div>
              ))}
            </div>
          </aside>
          <main className="flex min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <SkeletonBlock className="size-10 rounded-full bg-blue-50" />
                <div className="space-y-2">
                  <SkeletonBlock className="h-4 w-40" />
                  <SkeletonBlock className="h-3 w-60 max-w-full" />
                </div>
              </div>
              <SkeletonBlock className="h-9 w-28 rounded-full" />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden px-4 py-5 sm:px-6 lg:px-8">
              <ChatMessagesLoading rows={6} />
            </div>
            <div className="shrink-0 border-t border-slate-100 p-3 sm:p-4">
              <SkeletonBlock className="h-14 rounded-[18px]" />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export function SqlLabLoading() {
  return (
    <div className="sql-lab-viewport sql-lab-cockpit mx-auto flex h-[calc(var(--app-viewport-height)-3.5rem)] max-w-[1780px] flex-col overflow-hidden px-2 pb-2 pt-2 sm:px-3 md:px-5">
      <div className="animate-pulse" aria-busy="true">
        <div className="mb-2 flex min-h-16 items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-white px-4 shadow-sm">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="size-10 rounded-[12px] bg-blue-50" />
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-5 w-48" />
            </div>
          </div>
          <div className="hidden gap-2 lg:flex">
            {Array.from({ length: 5 }).map((_, index) => <SkeletonBlock key={index} className="h-9 w-28 rounded-full" />)}
          </div>
        </div>
        <main className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="hidden rounded-[18px] border border-slate-200 bg-white p-3 lg:block">
            <SkeletonBlock className="h-10 rounded-[12px]" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 12 }).map((_, index) => <SkeletonBlock key={index} className="h-8 rounded-[10px]" />)}
            </div>
          </aside>
          <section className="min-h-0 rounded-[18px] border border-slate-200 bg-white p-4">
            <div className="space-y-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="rounded-[16px] border border-slate-100 bg-slate-50 p-4">
                  <SkeletonBlock className="h-4 w-48" />
                  <SkeletonBlock className="mt-3 h-3 w-full" />
                  <SkeletonBlock className="mt-2 h-3 w-[72%]" />
                </div>
              ))}
            </div>
          </section>
          <aside className="hidden rounded-[18px] border border-slate-200 bg-white p-3 lg:block">
            <SkeletonBlock className="h-10 rounded-[12px]" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 8 }).map((_, index) => <SkeletonBlock key={index} className="h-9 rounded-[10px]" />)}
            </div>
          </aside>
        </main>
      </div>
    </div>
  )
}

export function AdminLoading() {
  return (
    <main className="min-h-screen bg-[#f3f7fb] text-slate-950">
      <div className="mx-auto w-full max-w-[1760px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="animate-pulse space-y-5" aria-busy="true">
          <header className="rounded-[22px] border border-white/80 bg-white/92 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70 md:p-6">
            <SkeletonBlock className="h-4 w-32 bg-blue-50" />
            <SkeletonBlock className="mt-3 h-8 w-52 rounded-[12px]" />
            <SkeletonBlock className="mt-3 h-4 w-[min(46rem,100%)]" />
          </header>
          <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="rounded-[22px] border border-white/80 bg-white/92 p-2 shadow-[0_16px_45px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/70">
              <div className="flex gap-2 overflow-hidden xl:block xl:space-y-1">
                {Array.from({ length: 7 }).map((_, index) => <SkeletonBlock key={index} className="h-12 min-w-36 rounded-[16px]" />)}
              </div>
            </aside>
            <section className="min-w-0 space-y-5">
              <StatGridSkeleton count={4} />
              <SkeletonPanel>
                <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
                  <SkeletonBlock className="h-5 w-40" />
                  <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
                </div>
                <TableRowsSkeleton rows={8} />
              </SkeletonPanel>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
