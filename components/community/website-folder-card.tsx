import Link from "next/link"
import { FolderInput } from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"

interface Props {
  folder: {
    id: string
    name: string
    userId: string
    description?: string
    _count?: { websites: number }
    user?: {
      id: string
      displayName: string
      email: string
      avatarText: string
      avatarUrl: string | null
    } | null
  }
}

export function WebsiteFolderCard({ folder }: Props) {
  return (
    <Link
      href={`/community/resources/websites/folders/${folder.id}`}
      prefetch={false}
      className="group block rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-4 transition-all duration-200 hover:border-[--color-border-strong] hover:shadow-[--shadow-sm] hover:-translate-y-0.5 hover:no-underline"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[--color-bg-hover]">
          <FolderInput size={18} className="text-[--color-text-secondary]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[--color-text-primary] truncate">{folder.name}</p>
          <p className="text-xs text-[--color-text-muted]">
            {folder._count?.websites ?? 0} 个网站
            {folder.user && (
              <span className="ml-1">· {folder.user.displayName || folder.user.email}</span>
            )}
          </p>
        </div>
      </div>
    </Link>
  )
}
