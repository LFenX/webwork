"use client"

import { useEffect, useState } from "react"
import { Mail, MapPin } from "lucide-react"
import type { CreatorProfile } from "@/lib/profile"
import { UserAvatar } from "@/components/user-avatar"
import { cn } from "@/lib/utils"
import { extractToc } from "@/lib/toc"

export function CreatorCard({ profile, compact = false }: { profile: CreatorProfile; compact?: boolean }) {
  const name = profile.displayName || profile.email || "User"

  return (
    <section className={cn(
      "flex flex-col items-center rounded-lg border border-[--color-border] bg-[--color-bg-surface] text-center",
      compact ? "p-4 shadow-none" : "p-5 shadow-sm"
    )}>
      <UserAvatar
        size="lg"
        name={name}
        email={profile.email}
        avatarText={profile.avatarText}
        avatarUrl={profile.avatarUrl}
        className="mx-auto mb-3"
      />
      <h2 className="text-base font-semibold">{name}</h2>
      {profile.bio && <p className="mt-1 text-xs leading-5 text-[--color-text-muted]">{profile.bio}</p>}
      <div className="mt-4 flex w-full flex-col items-center gap-2 text-center text-xs text-[--color-text-muted]">
        {profile.email ? (
          <div className="flex max-w-full items-center justify-center gap-2 break-all">
            <Mail size={13} /> {profile.email}
          </div>
        ) : null}
        {profile.location && (
          <div className="flex items-center justify-center gap-2">
            <MapPin size={13} /> {profile.location}
          </div>
        )}
      </div>
    </section>
  )
}

export function TocCard({ content, dict, compact = false }: { content: string; dict?: { toc: string; noHeadings: string }; compact?: boolean }) {
  const toc = extractToc(content)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (toc.length === 0) return
    const elements = toc
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el != null)
    if (elements.length === 0) return

    // Pick the heading whose top is just above the 35% mark of the viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) {
          setActiveId(visible[0].target.id)
          return
        }
        // No headings currently visible — keep highest one above viewport.
        const above = entries
          .filter((entry) => entry.boundingClientRect.top < 0)
          .sort((a, b) => b.boundingClientRect.top - a.boundingClientRect.top)
        if (above[0]) setActiveId(above[0].target.id)
      },
      { rootMargin: "-15% 0px -55% 0px", threshold: [0, 1] }
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [toc])

  return (
    <section className={cn(
      "rounded-lg border border-[--color-border] bg-[--color-bg-surface]",
      compact ? "p-4 shadow-none" : "p-5 shadow-sm"
    )}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{dict?.toc ?? "目录"}</h2>
        <span className="text-xs text-[--color-text-muted]">{toc.length}</span>
      </div>
      {toc.length === 0 ? (
        <p className="text-xs text-[--color-text-muted]">{dict?.noHeadings ?? "暂无标题"}</p>
      ) : (
        <nav className="space-y-1">
          {toc.map((item, index) => {
            const active = item.id === activeId
            return (
              <a
                key={`${item.id}-${index}`}
                href={`#${item.id}`}
                className={cn(
                  "relative block truncate rounded text-xs transition-colors hover:no-underline",
                  active
                    ? "text-[--color-text-primary] font-medium"
                    : "text-[--color-text-muted] hover:text-[--color-text-primary]"
                )}
                style={{ paddingLeft: `${(item.level - 1) * 12 + 10}px`, paddingTop: 4, paddingBottom: 4 }}
              >
                {active ? (
                  <span aria-hidden="true" className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded bg-[--color-accent]" />
                ) : null}
                {item.text}
              </a>
            )
          })}
        </nav>
      )}
    </section>
  )
}

export function ArticleAside({
  profile,
  content,
  dict,
  mode = "floating",
}: {
  profile: CreatorProfile
  content: string
  dict?: { toc: string; noHeadings: string }
  mode?: "floating" | "rail" | "stack"
}) {
  const compact = mode !== "floating"

  return (
    <aside
      className={cn(
        "space-y-3",
        mode === "floating" && "mt-6 lg:fixed lg:bottom-6 lg:right-[max(1.5rem,calc((100vw-1360px)/2+1.5rem))] lg:top-20 lg:mt-0 lg:w-[300px] lg:overflow-y-auto",
        mode === "rail" && "article-workspace-aside",
        mode === "stack" && "w-full"
      )}
    >
      <CreatorCard profile={profile} compact={compact} />
      <TocCard content={content} dict={dict} compact={compact} />
    </aside>
  )
}
