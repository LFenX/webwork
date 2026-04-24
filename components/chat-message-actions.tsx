"use client"

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export type MessageActionItem = {
  id: string
  label: string
  onSelect: () => void
}

type MenuPosition = {
  x: number
  y: number
}

type MenuState =
  | {
      mode: "context"
      position: MenuPosition
    }
  | {
      mode: "sheet"
    }
  | null

const MENU_WIDTH = 168
const MENU_ITEM_HEIGHT = 42
const LONG_PRESS_MS = 420
const LONG_PRESS_MOVE_TOLERANCE = 12

export function MessageActionSurface({
  children,
  className,
  items,
  preview,
}: {
  children: ReactNode
  className?: string
  items: MessageActionItem[]
  preview?: ReactNode
}) {
  const [menuState, setMenuState] = useState<MenuState>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const pendingActionRef = useRef<(() => void) | null>(null)

  const resolvedPosition = useMemo(() => {
    if (!menuState || menuState.mode !== "context" || typeof window === "undefined") return null
    const maxX = Math.max(8, window.innerWidth - MENU_WIDTH - 8)
    const estimatedHeight = items.length * MENU_ITEM_HEIGHT + 16
    const maxY = Math.max(8, window.innerHeight - estimatedHeight - 8)
    return {
      x: Math.min(menuState.position.x, maxX),
      y: Math.min(menuState.position.y, maxY),
    }
  }, [items.length, menuState])

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const clearLongPress = () => {
    clearLongPressTimer()
    pointerStartRef.current = null
  }

  const runAction = (item: MessageActionItem) => {
    pendingActionRef.current = item.onSelect
    setMenuState(null)
  }

  useEffect(() => {
    if (!menuState || menuState.mode !== "context") return
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      setMenuState(null)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuState(null)
    }
    window.addEventListener("pointerdown", handlePointerDown, true)
    window.addEventListener("keydown", handleEscape)
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true)
      window.removeEventListener("keydown", handleEscape)
    }
  }, [menuState])

  useEffect(() => {
    if (menuState || !pendingActionRef.current) return
    const action = pendingActionRef.current
    pendingActionRef.current = null
    const frame = window.requestAnimationFrame(() => {
      action()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [menuState])

  return (
    <div
      className={cn("relative select-none [-webkit-touch-callout:none] [-webkit-user-select:none]", className)}
      onContextMenu={(event) => {
        if (items.length === 0) return
        event.preventDefault()
        setMenuState({ mode: "context", position: { x: event.clientX, y: event.clientY } })
      }}
      onPointerDown={(event) => {
        if (items.length === 0 || event.pointerType === "mouse") return
        clearLongPressTimer()
        pointerStartRef.current = { x: event.clientX, y: event.clientY }
        longPressTimerRef.current = window.setTimeout(() => {
          setMenuState({ mode: "sheet" })
          clearLongPress()
        }, LONG_PRESS_MS)
      }}
      onPointerMove={(event) => {
        const start = pointerStartRef.current
        if (!start) return
        const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y)
        if (moved > LONG_PRESS_MOVE_TOLERANCE) clearLongPress()
      }}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
    >
      {children}
      {resolvedPosition ? (
        <div
          ref={menuRef}
          className="fixed z-[80] min-w-[168px] overflow-hidden rounded-2xl border border-black/10 bg-white py-1 shadow-[0_12px_30px_rgba(15,23,42,0.16)]"
          style={{ left: resolvedPosition.x, top: resolvedPosition.y, width: MENU_WIDTH }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex h-[42px] w-full touch-manipulation items-center px-4 text-left text-sm text-[--color-text-primary] transition-colors hover:bg-black/5"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                runAction(item)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      {menuState?.mode === "sheet" ? (
        <div
          className="fixed inset-0 z-[90] bg-black/18"
          onClick={() => setMenuState(null)}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgba(15,23,42,0.16)]"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/10" />
            {preview ? (
              <div className="mb-3 overflow-hidden rounded-2xl border border-black/8 bg-[#f7f8fa]">
                {preview}
              </div>
            ) : null}
            <div className="overflow-hidden rounded-2xl border border-black/8 bg-white">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "flex min-h-12 w-full touch-manipulation items-center px-4 py-3 text-left text-base text-[--color-text-primary] active:bg-black/5",
                    index > 0 && "border-t border-black/6"
                  )}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    runAction(item)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#f4f5f7] px-4 py-3 text-sm font-medium text-[--color-text-secondary] active:bg-[#e9ebef]"
              onClick={() => setMenuState(null)}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function MessageReplyReference({
  sender,
  summary,
  align = "left",
  className,
}: {
  sender: string
  summary: string
  align?: "left" | "right"
  className?: string
}) {
  const content = (
    <>
      <span className="truncate">{sender}: {summary}</span>
      <span className="h-5 w-px shrink-0 bg-[#d5d9de]" />
    </>
  )

  return (
    <div className={cn("mt-1 flex max-w-[84%] items-center gap-2 text-xs text-[#9aa0a6]", align === "right" ? "justify-end self-end text-right" : "justify-start", className)}>
      {align === "right" ? content : (
        <>
          <span className="h-5 w-px shrink-0 bg-[#d5d9de]" />
          <span className="truncate">{sender}: {summary}</span>
        </>
      )}
    </div>
  )
}

export function ComposerReplyPreview({
  sender,
  summary,
  onClear,
}: {
  sender: string
  summary: string
  onClear: () => void
}) {
  return (
    <div className="mx-3 mb-2 flex items-center gap-3 rounded-md bg-[#f7f7f7] px-3 py-2 text-xs text-[#8b9199]">
      <span className="h-6 w-px shrink-0 bg-[#d5d9de]" />
      <div className="min-w-0 flex-1">
        <p className="truncate">{sender}: {summary}</p>
      </div>
      <button type="button" onClick={onClear} className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/15 text-white transition-colors hover:bg-black/25">
        ×
      </button>
    </div>
  )
}
