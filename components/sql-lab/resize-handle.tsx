"use client"

import { type PointerEvent as ReactPointerEvent, type KeyboardEvent, useCallback, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type Props = {
  axis: "x" | "y"
  getValue: () => number
  onChange: (next: number) => void
  onReset?: () => void
  className?: string
  ariaLabel?: string
}

export function ResizeHandle({ axis, getValue, onChange, onReset, className, ariaLabel }: Props) {
  const startPos = useRef(0)
  const initial = useRef(0)
  const [dragging, setDragging] = useState(false)

  const onDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragging(true)
      startPos.current = axis === "x" ? event.clientX : event.clientY
      initial.current = getValue()
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [axis, getValue],
  )

  const onMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
      const current = axis === "x" ? event.clientX : event.clientY
      onChange(initial.current + (current - startPos.current))
    },
    [axis, onChange],
  )

  const onUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 40 : 12
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        onReset?.()
        return
      }
      if (axis === "x" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault()
        onChange(getValue() + (event.key === "ArrowRight" ? step : -step))
      }
      if (axis === "y" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault()
        onChange(getValue() + (event.key === "ArrowDown" ? step : -step))
      }
    },
    [axis, getValue, onChange, onReset],
  )

  return (
    <div
      role="separator"
      aria-label={ariaLabel}
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      tabIndex={0}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      className={cn(
        "group relative shrink-0 select-none outline-none",
        axis === "x" ? "h-full w-2 cursor-col-resize" : "h-2 w-full cursor-row-resize",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-0 rounded-full transition-colors",
          dragging ? "bg-[--color-brand]" : "bg-transparent group-hover:bg-[--color-brand-border] group-focus-visible:bg-[--color-brand-border]",
        )}
      />
      <div
        className={cn(
          "absolute rounded-full bg-[--color-brand] opacity-0 transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80",
          dragging && "opacity-100",
          axis === "x"
            ? "left-1/2 top-1/2 h-7 w-[3px] -translate-x-1/2 -translate-y-1/2"
            : "left-1/2 top-1/2 h-[3px] w-7 -translate-x-1/2 -translate-y-1/2",
        )}
      />
    </div>
  )
}
