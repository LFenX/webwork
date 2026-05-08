import type {
  GuardianBubblePlacement,
  GuardianDockMode,
  GuardianEdge,
  GuardianPosition,
} from "@/lib/sql-guardian/types"

export type GuardianViewport = {
  width: number
  height: number
}

export type GuardianSafeInset = {
  top: number
  right: number
  bottom: number
  left: number
}

export type GuardianMotionMode = "walk" | "jump" | "teleport"

export type GuardianMotionPlan = {
  mode: GuardianMotionMode
  next: GuardianPosition
}

export type SqlLabGuardianDockConfig = {
  xOffsetFromRight: number
  yOffsetFromBottom: number
  bubbleMaxWidth: number
  minimized?: boolean
}

export const GUARDIAN_SPRITE_SIZE = 80
export const GUARDIAN_COMPACT_BREAKPOINT = 768
export const SQL_LAB_DOCKED_BREAKPOINT = 1100

export const SAFE_INSET: GuardianSafeInset = {
  top: 88,
  right: 24,
  bottom: 108,
  left: 24,
}

export const SQL_LAB_SAFE_INSET: GuardianSafeInset = {
  top: 96,
  right: 48,
  bottom: 132,
  left: 24,
}

export const SQL_LAB_GUARDIAN_DOCK = {
  desktop: {
    xOffsetFromRight: 48,
    yOffsetFromBottom: 132,
    bubbleMaxWidth: 320,
  },
  compact: {
    xOffsetFromRight: 24,
    yOffsetFromBottom: 96,
    bubbleMaxWidth: 230,
    minimized: true,
  },
} as const satisfies Record<"desktop" | "compact", SqlLabGuardianDockConfig>

const EDGE_ORDER: GuardianEdge[] = ["bottom", "left", "top", "right"]
const DEFAULT_STEP = 128
const SQL_LAB_DOCK_STEP = 56

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function getGuardianSafeInset(isSqlLab: boolean) {
  return isSqlLab ? SQL_LAB_SAFE_INSET : SAFE_INSET
}

export function getGuardianDockMode(
  viewport: GuardianViewport,
  isSqlLab: boolean,
  minimized = false
): GuardianDockMode {
  if (minimized || viewport.width < GUARDIAN_COMPACT_BREAKPOINT) return "minimized"
  if (!isSqlLab) return "floating"
  if (viewport.width < SQL_LAB_DOCKED_BREAKPOINT) return "compact"
  return "docked"
}

export function getGuardianBubbleMaxWidth(dockMode: GuardianDockMode, isSqlLab: boolean) {
  if (dockMode === "compact" || dockMode === "minimized") return SQL_LAB_GUARDIAN_DOCK.compact.bubbleMaxWidth
  if (isSqlLab) return SQL_LAB_GUARDIAN_DOCK.desktop.bubbleMaxWidth
  return 340
}

export function getGuardianBounds(viewport: GuardianViewport, isSqlLab: boolean) {
  const inset = getGuardianSafeInset(isSqlLab)
  const maxX = Math.max(inset.left, viewport.width - inset.right - GUARDIAN_SPRITE_SIZE)
  const maxY = Math.max(inset.top, viewport.height - inset.bottom - GUARDIAN_SPRITE_SIZE)

  return {
    minX: inset.left,
    minY: inset.top,
    maxX,
    maxY,
  }
}

export function getGuardianDockPosition(viewport: GuardianViewport, isSqlLab: boolean): GuardianPosition {
  const bounds = getGuardianBounds(viewport, isSqlLab)
  if (isSqlLab) {
    const config = viewport.width < SQL_LAB_DOCKED_BREAKPOINT
      ? SQL_LAB_GUARDIAN_DOCK.compact
      : SQL_LAB_GUARDIAN_DOCK.desktop

    return {
      edge: "right",
      x: clamp(viewport.width - config.xOffsetFromRight - GUARDIAN_SPRITE_SIZE, bounds.minX, bounds.maxX),
      y: clamp(viewport.height - config.yOffsetFromBottom - GUARDIAN_SPRITE_SIZE, bounds.minY, bounds.maxY),
    }
  }

  return {
    edge: "bottom",
    x: bounds.maxX,
    y: bounds.maxY,
  }
}

