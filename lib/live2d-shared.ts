// Pure types + constants for Live2D settings.
//
// This module is intentionally free of `server-only` and of any Prisma/Node
// dependency so it can be imported from Client Components (settings form,
// live2d-widget) without dragging the server bundle into the browser.
//
// Server-only code (`getUserLive2DSettings`) lives in `lib/live2d-settings.ts`
// and imports from this file.

import { DEFAULT_MODEL_ID } from "@/lib/live2d-models"

export type Live2DPosition = "left-bottom" | "right-bottom"
export type Live2DSize = "small" | "medium" | "large"
export type Live2DDisplayMode = "off" | "desktop" | "all"
export type Live2DBubbleTheme = "dreamy-glass" | "cute-sticker" | "minimal-soft" | "magic-fantasy"

export const BUBBLE_THEME_IDS: Live2DBubbleTheme[] = [
  "dreamy-glass",
  "cute-sticker",
  "minimal-soft",
  "magic-fantasy",
]

export const DEFAULT_BUBBLE_THEME: Live2DBubbleTheme = "dreamy-glass"

export const BUBBLE_NAME_MAX_LENGTH = 20

export type UserLive2DSettings = {
  displayMode: Live2DDisplayMode
  position: Live2DPosition
  size: Live2DSize
  drag: boolean
  modelId: string
  bubbleTheme: Live2DBubbleTheme
  bubbleName: string
}

export const LIVE2D_DEFAULTS: UserLive2DSettings = {
  displayMode: "desktop",
  position: "left-bottom",
  size: "medium",
  drag: false,
  modelId: DEFAULT_MODEL_ID,
  bubbleTheme: DEFAULT_BUBBLE_THEME,
  bubbleName: "",
}

export function normalizeDisplayMode(value: string): Live2DDisplayMode {
  return value === "off" || value === "all" ? value : "desktop"
}

export function normalizePosition(value: string): Live2DPosition {
  return value === "right-bottom" ? "right-bottom" : "left-bottom"
}

export function normalizeSize(value: string): Live2DSize {
  return value === "small" || value === "large" ? value : "medium"
}

export function normalizeBubbleTheme(value: string): Live2DBubbleTheme {
  return (BUBBLE_THEME_IDS as string[]).includes(value)
    ? (value as Live2DBubbleTheme)
    : DEFAULT_BUBBLE_THEME
}

export function normalizeBubbleName(value: string | null | undefined): string {
  if (!value) return ""
  return value.slice(0, BUBBLE_NAME_MAX_LENGTH)
}
