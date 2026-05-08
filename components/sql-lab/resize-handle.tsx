"use client"

import { PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type Props = {
  axis: "x" | "y"
  getValue: () => number
  onChange: (next: number) => void
  className?: string
  ariaLabel?: string
}

/**
 * 极简的拖拽分隔条。父组件维护具体尺寸 state,handle 只负责
 * 把 pointer 偏移转换成新值。指针 capture 保证拖出 handle 范围
 * 仍然能跟随。
 */
export function ResizeHandle({ axis, getValue, onChange, className, ariaLabel }: Props) {
  const startPos = useRef(0)
  const initial = useRef(0)
  const [dragging, setDragging] = useState(false)

  const onDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(true)
      startPos.current = axis === "x" ? e.clientX : e.clientY
      initial.current = getValue()
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [axis, getValue]
  )

  const onMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      const cur = axis === "x" ? e.clientX : e.clientY
      onChange(initial.current + (cur - startPos.current))
    },
    [axis, onChange]
  )

  const onUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  const onDouble = useCallback(() => {
    // 暂时不带"双击重置默认值",留给父组件想用时通过 ref 实现。
  }, [])

  return (
    <div
      role="separator"
      aria-label={ariaLabel}
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={onDouble}
      className={cn(
        "group relative shrink-0 select-none",
        axis === "x" ? "h-full w-1.5 cursor-col-resize" : "w-full h-1.5 cursor-row-resize",
        className
      )}
    >
      <div
        className={cn(
          "absolute inset-0 transition-colors",
          dragging ? "bg-[--color-brand]" : "bg-transparent group-hover:bg-[--color-brand-border]"
        )}
      />
      <div
        className={cn(
          "absolute rounded-full bg-[--color-brand] opacity-0 transition-opacity group-hover:opacity-80",
          dragging && "opacity-100",
          axis === "x"
            ? "left-1/2 top-1/2 h-7 w-[3px] -translate-x-1/2 -translate-y-1/2"
            : "left-1/2 top-1/2 h-[3px] w-7 -translate-x-1/2 -translate-y-1/2"
        )}
      />
    </div>
  )
}