export function getGuardianHomeWakePosition(viewport: GuardianViewport): GuardianPosition {
  return getGuardianDockPosition(viewport, true)
}

function nextEdge(edge: GuardianEdge) {
  const index = EDGE_ORDER.indexOf(edge)
  return EDGE_ORDER[(index + 1) % EDGE_ORDER.length] ?? "bottom"
}

function normalizePosition(position: GuardianPosition, viewport: GuardianViewport, isSqlLab: boolean): GuardianPosition {
  const bounds = getGuardianBounds(viewport, isSqlLab)
  return {
    edge: position.edge,
    x: clamp(position.x, bounds.minX, bounds.maxX),
    y: clamp(position.y, bounds.minY, bounds.maxY),
  }
}

function advanceFullBoundary(position: GuardianPosition, viewport: GuardianViewport, isSqlLab: boolean) {
  const bounds = getGuardianBounds(viewport, isSqlLab)
  const step = DEFAULT_STEP
  const current = normalizePosition(position, viewport, isSqlLab)

  if (current.edge === "bottom") {
    const x = current.x - step
    if (x <= bounds.minX) return { edge: nextEdge(current.edge), x: bounds.minX, y: bounds.maxY } satisfies GuardianPosition
    return { ...current, x }
  }

  if (current.edge === "left") {
    const y = current.y - step
    if (y <= bounds.minY) return { edge: nextEdge(current.edge), x: bounds.minX, y: bounds.minY } satisfies GuardianPosition
    return { ...current, y }
  }

  if (current.edge === "top") {
    const x = current.x + step
    if (x >= bounds.maxX) return { edge: nextEdge(current.edge), x: bounds.maxX, y: bounds.minY } satisfies GuardianPosition
    return { ...current, x }
  }

  const y = current.y + step
  if (y >= bounds.maxY) return { edge: nextEdge(current.edge), x: bounds.maxX, y: bounds.maxY } satisfies GuardianPosition
  return { ...current, y }
}

function advanceSqlLabDock(position: GuardianPosition, viewport: GuardianViewport): GuardianMotionPlan {
  const dock = getGuardianDockPosition(viewport, true)
  const bounds = getGuardianBounds(viewport, true)
  const current = normalizePosition(position, viewport, true)

  if (current.edge !== "right" || Math.abs(current.x - dock.x) > SQL_LAB_DOCK_STEP) {
    return {
      mode: "teleport",
      next: dock,
    }
  }

  const upperY = clamp(dock.y - SQL_LAB_DOCK_STEP, bounds.minY, bounds.maxY)
  const lowerY = dock.y

  return {
    mode: "walk",
    next: {
      edge: "right",
      x: dock.x,
      y: current.y > upperY + 8 ? upperY : lowerY,
    },
  }
}

function distance(a: GuardianPosition, b: GuardianPosition) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function planGuardianCruise(
  position: GuardianPosition,
  viewport: GuardianViewport,
  isSqlLab: boolean
): GuardianMotionPlan {
  if (isSqlLab) return advanceSqlLabDock(position, viewport)

  const target = advanceFullBoundary(position, viewport, isSqlLab)

  if (target.edge !== position.edge) {
    return {
      mode: "jump",
      next: target,
    }
  }

  return {
    mode: distance(position, target) > 220 ? "teleport" : "walk",
    next: target,
  }
}

export function getGuardianBubblePlacement(
  position: GuardianPosition | null,
  viewport: GuardianViewport | null,
  isSqlLab: boolean
): GuardianBubblePlacement {
  if (!position || !viewport || viewport.width < GUARDIAN_COMPACT_BREAKPOINT) return "compact"
  if (isSqlLab) return viewport.width < SQL_LAB_DOCKED_BREAKPOINT ? "compact" : "left"
  if (position.edge === "left") return "above-right"
  if (position.edge === "top") return "right"
  return "above-left"
}
