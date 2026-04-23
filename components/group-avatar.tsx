"use client"

type GroupAvatarMember = {
  id: string
  email?: string | null
  displayName?: string | null
  avatarText?: string | null
  avatarUrl?: string | null
}

type GroupAvatarProps = {
  members: GroupAvatarMember[]
  name?: string
  size?: "sm" | "md"
  className?: string
}

const SIZE_CLASS = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
}

function fallbackText(member: GroupAvatarMember) {
  const source = member.avatarText || member.displayName || member.email || "群"
  return Array.from(source.trim()).slice(0, 1).join("").toUpperCase() || "群"
}

export function GroupAvatar({ members, name = "群聊", size = "md", className = "" }: GroupAvatarProps) {
  const visible = members.slice(0, 9)
  const count = Math.max(1, visible.length)
  const grid = count <= 1 ? "grid-cols-1" : count <= 4 ? "grid-cols-2" : "grid-cols-3"

  return (
    <div className={`${SIZE_CLASS[size]} shrink-0 overflow-hidden rounded-[5px] border border-[--color-border] bg-[#d8d8d8] p-0.5 ${className}`} aria-label={`${name}头像`}>
      <div className={`grid h-full w-full ${grid} gap-0.5`}>
        {visible.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center rounded-[3px] bg-[--color-bg-hover] text-xs font-semibold text-[--color-text-primary]">群</div>
        ) : visible.map((member) => (
          <div key={member.id} className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-[3px] bg-[--color-bg-hover] text-[10px] font-semibold text-[--color-text-primary]">
            {member.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.avatarUrl} alt={member.displayName || member.email || name} className="h-full w-full object-cover" />
            ) : (
              fallbackText(member)
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
