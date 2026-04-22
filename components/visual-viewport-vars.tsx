"use client"

import { useEffect } from "react"

export function VisualViewportVars() {
  useEffect(() => {
    const root = document.documentElement
    let frame = 0

    const update = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport
        const height = viewport?.height ?? window.innerHeight
        const offsetTop = viewport?.offsetTop ?? 0
        const keyboardInset = Math.max(0, window.innerHeight - height - offsetTop)

        root.style.setProperty("--app-viewport-height", `${height}px`)
        root.style.setProperty("--app-viewport-offset-top", `${offsetTop}px`)
        root.style.setProperty("--keyboard-inset-bottom", `${keyboardInset}px`)
      })
    }

    update()
    window.visualViewport?.addEventListener("resize", update)
    window.visualViewport?.addEventListener("scroll", update)
    window.addEventListener("resize", update)
    window.addEventListener("orientationchange", update)

    return () => {
      window.cancelAnimationFrame(frame)
      window.visualViewport?.removeEventListener("resize", update)
      window.visualViewport?.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      window.removeEventListener("orientationchange", update)
    }
  }, [])

  return null
}
