import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { FRIEND_MODULE_NAV_KEYS, type FriendModuleNavKey } from "@/lib/friend-module-nav"

const MODULE_LABEL: Record<FriendModuleNavKey, string> = {
  resume: "简历",
  blog: "博客",
  daily: "日常",
  reflections: "心得",
  notes: "笔记",
  jobs: "求职",
  interviews: "面试",
}

function moduleLinkClass(active: boolean) {
  return `inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium leading-none transition-all duration-200 hover:no-underline ${
    active
      ? "bg-[--color-brand] text-white shadow-[0_8px_20px_rgba(37,99,235,0.2)]"
      : "border border-[--color-border] bg-white/58 text-[--color-text-secondary] hover:border-[--color-brand-border] hover:bg-[--color-brand-soft] hover:text-[--color-brand]"
  }`
}

export function FriendModuleNav({
  ownerId,
  ownerRef,
  displayName,
  current,
  modules,
}: {
  ownerId: string
  ownerRef?: string
  displayName: string
  current: FriendModuleNavKey
  modules: Record<FriendModuleNavKey, boolean>
}) {
  const visibleModules = FRIEND_MODULE_NAV_KEYS.filter((module) => modules[module])
  const publicRef = ownerRef ?? ownerId

  return (
    <nav className="mb-5 flex max-w-full items-center gap-2 overflow-x-auto rounded-[22px] border border-[--color-border] bg-[--color-bg-surface-glass] p-2 text-sm shadow-[--shadow-profile-card] backdrop-blur-xl">
      <Link
        href={`/u/${publicRef}`}
        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-[--color-text-secondary] transition-all duration-200 hover:bg-[--color-brand-soft] hover:text-[--color-brand] hover:no-underline"
      >
        <ArrowLeft size={13} /> {displayName}
      </Link>
      {visibleModules.map((module) => (
        <Link
          key={module}
          href={`/u/${publicRef}/${module}`}
          className={moduleLinkClass(module === current)}
          aria-current={module === current ? "page" : undefined}
        >
          {MODULE_LABEL[module]}
        </Link>
      ))}
    </nav>
  )
}

export function FriendModuleLinks({
  ownerId,
  ownerRef,
  current,
  modules,
}: {
  ownerId: string
  ownerRef?: string
  current: FriendModuleNavKey
  modules: Record<FriendModuleNavKey, boolean>
}) {
  const publicRef = ownerRef ?? ownerId

  return (
    <div className="flex flex-wrap items-center gap-2">
      {FRIEND_MODULE_NAV_KEYS.filter((module) => modules[module]).map((module) => (
        <Link
          key={module}
          href={`/u/${publicRef}/${module}`}
          className={moduleLinkClass(module === current)}
          aria-current={module === current ? "page" : undefined}
        >
          {MODULE_LABEL[module]}
        </Link>
      ))}
    </div>
  )
}
