"use client"

import { useEffect } from "react"

const KEYBOARD_OPEN_THRESHOLD = 140
const KEYBOARD_CLOSE_THRESHOLD = 80
const KEYBOARD_JITTER_PX = 24
const MENU_SHEET_MIN_HEIGHT = 300

function isTextEntryElement(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) {
    const nonText = ["button", "checkbox", "file", "radio", "range", "reset", "submit", "color"]
    return !nonText.includes(el.type)
  }
  return false
}

export function VisualViewportVars() {
  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    let frame = 0
    let keyboardHeight = 0

    const setKeyboard = (heightPx: number, visualGapPx = heightPx) => {
      const v = `${heightPx}px`
      root.style.setProperty("--kbd-bottom", v)
      root.style.setProperty("--visual-keyboard-gap", `${visualGapPx}px`)
      // Keep the legacy alias in sync so consumers like chat-message-actions
      // that read `--keyboard-inset-bottom` keep working.
      root.style.setProperty("--keyboard-inset-bottom", v)
      const maxSheet = Math.max(MENU_SHEET_MIN_HEIGHT, Math.round(window.innerHeight * 0.72))
      const sheet = Math.min(Math.max(
        heightPx,
        parseFloat(getComputedStyle(root).getPropertyValue("--menu-sheet-height") || "0") || 0,
        MENU_SHEET_MIN_HEIGHT,
      ), maxSheet)
      root.style.setProperty("--menu-sheet-height", `${sheet}px`)
      body.classList.toggle("mobile-keyboard-open", heightPx > 0 && window.matchMedia("(max-width: 767px)").matches)
    }

    const update = (options: { keyboard?: boolean } = {}) => {
      const shouldUpdateKeyboard = options.keyboard !== false
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport
        const rawHeight = viewport?.height ?? window.innerHeight
        const offsetTop = viewport?.offsetTop ?? 0
        const viewportBottom = rawHeight + offsetTop
        const height = Math.max(0, Math.round(viewportBottom))
        const rawGap = Math.max(0, Math.round(window.innerHeight - viewportBottom))

        root.style.setProperty("--app-viewport-height", `${height}px`)
        root.style.setProperty("--app-viewport-offset-top", `${offsetTop}px`)

        // Small gaps are usually URL-bar artifacts, not the soft keyboard. Holding
        // the previous height through tiny jitters keeps the toolbar from bobbing.
        const focusOk = isTextEntryElement(document.activeElement)
        let nextKeyboardHeight = keyboardHeight
        if (shouldUpdateKeyboard) {
          nextKeyboardHeight = 0
        }
        if (shouldUpdateKeyboard && focusOk) {
          const shouldStayOpen = keyboardHeight > 0 && rawGap >= KEYBOARD_CLOSE_THRESHOLD
          const shouldOpen = rawGap >= KEYBOARD_OPEN_THRESHOLD
          if (shouldOpen || shouldStayOpen) {
            nextKeyboardHeight = Math.abs(rawGap - keyboardHeight) <= KEYBOARD_JITTER_PX ? keyboardHeight : rawGap
          }
        }
        keyboardHeight = nextKeyboardHeight
        setKeyboard(keyboardHeight, rawGap)
      })
    }
    const updateKeyboard = () => update({ keyboard: true })
    const updateViewportOnly = () => update({ keyboard: false })

    const handleFocusOut = () => {
      // After focus leaves, double-check after the new activeElement has settled.
      window.setTimeout(() => {
        if (!isTextEntryElement(document.activeElement)) {
          keyboardHeight = 0
          setKeyboard(0)
        }
      }, 120)
    }

    updateKeyboard()
    window.visualViewport?.addEventListener("resize", updateKeyboard)
    window.visualViewport?.addEventListener("scroll", updateViewportOnly)
    window.addEventListener("resize", updateKeyboard)
    window.addEventListener("orientationchange", updateKeyboard)
    document.addEventListener("focusin", updateKeyboard)
    document.addEventListener("focusout", handleFocusOut)

    return () => {
      window.cancelAnimationFrame(frame)
      window.visualViewport?.removeEventListener("resize", updateKeyboard)
      window.visualViewport?.removeEventListener("scroll", updateViewportOnly)
      window.removeEventListener("resize", updateKeyboard)
      window.removeEventListener("orientationchange", updateKeyboard)
      document.removeEventListener("focusin", updateKeyboard)
      document.removeEventListener("focusout", handleFocusOut)
      body.classList.remove("mobile-keyboard-open")
      root.style.removeProperty("--kbd-bottom")
      root.style.removeProperty("--visual-keyboard-gap")
      root.style.removeProperty("--keyboard-inset-bottom")
      root.style.removeProperty("--menu-sheet-height")
    }
  }, [])

  return null
}
