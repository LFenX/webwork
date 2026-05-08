"use client"

import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { GuardianProfile, GuardianVisualState } from "@/lib/sql-guardian/types"

type GuardianBubbleProps = {
  profile: GuardianProfile
  message: string
  visualState: GuardianVisualState
  onClose: () => void
  className?: string
}

export function GuardianBubble({ profile, message, visualState, onClose, className }: GuardianBubbleProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto max-w-[280px] rounded-md border border-[--color-border] bg-[--color-bg-surface] p-3 text-[--color-text-primary] shadow-[0_18px_45px_rgba(15,23,42,0.14)]",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold">{profile.name}</span>
            <Badge variant="secondary" className="px-2 py-0 font-mono text-[9px]">
              Lv.{profile.level}
            </Badge>
            <span className="font-mono text-[9px] text-[--color-text-muted]">{visualState}</span>
          </div>
          <div className="mt-0.5 truncate font-mono text-[9px] text-[--color-text-muted]">{profile.title}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[--color-text-muted] transition hover:bg-[--color-bg-hover] hover:text-[--color-text-primary] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]"
          aria-label="关闭 SQL Guardian 气泡"
          title="关闭"
        >
          <X size={14} />
        </button>
      </div>
      <p className="mt-2 text-sm leading-6">{message}</p>
      <div className="mt-2 h-1 w-12 rounded-full bg-cyan-300/60" />
    </div>
  )
}
