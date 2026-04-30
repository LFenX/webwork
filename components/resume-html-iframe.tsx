"use client"

import { useEffect, useRef, useState } from "react"

const CANVAS_W = 1100
const CANVAS_H = 1550

export function ResumeHtmlIframe({
  srcDoc,
  title = "简历预览",
  minHeight = 800,
  viewportWidth = 1100,
  mode = "full",
}: {
  srcDoc: string
  title?: string
  minHeight?: number
  viewportWidth?: number
  mode?: "full" | "thumbnail"
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [iframeH, setIframeH] = useState(CANVAS_H)

  // thumbnail mode: scale to fit container
  useEffect(() => {
    if (mode !== "thumbnail") return
    const container = containerRef.current
    if (!container) return
    const measure = () => {
      const cw = container.clientWidth
      const ch = container.clientHeight
      if (cw < 50 || ch < 50) return
      const s = Math.min(cw / CANVAS_W, ch / CANVAS_H)
      setScale(Math.max(0.20, Math.min(0.70, s)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    return () => ro.disconnect()
  }, [mode])

  // full mode: scale to fit container width on mobile, measure iframe content height
  useEffect(() => {
    if (mode !== "full") return
    const container = containerRef.current
    if (!container) return
    const measureScale = () => {
      const cw = container.clientWidth
      if (cw > 0 && cw < viewportWidth) {
        setScale(cw / viewportWidth)
      } else {
        setScale(1)
      }
    }
    measureScale()
    const ro = new ResizeObserver(measureScale)
    ro.observe(container)
    return () => ro.disconnect()
  }, [mode, viewportWidth])

  useEffect(() => {
    if (mode !== "full") return
    const f = containerRef.current?.querySelector("iframe") as HTMLIFrameElement | null
    if (!f) return
    const measure = () => {
      try {
        const doc = f.contentDocument
        if (doc) setIframeH(Math.max(minHeight, doc.documentElement.scrollHeight))
      } catch { /* cross-origin guard */ }
    }
    f.addEventListener("load", measure)
    return () => f.removeEventListener("load", measure)
  }, [srcDoc, minHeight, mode])

  if (mode === "thumbnail") {
    return (
      <div ref={containerRef} className="w-full h-full min-h-[400px] overflow-hidden bg-white dark:bg-neutral-800 relative">
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: "top center",
          }}
        >
          <iframe
            srcDoc={srcDoc}
            title={title}
            sandbox="allow-same-origin allow-popups"
            className="border-0 block"
            style={{ width: CANVAS_W, height: CANVAS_H }}
            scrolling="no"
          />
        </div>
      </div>
    )
  }

  // full mode: scales down on narrow screens so no horizontal scroll
  const scaledH = scale < 1 ? Math.ceil(iframeH * scale) : iframeH
  return (
    <div ref={containerRef} className="w-full overflow-hidden" style={{ height: scaledH }}>
      <div
        style={{
          width: viewportWidth,
          height: iframeH,
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
        }}
      >
        <iframe
          srcDoc={srcDoc}
          title={title}
          sandbox="allow-same-origin allow-popups"
          className="border-0 block"
          style={{ height: iframeH, width: viewportWidth }}
        />
      </div>
    </div>
  )
}
