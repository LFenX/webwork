"use client"

import { Compass, Minimize2, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type GuardianControlsProps = {
  onThink: () => void
  onSleep: () => void
  onMinimize: () => void
  className?: string
}

export function GuardianControls({ onThink, onSleep, onMinimize, className }: GuardianControlsProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-1 rounded-full border border-[--color-border] bg-[--color-bg-surface] p-1 shadow-[0_10px_28px_rgba(15,23,42,0.12)]",
        className
      )}
    >
      <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onThink} aria-label="让 SQL Guardian 思考" title="思考">
        <Compass data-icon="inline-start" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onSleep} aria-label="让 SQL Guardian 睡眠" title="睡眠">
        <Moon data-icon="inline-start" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onMinimize} aria-label="最小化 SQL Guardian" title="最小化">
        <Minimize2 data-icon="inline-start" />
      </Button>
    </div>
  )
}
