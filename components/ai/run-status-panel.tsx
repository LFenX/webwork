"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Loader2, ArrowRight, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Dictionary } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export type RunStatusPanelData = {
  status: string
  phaseLabel: string
  toolCount: number
  filledCount?: number
  totalCount?: number
  durationMs: number
  // The run lives in the conversation the user is currently viewing. The parent
  // only mounts this panel when false, so the bubble is purely a cross-
  // conversation affordance.
  isCurrentConversation: boolean
}

// Distance (px) from the right/top viewport edges. Module-level so the user's
// dragged position survives the bubble being hidden and shown again within a
// session (e.g. switching back and forth between conversations).
let savedPos: { right: number; top: number } | null = null
const BUBBLE_SIZE = 48

function formatDuration(ms: number) {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function clampPos(p: { right: number; top: number }) {
  if (typeof window === "undefined") return p
  const maxRight = Math.max(4, window.innerWidth - BUBBLE_SIZE - 4)
  const maxTop = Math.max(4, window.innerHeight - BUBBLE_SIZE - 4)
  return {
    right: Math.min(Math.max(4, p.right), maxRight),
    top: Math.min(Math.max(4, p.top), maxTop),
  }
}

// A draggable floating bubble for a task running in ANOTHER conversation. It sits
// as a small ball (spinner) and expands into the full status bar on hover; the
// bar's actions jump back to the task or stop it. Right-anchored so it expands
// leftward and never overflows the viewport edge.
export function RunStatusPanel({
  dict,
  data,
  onJump,
  onStop,
}: {
  dict: Dictionary
  data: RunStatusPanelData
  onJump: () => void
  onStop: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false) // toggled open by tap/click (esp. touch)
  const [dragging, setDragging] = useState(false)
  const [pos, setPos] = useState<{ right: number; top: number }>(() => savedPos ?? { right: 24, top: 140 })

  const ballRef = useRef<HTMLDivElement | null>(null)
  const grabRef = useRef<{ offsetRight: number; offsetTop: number; downX: number; downY: number } | null>(null)
  const movedRef = useRef(false)

  useEffect(() => {
    setMounted(true)
    setPos((p) => clampPos(p)) // restore into the current viewport
  }, [])

  useEffect(() => { savedPos = pos }, [pos])

  useEffect(() => {
    if (!dragging) return
    const handleMove = (event: PointerEvent) => {
      const grab = grabRef.current
      if (!grab) return
      if (Math.abs(event.clientX - grab.downX) > 4 || Math.abs(event.clientY - grab.downY) > 4) {
        movedRef.current = true
      }
      setPos(clampPos({
        right: window.innerWidth - event.clientX - grab.offsetRight,
        top: event.clientY - grab.offsetTop,
      }))
    }
    const handleUp = () => { grabRef.current = null; setDragging(false) }
    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
    }
  }, [dragging])

  function startDrag(event: React.PointerEvent) {
    const rect = ballRef.current?.getBoundingClientRect()
    if (!rect) return
    grabRef.current = {
      offsetRight: rect.right - event.clientX,
      offsetTop: event.clientY - rect.top,
      downX: event.clientX,
      downY: event.clientY,
    }
    movedRef.current = false
    setDragging(true)
  }

  // A genuine click (no drag movement) toggles the expanded state — the tap path
  // for touch devices, and a click-to-pin on desktop.
  function handleBallClick() {
    if (movedRef.current) return
    setPinned((value) => !value)
  }

  if (!mounted) return null

  const expanded = (hovered || pinned) && !dragging
  const cancelling = data.status === "cancelling"
  const hasSections = typeof data.totalCount === "number" && data.totalCount > 0

  return createPortal(
    <div
      className="fixed z-[100] select-none"
      style={{ right: pos.right, top: pos.top }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={cn(
          "flex items-center justify-end gap-3 rounded-full border border-blue-200 bg-white/95 shadow-lg shadow-blue-900/10 backdrop-blur transition-[padding] duration-150",
          expanded ? "py-2 pl-4 pr-2" : "p-0",
        )}
      >
        {expanded ? (
          <>
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-800">
                <span className="truncate">{dict.ai.taskPanelRunningTitle}</span>
                <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-normal text-blue-700">
                  {cancelling ? dict.ai.traceStatusCancelled : data.phaseLabel}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                {hasSections ? (
                  <span>{dict.ai.taskPanelSections}: {data.filledCount ?? 0}/{data.totalCount}</span>
                ) : null}
                <span>{dict.ai.taskPanelTools}: {data.toolCount}</span>
                <span>{dict.ai.taskPanelDuration}: {formatDuration(data.durationMs)}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 rounded-full px-2 text-xs text-blue-700 hover:bg-blue-50"
                onClick={onJump}
              >
                {dict.ai.taskPanelJump}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 rounded-full px-2 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                onClick={onStop}
                disabled={cancelling}
              >
                <Square className="h-3 w-3 fill-current" />
                {dict.ai.taskPanelStop}
              </Button>
            </div>
          </>
        ) : null}

        {/* The ball: always present, doubles as the drag handle. */}
        <div
          ref={ballRef}
          role="button"
          tabIndex={0}
          aria-label={dict.ai.taskPanelRunningTitle}
          aria-expanded={expanded}
          title={dict.ai.taskPanelRunningTitle}
          onPointerDown={startDrag}
          onClick={handleBallClick}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              setPinned((value) => !value)
            }
          }}
          className={cn(
            "flex shrink-0 cursor-grab items-center justify-center rounded-full border border-blue-200 bg-white text-blue-600 shadow-md shadow-blue-900/10 active:cursor-grabbing",
            dragging && "cursor-grabbing",
          )}
          style={{ width: BUBBLE_SIZE, height: BUBBLE_SIZE }}
        >
          <Loader2 className={cn("h-5 w-5", !cancelling && "animate-spin")} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
