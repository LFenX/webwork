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
        const rawHeight = viewport?.height ?? window.innerHeight
        const offsetTop = viewport?.offsetTop ?? 0
        // Use the visible viewport bottom edge instead of raw visualViewport.height.
        // On mobile keyboards, offsetTop often changes during the opening animation;
        // including it keeps the usable app height steadier and reduces layout jump.
        const viewportBottom = rawHeight + offsetTop
        const height = Math.max(0, Math.round(viewportBottom))
        const keyboardInset = Math.max(0, Math.round(window.innerHeight - viewportBottom))

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
