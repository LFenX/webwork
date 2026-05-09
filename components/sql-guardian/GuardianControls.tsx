"use client"

import { Compass, Minimize2, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { GuardianProfile } from "@/lib/sql-guardian/types"

type GuardianControlsProps = {
  onThink: () => void
  onSleep: () => void
  onMinimize: () => void
  profile?: GuardianProfile
  mode?: "full" | "minimal"
  className?: string
}

export function GuardianControls({
  onThink,
  onSleep,
  onMinimize,
  profile,
  mode = "full",
  className,
}: GuardianControlsProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-0.5 rounded-full border border-[--color-border] bg-[--color-bg-surface]/95 p-1 opacity-0 shadow-[0_8px_20px_rgba(15,23,42,0.09)] backdrop-blur-sm transition-opacity group-hover/guardian:opacity-75 hover:opacity-100 focus-within:opacity-100 motion-reduce:transition-none",
        mode === "minimal" ? "scale-95" : "",
        className
      )}
    >
      {profile ? (
        <span className={cn("max-w-28 truncate px-2 font-mono text-[10px] text-[--color-text-muted]", mode === "minimal" ? "hidden" : "")}>
          {profile.name} · Lv.{profile.level}
        </span>
      ) : null}
      {mode === "full" ? (
        <>
          <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onThink} aria-label="让 SQL Guardian 思考" title="思考">
            <Compass data-icon="inline-start" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onSleep} aria-label="让 SQL Guardian 睡眠" title="睡眠">
            <Moon data-icon="inline-start" />
          </Button>
        </>
      ) : null}
      <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onMinimize} aria-label="最小化 SQL Guardian" title="最小化">
        <Minimize2 data-icon="inline-start" />
      </Button>
    </div>
  )
}
