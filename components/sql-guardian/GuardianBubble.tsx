"use client"

import type { CSSProperties } from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  GuardianBubblePlacement,
  GuardianDockMode,
  GuardianProfile,
  GuardianProgress,
  GuardianVisualState,
} from "@/lib/sql-guardian/types"

type GuardianBubbleProps = {
  profile: GuardianProfile
  progress?: GuardianProgress
  message: string
  visualState: GuardianVisualState
  onClose: () => void
  placement?: GuardianBubblePlacement
  dockMode?: GuardianDockMode
  maxWidth?: number
  isSqlLab?: boolean
  className?: string
}

export function GuardianBubble({
  profile,
  progress,
  message,
  visualState,
  onClose,
  placement = "above-left",
  dockMode = "floating",
  maxWidth = 340,
  isSqlLab = false,
  className,
}: GuardianBubbleProps) {
  const compact = placement === "compact" || dockMode === "compact" || dockMode === "minimized"
  const progressPercent = progress ? Math.max(0, Math.min(100, Math.round(progress.progress * 100))) : null
  const currentExp = profile.exp ?? 0
  const style = {
    width: `min(${maxWidth}px, calc(100vw - ${compact ? "1.5rem" : "2rem"}))`,
  } satisfies CSSProperties

  return (
    <div
      className={cn(
        "pointer-events-auto rounded-md border border-[--color-border] bg-[--color-bg-surface]/95 text-[--color-text-primary] shadow-[0_12px_28px_rgba(15,23,42,0.11)] backdrop-blur-sm",
        compact ? "p-2.5" : "p-3",
        isSqlLab ? "shadow-[0_10px_22px_rgba(15,23,42,0.09)]" : "",
        className
      )}
      style={style}
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
            <span className={cn("font-mono text-[9px] text-[--color-text-muted]", compact ? "hidden" : "")}>
              {visualState}
            </span>
          </div>
          <div className={cn("mt-0.5 truncate font-mono text-[9px] text-[--color-text-muted]", compact ? "max-w-[150px]" : "max-w-[230px]")}>
            {profile.title}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[--color-text-muted] opacity-60 transition hover:bg-[--color-bg-hover] hover:text-[--color-text-primary] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand] motion-reduce:transition-none"
          aria-label="关闭 SQL Guardian 气泡"
          title="关闭"
        >
          <X size={14} />
        </button>
      </div>
      <p
        className={cn(
          "mt-2 overflow-hidden",
          compact ? "max-h-10 text-xs leading-5" : isSqlLab ? "text-[13px] leading-5" : "text-sm leading-6"
        )}
      >
        {message}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-cyan-100">
          <div
            className="h-full rounded-full bg-cyan-400/70 transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${progressPercent ?? 12}%` }}
          />
        </div>
        {progress ? (
          <span className={cn("font-mono text-[9px] text-[--color-text-muted]", compact ? "hidden" : "")}>
            EXP {currentExp}/{progress.nextLevelExp}
          </span>
        ) : null}
      </div>
    </div>
  )
}
