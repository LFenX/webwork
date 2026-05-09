"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import {
  getGuardianBubbleMaxWidth,
  getGuardianBubblePlacement,
  getGuardianDockPosition,
  getGuardianDockMode,
  getGuardianHomeWakePosition,
  planGuardianCruise,
  type GuardianViewport,
} from "@/lib/sql-guardian/motion"
import type { GuardianEvent, GuardianPosition, GuardianRuntimeState } from "@/lib/sql-guardian/types"

type UseGuardianMotionOptions = {
  state: GuardianRuntimeState
  reducedMotion: boolean
  autoPatrolEnabled?: boolean
  send: (event: GuardianEvent) => void
}

type MoveOptions = {
  immediate?: boolean
}

const CRUISE_INTERVAL_MS = 4_800
const SQL_LAB_CRUISE_INTERVAL_MS = 11_500
const TELEPORT_SETTLE_MS = 620
const RESIZE_DEBOUNCE_MS = 140

function readViewport(): GuardianViewport {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

export function useGuardianMotion({ state, reducedMotion, autoPatrolEnabled = true, send }: UseGuardianMotionOptions) {
  const [viewport, setViewport] = useState<GuardianViewport | null>(null)
  const [position, setPosition] = useState<GuardianPosition | null>(null)
  const positionRef = useRef<GuardianPosition | null>(null)
  const viewportRef = useRef<GuardianViewport | null>(null)
  const teleportTimerRef = useRef<number | null>(null)
  const resizeTimerRef = useRef<number | null>(null)
  const jumpTimerRef = useRef<number | null>(null)

  useEffect(() => {
    positionRef.current = position
  }, [position])

  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  useEffect(() => {
    const updateViewport = () => {
      const nextViewport = readViewport()
      setViewport(nextViewport)
      setPosition((current) => current ?? getGuardianDockPosition(nextViewport, state.isSqlLab))
    }

    const handleViewportChange = () => {
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current)
      resizeTimerRef.current = window.setTimeout(updateViewport, RESIZE_DEBOUNCE_MS)
    }

    const timer = window.setTimeout(updateViewport, 0)
    window.addEventListener("resize", handleViewportChange)
    window.addEventListener("orientationchange", handleViewportChange)
    return () => {
      window.clearTimeout(timer)
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current)
      window.removeEventListener("resize", handleViewportChange)
      window.removeEventListener("orientationchange", handleViewportChange)
      if (teleportTimerRef.current) window.clearTimeout(teleportTimerRef.current)
      if (jumpTimerRef.current) window.clearTimeout(jumpTimerRef.current)
    }
  }, [state.isSqlLab])

  const finishTeleport = useCallback((target: GuardianPosition, nextVisualState?: GuardianRuntimeState["visualState"]) => {
    if (teleportTimerRef.current) window.clearTimeout(teleportTimerRef.current)

    if (reducedMotion) {
      setPosition(target)
      send({ type: "TELEPORT_COMPLETE", nextVisualState })
      return
    }

    teleportTimerRef.current = window.setTimeout(() => {
      setPosition(target)
      send({ type: "TELEPORT_COMPLETE", nextVisualState })
      teleportTimerRef.current = null
    }, TELEPORT_SETTLE_MS)
  }, [reducedMotion, send])

  const teleportToDock = useCallback((options: MoveOptions = {}) => {
    const currentViewport = viewportRef.current
    if (!currentViewport) return
    const target = getGuardianDockPosition(currentViewport, state.isSqlLab)
    if (options.immediate || reducedMotion) {
      setPosition(target)
      return
    }
    send({ type: "TELEPORT" })
    finishTeleport(target)
  }, [finishTeleport, reducedMotion, send, state.isSqlLab])

  const teleportToHome = useCallback((options: MoveOptions = {}) => {
    const currentViewport = viewportRef.current
    if (!currentViewport) return
    const target = getGuardianHomeWakePosition(currentViewport)
    if (options.immediate || reducedMotion) {
      setPosition(target)
      return
    }
    finishTeleport(target)
  }, [finishTeleport, reducedMotion])

  useEffect(() => {
    if (!viewport) return
    const timer = window.setTimeout(() => {
      setPosition(getGuardianDockPosition(viewport, state.isSqlLab))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [state.isSqlLab, viewport])

  useEffect(() => {
    if (
      reducedMotion ||
      !autoPatrolEnabled ||
      state.minimized ||
      state.bubbleOpen ||
      state.visualState === "sleeping" ||
      state.visualState === "thinking" ||
      state.visualState === "jumping" ||
      state.visualState === "teleporting"
    ) {
      return
    }

    const interval = window.setInterval(() => {
      const currentViewport = viewportRef.current
      const currentPosition = positionRef.current
      if (!currentViewport || !currentPosition || document.hidden) return

      const plan = planGuardianCruise(currentPosition, currentViewport, state.isSqlLab)
      if (plan.mode === "walk") {
        send({ type: "START_WALKING" })
        setPosition(plan.next)
        return
      }

      if (plan.mode === "jump") {
        send({ type: "BOUNDARY_BLOCKED" })
        setPosition(plan.next)
        if (jumpTimerRef.current) window.clearTimeout(jumpTimerRef.current)
        jumpTimerRef.current = window.setTimeout(() => {
          send({ type: "JUMP_COMPLETE", nextVisualState: "walking" })
          jumpTimerRef.current = null
        }, 760)
        return
      }

      send({ type: "TELEPORT" })
      finishTeleport(plan.next)
    }, state.isSqlLab ? SQL_LAB_CRUISE_INTERVAL_MS : CRUISE_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [
    finishTeleport,
    autoPatrolEnabled,
    reducedMotion,
    send,
    state.bubbleOpen,
    state.isSqlLab,
    state.minimized,
    state.visualState,
  ])

  const fallbackStyle = useMemo<CSSProperties>(() => ({
    bottom: state.isSqlLab
      ? "calc(env(safe-area-inset-bottom, 0px) + 7.5rem)"
      : "calc(env(safe-area-inset-bottom, 0px) + 6rem)",
    right: "1.5rem",
  }), [state.isSqlLab])

  const style = useMemo<CSSProperties>(() => {
    if (!position) return fallbackStyle
    return {
      left: `${Math.round(position.x)}px`,
      top: `${Math.round(position.y)}px`,
    }
  }, [fallbackStyle, position])

  const dockMode = useMemo(() => (
    viewport ? getGuardianDockMode(viewport, state.isSqlLab, state.minimized) : state.isSqlLab ? "docked" : "floating"
  ), [state.isSqlLab, state.minimized, viewport])

  const bubblePlacement = useMemo(() => (
    getGuardianBubblePlacement(position, viewport, state.isSqlLab)
  ), [position, state.isSqlLab, viewport])

  const bubbleMaxWidth = useMemo(() => (
    getGuardianBubbleMaxWidth(dockMode, state.isSqlLab)
  ), [dockMode, state.isSqlLab])

  return {
    position,
    viewport,
    dockMode,
    bubblePlacement,
    bubbleMaxWidth,
    ready: Boolean(position),
    style,
    teleportToDock,
    teleportToHome,
  }
}
