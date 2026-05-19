"use client"

import { useEffect, useRef } from "react"
import type {
  Live2DBubbleTheme,
  Live2DDisplayMode,
  Live2DPosition,
  Live2DSize,
} from "@/lib/live2d-shared"
import { BUILTIN_MODELS, findModelIndex } from "@/lib/live2d-models"

declare global {
  interface Window {
    initWidget?: (config: {
      waifuPath?: string
      cdnPath?: string
      cubism2Path?: string
      cubism5Path?: string
      modelId?: number
      tools?: string[]
      drag?: boolean
      logLevel?: "error" | "warn" | "info" | "trace"
    }) => void
    __live2dResetPosition?: () => void
  }
}

const WIDGET_BASE = "/live2d/widget"
const CORE_PATH = "/live2d/core/live2dcubismcore.min.js"
const DESKTOP_MIN_WIDTH = 768
const STYLE_TAG_ID = "live2d-user-overrides"
const BUBBLE_THEME_STYLE_ID = "live2d-bubble-themes"
const WAIFU_ID = "waifu"
const LIVE2D_CANVAS_ID = "live2d"
const RIGHT_EDGE_PADDING = 20
const DRAG_POS_STORAGE_KEY = "live2d-drag-position"

const DESKTOP_SIZE_PX: Record<Live2DSize, { canvas: number; tips: number }> = {
  small: { canvas: 220, tips: 200 },
  medium: { canvas: 300, tips: 250 },
  large: { canvas: 400, tips: 300 },
}

// Mobile clamps the widget so it does not block important content.
const MOBILE_SIZE_PX = { canvas: 160, tips: 180 }

type DragPos = { x: number; y: number }

let initStarted = false
let dragController: { destroy: () => void } | null = null

function isDesktopViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth >= DESKTOP_MIN_WIDTH
}

function shouldEnable(displayMode: Live2DDisplayMode): boolean {
  if (displayMode === "off") return false
  if (displayMode === "desktop") return isDesktopViewport()
  return true
}

function effectiveSizePx(size: Live2DSize): { canvas: number; tips: number } {
  if (!isDesktopViewport()) return MOBILE_SIZE_PX
  return DESKTOP_SIZE_PX[size]
}

