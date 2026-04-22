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

export function FriendModuleNav({
  ownerId,
  displayName,
  current,
  modules,
}: {
  ownerId: string
  displayName: string
  current: FriendModuleNavKey
  modules: Record<FriendModuleNavKey, boolean>
}) {
  const visibleModules = FRIEND_MODULE_NAV_KEYS.filter((module) => modules[module])

  return (
    <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm">
      <Link
        href={`/u/${ownerId}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-[--radius-sm] border border-[--color-border] px-3 text-[--color-text-muted] transition-colors hover:border-[--color-border-strong] hover:text-[--color-text-primary] hover:no-underline"
      >
        <ArrowLeft size={13} /> {displayName}
      </Link>
      {visibleModules.map((module) => (
        <Link
          key={module}
          href={`/u/${ownerId}/${module}`}
          className={`inline-flex h-8 items-center rounded-[--radius-sm] border px-3 transition-colors hover:no-underline ${
            module === current
              ? "border-[#111827] bg-[#111827] text-white"
              : "border-[--color-border] text-[--color-text-secondary] hover:border-[--color-border-strong] hover:bg-[--color-bg-hover]"
          }`}
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
  current,
  modules,
}: {
  ownerId: string
  current: FriendModuleNavKey
  modules: Record<FriendModuleNavKey, boolean>
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {FRIEND_MODULE_NAV_KEYS.filter((module) => modules[module]).map((module) => (
        <Link
          key={module}
          href={`/u/${ownerId}/${module}`}
          className={`inline-flex h-8 items-center rounded-[--radius-sm] border px-3 text-sm transition-colors hover:no-underline ${
            module === current
              ? "border-[#111827] bg-[#111827] text-white"
              : "border-[--color-border] text-[--color-text-secondary] hover:border-[--color-border-strong] hover:bg-[--color-bg-hover]"
          }`}
          aria-current={module === current ? "page" : undefined}
        >
          {MODULE_LABEL[module]}
        </Link>
      ))}
    </div>
  )
}
