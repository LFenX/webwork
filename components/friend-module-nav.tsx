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
  return `inline-flex h-7 items-center border-b px-0.5 text-sm leading-none transition-colors hover:text-[--color-link] hover:no-underline ${
    active
      ? "border-[--color-link] text-[--color-text-secondary]"
      : "border-transparent text-[--color-text-secondary]"
  }`
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
    <nav className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <Link
        href={`/u/${ownerId}`}
        className="inline-flex h-7 items-center gap-1.5 border-b border-transparent px-0.5 text-[--color-text-secondary] transition-colors hover:text-[--color-link] hover:no-underline"
      >
        <ArrowLeft size={13} /> {displayName}
      </Link>
      {visibleModules.map((module) => (
        <Link
          key={module}
          href={`/u/${ownerId}/${module}`}
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
  current,
  modules,
}: {
  ownerId: string
  current: FriendModuleNavKey
  modules: Record<FriendModuleNavKey, boolean>
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {FRIEND_MODULE_NAV_KEYS.filter((module) => modules[module]).map((module) => (
        <Link
          key={module}
          href={`/u/${ownerId}/${module}`}
          className={moduleLinkClass(module === current)}
          aria-current={module === current ? "page" : undefined}
        >
          {MODULE_LABEL[module]}
        </Link>
      ))}
    </div>
  )
}
