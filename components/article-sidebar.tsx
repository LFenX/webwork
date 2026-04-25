import { Mail, MapPin } from "lucide-react"
import type { CreatorProfile } from "@/lib/profile"
import { UserAvatar } from "@/components/user-avatar"

type TocItem = {
  id: string
  text: string
  level: number
}

export function slugHeading(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 80)
}

export function extractToc(markdown: string): TocItem[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^(#{1,3})\s+(.+)$/)
      if (!match) return null
      const text = match[2].replace(/[*_`[\]()]/g, "").trim()
      return { id: slugHeading(text), text, level: match[1].length }
    })
    .filter(Boolean) as TocItem[]
}

export function CreatorCard({ profile }: { profile: CreatorProfile }) {
  const name = profile.displayName || profile.email

  return (
    <section className="flex flex-col items-center rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-5 text-center shadow-sm">
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
        <div className="flex max-w-full items-center justify-center gap-2 break-all">
          <Mail size={13} /> {profile.email}
        </div>
        {profile.location && (
          <div className="flex items-center justify-center gap-2">
            <MapPin size={13} /> {profile.location}
          </div>
        )}
      </div>
    </section>
  )
}

export function TocCard({ content, dict }: { content: string; dict?: { toc: string; noHeadings: string } }) {
  const toc = extractToc(content)
  return (
    <section className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{dict?.toc ?? "目录"}</h2>
        <span className="text-xs text-[--color-text-muted]">{toc.length}</span>
      </div>
      {toc.length === 0 ? (
        <p className="text-xs text-[--color-text-muted]">{dict?.noHeadings ?? "暂无标题"}</p>
      ) : (
        <nav className="space-y-2">
          {toc.map((item, index) => (
            <a
              key={`${item.id}-${index}`}
              href={`#${item.id}`}
              className="block truncate text-xs text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline"
              style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
            >
              {item.text}
            </a>
          ))}
        </nav>
      )}
    </section>
  )
}

export function ArticleAside({ profile, content, dict }: { profile: CreatorProfile; content: string; dict?: { toc: string; noHeadings: string } }) {
  return (
    <aside className="mt-6 space-y-4 lg:fixed lg:bottom-6 lg:right-[max(1.5rem,calc((100vw-1360px)/2+1.5rem))] lg:top-20 lg:mt-0 lg:w-[300px] lg:overflow-y-auto">
      <CreatorCard profile={profile} />
      <TocCard content={content} dict={dict} />
    </aside>
  )
}