function loadDragPos(): DragPos | null {
  try {
    const raw = localStorage.getItem(DRAG_POS_STORAGE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    if (typeof v?.x === "number" && typeof v?.y === "number") return v
  } catch {
    /* ignore */
  }
  return null
}

function saveDragPos(pos: DragPos) {
  try {
    localStorage.setItem(DRAG_POS_STORAGE_KEY, JSON.stringify(pos))
  } catch {
    /* ignore */
  }
}

function clearDragPos() {
  try {
    localStorage.removeItem(DRAG_POS_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

function buildOverrideCSS(position: Live2DPosition, size: Live2DSize, drag: boolean): string {
  const { canvas, tips } = effectiveSizePx(size)

  // With drag ON we always anchor `#waifu` via `left` so the inline `left`
  // set by drag doesn't fight a css `right`.
  const useCssRightAnchor = position === "right-bottom" && !drag
  const waifuPosRule = useCssRightAnchor
    ? "#waifu { left: auto; right: 0; }"
    : "#waifu { left: 0; right: auto; }"

  const toggleRules =
    position === "right-bottom"
      ? `
        #waifu-toggle { left: auto; right: 0; margin-left: 0; margin-right: -100px; }
        #waifu-toggle.waifu-toggle-active { margin-left: 0; margin-right: -50px; }
        #waifu-toggle.waifu-toggle-active:hover { margin-left: 0; margin-right: -30px; }
      `
      : ""

  const dragModeRules = drag
    ? `
        #waifu, #waifu:hover { transform: none; transition: bottom 3s ease-in-out, opacity .25s ease; }
        #live2d { cursor: grab; }
        #live2d:active { cursor: grabbing; }
      `
    : `
        #live2d, #live2d:active { cursor: default; }
      `

  return `
    ${waifuPosRule}
    ${toggleRules}
    ${dragModeRules}
    #live2d { width: ${canvas}px; height: ${canvas}px; }
    #waifu-tips { width: ${tips}px; }
  `
}

// Themed speech-bubble styles. Applied via `#waifu[data-bubble-theme="..."]`,
// so themes can be swapped at runtime without re-initializing the widget.
//
// CSS-only by design: backgrounds, glows, sparkles, badge and tail are all
// built from gradients, pseudo-elements and CSS vars — no image assets.
const BUBBLE_THEMES_CSS = `
  #waifu-tips {
    /* Override upstream defaults so badge + tail can extend outside the bubble. */
    overflow: visible;
    word-break: break-word;
    box-sizing: border-box;
    will-change: transform;
  }

  /* Top-left badge — content driven by --bubble-name. Hidden when empty via class. */
  #waifu:not(.waifu-bubble-named) #waifu-tips::before {
    display: none;
  }
  #waifu.waifu-bubble-named #waifu-tips::before {
    content: var(--bubble-name, "");
    position: absolute;
    top: -14px;
    left: 14px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px 4px 10px;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: .02em;
    white-space: nowrap;
    border-radius: 999px;
    pointer-events: none;
    transform: translateZ(0);
  }

  /* Tail — common base, themed per variant below. */
  #waifu-tips::after {
    content: "";
    position: absolute;
    left: 28px;
    bottom: -10px;
    width: 18px;
    height: 18px;
    transform: rotate(45deg);
    border-radius: 4px 0 6px 0;
    pointer-events: none;
  }
  #waifu[data-position="right-bottom"] #waifu-tips::after {
    left: auto;
    right: 28px;
    border-radius: 0 4px 0 6px;
  }

  /* Common typography polish. */
  #waifu-tips { color: var(--bubble-text, #2b2540); font-weight: 500; }
  #waifu-tips span { color: var(--bubble-accent, #8b5cf6); font-weight: 600; }

  /* ── Dreamy glass ───────────────────────────────────────────── */
  #waifu[data-bubble-theme="dreamy-glass"] #waifu-tips {
    --bubble-text: #3a2e5c;
    --bubble-accent: #b06ad8;
    background:
      radial-gradient(120% 80% at 10% 0%, rgba(255, 214, 233, 0.55), transparent 60%),
      radial-gradient(120% 80% at 100% 100%, rgba(196, 181, 253, 0.55), transparent 55%),
      linear-gradient(135deg, rgba(255,255,255,0.78), rgba(255,255,255,0.55));
    border: 1px solid rgba(255, 255, 255, 0.85);
    border-radius: 22px;
    box-shadow:
      0 0 0 1px rgba(186, 155, 255, 0.35) inset,
      0 10px 30px -10px rgba(176, 122, 232, 0.45),
      0 0 30px rgba(255, 192, 220, 0.35);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    padding: 12px 16px;
  }
  #waifu[data-bubble-theme="dreamy-glass"].waifu-bubble-named #waifu-tips::before {
    color: #fff;
    background: linear-gradient(135deg, #c8a5ff 0%, #ffb3d1 100%);
    border: 1px solid rgba(255, 255, 255, 0.7);
    box-shadow:
      0 6px 18px -6px rgba(176, 122, 232, 0.55),
      0 0 0 3px rgba(255, 255, 255, 0.45);
  }
  #waifu[data-bubble-theme="dreamy-glass"] #waifu-tips::after {
    background: linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255, 214, 233, 0.7));
    border: 1px solid rgba(255, 255, 255, 0.85);
    box-shadow:
      0 4px 14px -4px rgba(176, 122, 232, 0.4),
      0 0 0 1px rgba(186, 155, 255, 0.3) inset;
    backdrop-filter: blur(10px) saturate(140%);
    -webkit-backdrop-filter: blur(10px) saturate(140%);
  }

  /* ── Cute sticker ───────────────────────────────────────────── */
  #waifu[data-bubble-theme="cute-sticker"] #waifu-tips {
    --bubble-text: #5b3a4a;
    --bubble-accent: #ef6f9c;
    background: #fff8fb;
    border: 2.5px solid #ffc1d4;
    border-radius: 26px;
    box-shadow:
      4px 4px 0 0 #ffc1d4,
      0 0 0 1px rgba(255, 255, 255, 0.9) inset;
    padding: 12px 16px;
  }
  #waifu[data-bubble-theme="cute-sticker"].waifu-bubble-named #waifu-tips::before {
    color: #fff;
    background: #ff8bb2;
    border: 2px solid #fff;
    box-shadow: 2px 2px 0 0 #ffc1d4;
  }
  #waifu[data-bubble-theme="cute-sticker"] #waifu-tips::after {
    background: #fff8fb;
    border-right: 2.5px solid #ffc1d4;
    border-bottom: 2.5px solid #ffc1d4;
    box-shadow: 2px 2px 0 0 #ffc1d4;
  }

  /* ── Minimal soft ───────────────────────────────────────────── */
  #waifu[data-bubble-theme="minimal-soft"] #waifu-tips {
    --bubble-text: #1f2937;
    --bubble-accent: #2563eb;
    background: #ffffff;
    border: 1px solid #eef0f3;
    border-radius: 16px;
    box-shadow:
      0 1px 0 rgba(15, 23, 42, 0.04),
      0 8px 24px -12px rgba(15, 23, 42, 0.18);
    padding: 12px 14px;
  }
  #waifu[data-bubble-theme="minimal-soft"].waifu-bubble-named #waifu-tips::before {
    color: #475569;
    background: #f6f7f9;
    border: 1px solid #eef0f3;
    box-shadow: 0 4px 12px -8px rgba(15, 23, 42, 0.25);
    font-weight: 500;
  }
  #waifu[data-bubble-theme="minimal-soft"] #waifu-tips::after {
    background: #ffffff;
    border-right: 1px solid #eef0f3;
    border-bottom: 1px solid #eef0f3;
    box-shadow: 2px 2px 6px -3px rgba(15, 23, 42, 0.18);
  }

  /* ── Magic fantasy ──────────────────────────────────────────── */
  #waifu[data-bubble-theme="magic-fantasy"] #waifu-tips {
    --bubble-text: #f4f0ff;
    --bubble-accent: #ffd591;
    color: var(--bubble-text);
    background:
      radial-gradient(140% 90% at 0% 0%, rgba(141, 92, 255, 0.85), transparent 60%),
      radial-gradient(140% 90% at 100% 100%, rgba(67, 56, 202, 0.95), transparent 55%),
      linear-gradient(135deg, #2a1b5e 0%, #4c1d95 100%);
    border: 1px solid rgba(255, 215, 145, 0.45);
    border-radius: 20px;
    box-shadow:
      0 0 0 1px rgba(255, 215, 145, 0.2) inset,
      0 12px 32px -10px rgba(76, 29, 149, 0.7),
      0 0 24px rgba(141, 92, 255, 0.55);
    padding: 12px 16px;
  }
  #waifu[data-bubble-theme="magic-fantasy"] #waifu-tips span {
    color: #ffd591;
    text-shadow: 0 0 8px rgba(255, 213, 145, 0.5);
  }
  #waifu[data-bubble-theme="magic-fantasy"].waifu-bubble-named #waifu-tips::before {
    color: #2a1b5e;
    background: linear-gradient(135deg, #ffe9b5 0%, #ffd591 100%);
    border: 1px solid rgba(255, 233, 181, 0.9);
    box-shadow:
      0 6px 18px -6px rgba(255, 215, 145, 0.7),
      0 0 12px rgba(255, 215, 145, 0.45);
  }
  #waifu[data-bubble-theme="magic-fantasy"] #waifu-tips::after {
    background: linear-gradient(135deg, #4c1d95, #2a1b5e);
    border: 1px solid rgba(255, 215, 145, 0.45);
    box-shadow: 0 0 14px rgba(141, 92, 255, 0.55);
  }
`

function ensureOverrideStyleTag(): HTMLStyleElement {
  let tag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null
  if (!tag) {
    tag = document.createElement("style")
    tag.id = STYLE_TAG_ID
  }
  return tag
}

function ensureBubbleThemeStyleTag(): HTMLStyleElement {
  let tag = document.getElementById(BUBBLE_THEME_STYLE_ID) as HTMLStyleElement | null
  if (!tag) {
    tag = document.createElement("style")
    tag.id = BUBBLE_THEME_STYLE_ID
    tag.textContent = BUBBLE_THEMES_CSS
    document.head.appendChild(tag)
  }
  return tag
}

function applyBubbleTheme(theme: Live2DBubbleTheme, name: string, position: Live2DPosition) {
  ensureBubbleThemeStyleTag()
  const waifu = document.getElementById(WAIFU_ID)
  if (!waifu) return
  waifu.setAttribute("data-bubble-theme", theme)
  waifu.setAttribute("data-position", position)
  const trimmed = (name ?? "").trim()
  if (trimmed) {
    // JSON.stringify wraps in quotes and escapes safely for CSS `content`.
    waifu.style.setProperty("--bubble-name", JSON.stringify(trimmed))
    waifu.classList.add("waifu-bubble-named")
  } else {
    waifu.style.removeProperty("--bubble-name")
    waifu.classList.remove("waifu-bubble-named")
  }
}

function placeRightBottomForDrag(canvasSize: number) {
  const waifu = document.getElementById(WAIFU_ID)
  if (!waifu) return
  const left = Math.max(0, window.innerWidth - canvasSize - RIGHT_EDGE_PADDING)
  waifu.style.left = `${left}px`
  waifu.style.right = "auto"
}

function applyDragPersisted(pos: DragPos, canvasSize: number) {
  const waifu = document.getElementById(WAIFU_ID)
  if (!waifu) return
  const w = waifu.offsetWidth || canvasSize
  const h = waifu.offsetHeight || canvasSize
  const x = Math.max(0, Math.min(window.innerWidth - w, pos.x))
  const y = Math.max(0, Math.min(window.innerHeight - h, pos.y))
  waifu.style.left = `${x}px`
  waifu.style.top = `${y}px`
  waifu.style.right = "auto"
  waifu.style.bottom = "auto"
}

function clearInlinePlacement() {
  const waifu = document.getElementById(WAIFU_ID)
  if (!waifu) return
  waifu.style.left = ""
  waifu.style.top = ""
  waifu.style.right = ""
  waifu.style.bottom = ""
}

function installCustomDrag(): { destroy: () => void } {
  let dragging = false
  let waifu: HTMLElement | null = null
  let offsetX = 0
  let offsetY = 0

  const onMouseMove = (e: MouseEvent) => {
    if (!dragging || !waifu) return
    e.preventDefault()
    const w = waifu.offsetWidth || 300
    const h = waifu.offsetHeight || 300
    const x = Math.max(0, Math.min(window.innerWidth - w, e.clientX - offsetX))
    const y = Math.max(0, Math.min(window.innerHeight - h, e.clientY - offsetY))
    waifu.style.left = `${x}px`
    waifu.style.top = `${y}px`
  }

  const onMouseUp = () => {
    if (!dragging || !waifu) return
    dragging = false
    const left = parseFloat(waifu.style.left || "0") || 0
    const top = parseFloat(waifu.style.top || "0") || 0
    saveDragPos({ x: left, y: top })
    document.removeEventListener("mousemove", onMouseMove)
    document.removeEventListener("mouseup", onMouseUp)
  }

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return
    const canvas = document.getElementById(LIVE2D_CANVAS_ID)
    if (!canvas || e.target !== canvas) return
    waifu = document.getElementById(WAIFU_ID)
    if (!waifu) return
    e.preventDefault()
    const rect = waifu.getBoundingClientRect()
    waifu.style.left = `${rect.left}px`
    waifu.style.top = `${rect.top}px`
    waifu.style.right = "auto"
    waifu.style.bottom = "auto"
    dragging = true
    offsetX = e.clientX - rect.left
    offsetY = e.clientY - rect.top
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  document.addEventListener("mousedown", onMouseDown)

  return {
    destroy() {
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    },
  }
}

function applySettingsLive(position: Live2DPosition, size: Live2DSize, drag: boolean) {
  const styleTag = ensureOverrideStyleTag()
  styleTag.textContent = buildOverrideCSS(position, size, drag)
  document.head.appendChild(styleTag) // moves to end → keeps cascade order

  if (!document.getElementById(WAIFU_ID)) return

  const { canvas } = effectiveSizePx(size)

  if (drag) {
    if (!dragController) dragController = installCustomDrag()
    const persisted = loadDragPos()
    if (persisted) {
      applyDragPersisted(persisted, canvas)
    } else {
      clearInlinePlacement()
      if (position === "right-bottom") placeRightBottomForDrag(canvas)
    }
  } else {
    if (dragController) {
      dragController.destroy()
      dragController = null
    }
    clearInlinePlacement()
  }
}

function resolveBubbleName(rawName: string, modelId: string): string {
  const trimmed = (rawName ?? "").trim()
  if (trimmed) return trimmed
  const model = BUILTIN_MODELS.find((m) => m.id === modelId)
  return model?.name ?? ""
}

export type Live2DWidgetProps = {
  displayMode: Live2DDisplayMode
  position: Live2DPosition
  size: Live2DSize
  drag: boolean
  modelId: string
  bubbleTheme: Live2DBubbleTheme
  bubbleName: string
}

export function Live2DWidget({
  displayMode,
  position,
  size,
  drag,
  modelId,
  bubbleTheme,
  bubbleName,
}: Live2DWidgetProps) {
  const propsRef = useRef({ position, size, drag, bubbleTheme, bubbleName, modelId })

  // Keep the ref in sync so the async `script.onload` path can read the
  // most recent props even if they changed between mount and script load.
  useEffect(() => {
    propsRef.current = { position, size, drag, bubbleTheme, bubbleName, modelId }
  })

  // Effect A: one-time bootstrap (script load + initWidget).
  useEffect(() => {
    if (typeof window === "undefined") return
    if (initStarted) return
    if (!shouldEnable(displayMode)) return
    initStarted = true

    if (!document.querySelector('link[data-live2d="waifu-css"]')) {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = `${WIDGET_BASE}/waifu.css`
      link.dataset.live2d = "waifu-css"
      document.head.appendChild(link)
    }

    const styleTag = ensureOverrideStyleTag()
    styleTag.textContent = buildOverrideCSS(propsRef.current.position, propsRef.current.size, propsRef.current.drag)
    document.head.appendChild(styleTag)

    // Bubble theme stylesheet is static — append once. The runtime swap is
    // done via the data-bubble-theme attribute in `applyBubbleTheme`.
    ensureBubbleThemeStyleTag()

    if (document.querySelector('script[data-live2d="waifu-tips"]')) return

    const script = document.createElement("script")
    script.type = "module"
    script.src = `${WIDGET_BASE}/waifu-tips.js`
    script.dataset.live2d = "waifu-tips"
    script.onload = () => {
      if (typeof window.initWidget !== "function") {
        console.warn("[Live2D] initWidget not available after script load")
        return
      }
      // Force the widget to use the configured model rather than whatever
      // localStorage cached from a previous visit / previous selection.
      const modelIdx = findModelIndex(modelId)
      try {
        localStorage.setItem("modelId", String(modelIdx))
        localStorage.setItem("modelTexturesId", "0")
      } catch {
        /* ignore quota / disabled storage */
      }
      window.initWidget({
        waifuPath: `${WIDGET_BASE}/waifu-tips.json`,
        cubism5Path: CORE_PATH,
        tools: ["photo", "info", "quit"],
        drag: false,
        modelId: modelIdx,
        logLevel: "warn",
      })

      const tryAdjust = (attempts: number) => {
        if (attempts <= 0) return
        const waifu = document.getElementById(WAIFU_ID)
        if (!waifu) {
          setTimeout(() => tryAdjust(attempts - 1), 50)
          return
        }
        // Hide while we compute final placement to avoid the left→right flicker.
        waifu.style.opacity = "0"
        const { position: p, size: s, drag: d, bubbleTheme: t, bubbleName: n, modelId: m } = propsRef.current
        applySettingsLive(p, s, d)
        applyBubbleTheme(t, resolveBubbleName(n, m), p)
        // Reveal in next frame so reflow has settled.
        requestAnimationFrame(() => {
          waifu.style.opacity = ""
        })
      }
      tryAdjust(80)
    }
    script.onerror = () => {
      console.warn("[Live2D] Failed to load waifu-tips.js")
      initStarted = false
    }
    document.head.appendChild(script)
  }, [displayMode, modelId])

  // Effect B: live update on settings change (position/size/drag).
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!initStarted) return
    if (!shouldEnable(displayMode)) return
    applySettingsLive(position, size, drag)
  }, [displayMode, position, size, drag])

  // Effect C: live bubble theme + badge name updates.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!initStarted) return
    if (!shouldEnable(displayMode)) return
    applyBubbleTheme(bubbleTheme, resolveBubbleName(bubbleName, modelId), position)
  }, [displayMode, bubbleTheme, bubbleName, modelId, position])

  // Expose a global reset hook used by the settings page.
  useEffect(() => {
    window.__live2dResetPosition = () => {
      clearDragPos()
      clearInlinePlacement()
      const { canvas } = effectiveSizePx(propsRef.current.size)
      if (propsRef.current.drag && propsRef.current.position === "right-bottom") {
        placeRightBottomForDrag(canvas)
      }
    }
    return () => {
      delete window.__live2dResetPosition
    }
  }, [])

  return null
}
