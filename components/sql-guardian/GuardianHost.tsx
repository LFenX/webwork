"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { getGuardianIdleDelayMs, isSqlLabPath } from "@/lib/sql-guardian/behavior"
import {
  GUARDIAN_COMMAND_EVENT,
  GUARDIAN_WAKE_EVENT,
  getGuardianCommandDetail,
  getGuardianWakeDetail,
} from "@/lib/sql-guardian/client-events"
import { mockGuardianProfile } from "@/lib/sql-guardian/mock-profile"
import type {
  GuardianBubblePlacement,
  GuardianDockMode,
  GuardianRuntimeState,
} from "@/lib/sql-guardian/types"
import { GuardianBubble } from "@/components/sql-guardian/GuardianBubble"
import { GuardianControls } from "@/components/sql-guardian/GuardianControls"
import { GuardianSprite } from "@/components/sql-guardian/GuardianSprite"
import { useGuardianController } from "@/components/sql-guardian/useGuardianController"
import { useGuardianMotion } from "@/components/sql-guardian/useGuardianMotion"

const ACTIVITY_THROTTLE_MS = 1_200
const THINKING_RESET_MS = 3_800
const SQL_LAB_BUBBLE_AUTO_CLOSE_MS = 7_200
const COMPACT_VIEWPORT_QUERY = "(max-width: 767px)"
const HOME_WAKE_LINE = "我从查询小屋出来了。"

type GuardianSpriteSize = "sm" | "sql" | "md"

function getBubblePlacementClass(placement: GuardianBubblePlacement) {
  if (placement === "above-right") return "left-0 bottom-[calc(100%+0.55rem)] origin-bottom-left"
  if (placement === "left") return "right-[calc(100%+0.65rem)] bottom-0 origin-bottom-right"
  if (placement === "right") return "left-[calc(100%+0.65rem)] top-0 origin-top-left"
  if (placement === "compact") return "right-0 bottom-[calc(100%+0.45rem)] origin-bottom-right"
  return "right-0 bottom-[calc(100%+0.55rem)] origin-bottom-right"
}

function getControlsPlacementClass(dockMode: GuardianDockMode, placement: GuardianBubblePlacement) {
  if (dockMode === "docked" || dockMode === "compact" || placement === "left") {
    return "right-0 top-[calc(100%+0.3rem)]"
  }
  if (placement === "right") return "left-0 top-[calc(100%+0.4rem)]"
  return "right-0 bottom-[calc(100%+0.5rem)]"
}

function getSpriteSize(dockMode: GuardianDockMode, isSqlLab: boolean): GuardianSpriteSize {
  if (dockMode === "compact" || dockMode === "minimized") return "sm"
  return isSqlLab ? "sql" : "md"
}

function getSpriteShellClass(size: GuardianSpriteSize) {
  if (size === "sm") return "size-12"
  if (size === "sql") return "size-[68px]"
  return "size-20"
}

export function GuardianHost() {
  const pathname = usePathname() ?? "/"
  const isSqlLab = useMemo(() => isSqlLabPath(pathname), [pathname])
  const { state, send } = useGuardianController(isSqlLab)
  const stateRef = useRef<GuardianRuntimeState>(state)
  const [reducedMotion, setReducedMotion] = useState(false)
  const {
    position,
    dockMode,
    bubblePlacement,
    bubbleMaxWidth,
    ready,
    style,
    teleportToDock,
    teleportToHome,
  } = useGuardianMotion({ state, reducedMotion, send })

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(media.matches)
    const timer = window.setTimeout(update, 0)

    media.addEventListener("change", update)
    return () => {
      window.clearTimeout(timer)
      media.removeEventListener("change", update)
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia(COMPACT_VIEWPORT_QUERY)
    const collapse = () => send({ type: "MINIMIZE" })
    const timer = media.matches ? window.setTimeout(collapse, 0) : undefined
    const handleChange = () => {
      if (media.matches) collapse()
    }

    media.addEventListener("change", handleChange)
    return () => {
      if (timer) window.clearTimeout(timer)
      media.removeEventListener("change", handleChange)
    }
  }, [send])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = stateRef.current
      if (isSqlLab && !current.isSqlLab) {
        send({ type: "ENTER_SQL_LAB" })
        teleportToDock({ immediate: true })
      }
      if (!isSqlLab && current.isSqlLab) {
        send({ type: "LEAVE_SQL_LAB" })
        teleportToDock({ immediate: true })
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [isSqlLab, send, teleportToDock])

  useEffect(() => {
    let idleTimer: number | undefined
    let lastActivityAt = 0

    const scheduleIdle = () => {
      if (idleTimer) window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => {
        send({ type: "USER_IDLE" })
      }, getGuardianIdleDelayMs(stateRef.current.isSqlLab))
    }

    const handleActivity = () => {
      const now = Date.now()
      const current = stateRef.current
      if (current.visualState !== "sleeping" && now - lastActivityAt < ACTIVITY_THROTTLE_MS) return
      lastActivityAt = now
      if (current.visualState === "sleeping") send({ type: "USER_ACTIVITY" })
      scheduleIdle()
    }

    const startTimer = window.setTimeout(scheduleIdle, 0)
    window.addEventListener("mousemove", handleActivity, { passive: true })
    window.addEventListener("pointerdown", handleActivity, { passive: true })
    window.addEventListener("scroll", handleActivity, { passive: true })
    window.addEventListener("keydown", handleActivity)

    return () => {
      window.clearTimeout(startTimer)
      if (idleTimer) window.clearTimeout(idleTimer)
      window.removeEventListener("mousemove", handleActivity)
      window.removeEventListener("pointerdown", handleActivity)
      window.removeEventListener("scroll", handleActivity)
      window.removeEventListener("keydown", handleActivity)
    }
  }, [send])

  const handleWake = useCallback((event: Event) => {
    const { reason } = getGuardianWakeDetail(event)
    if (reason === "home-clicked" || reason === "sql-lab") {
      send({ type: "HOME_CLICKED", useTeleport: !reducedMotion, line: HOME_WAKE_LINE })
      teleportToHome({ immediate: reducedMotion })
      return
    }

    send({ type: "WAKE", useTeleport: false })
  }, [reducedMotion, send, teleportToHome])

  useEffect(() => {
    window.addEventListener(GUARDIAN_WAKE_EVENT, handleWake)
    return () => window.removeEventListener(GUARDIAN_WAKE_EVENT, handleWake)
  }, [handleWake])

  useEffect(() => {
    const handleCommand = (event: Event) => {
      const detail = getGuardianCommandDetail(event)
      if (!detail) return
      send({ type: detail.command })
    }

    window.addEventListener(GUARDIAN_COMMAND_EVENT, handleCommand)
    return () => window.removeEventListener(GUARDIAN_COMMAND_EVENT, handleCommand)
  }, [send])

  useEffect(() => {
    if (state.visualState !== "thinking") return
    const timer = window.setTimeout(() => {
      send({ type: "STOP_THINKING" })
    }, THINKING_RESET_MS)

    return () => window.clearTimeout(timer)
  }, [send, state.visualState])

  useEffect(() => {
    if (!state.isSqlLab || !state.bubbleOpen) return
    const timer = window.setTimeout(() => {
      send({ type: "CLOSE_BUBBLE" })
    }, SQL_LAB_BUBBLE_AUTO_CLOSE_MS)

    return () => window.clearTimeout(timer)
  }, [send, state.bubbleOpen, state.currentLine, state.isSqlLab])

  const spriteSize = getSpriteSize(dockMode, state.isSqlLab)
  const shellClass = getSpriteShellClass(spriteSize)
  const bubbleClass = getBubblePlacementClass(bubblePlacement)
  const controlsClass = getControlsPlacementClass(dockMode, bubblePlacement)
  const controlsMode = state.isSqlLab || dockMode === "compact" ? "minimal" : "full"

  if (state.minimized) {
    return (
      <div
        data-sql-guardian-host
        data-page-path={pathname}
        data-dock-mode="minimized"
        className={cn(
          "pointer-events-none fixed z-[39] transition-[left,top,opacity] duration-700 ease-out motion-reduce:transition-none",
          !ready ? "opacity-0" : "opacity-100"
        )}
        style={style}
      >
        <div className="pointer-events-auto">
          <GuardianSprite
            profile={mockGuardianProfile}
            visualState="sleeping"
            reducedMotion={reducedMotion}
            size="sm"
            onClick={() => send({ type: "WAKE" })}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      data-sql-guardian-host
      data-page-path={pathname}
      data-dock-mode={dockMode}
      data-bubble-placement={bubblePlacement}
      data-edge={position?.edge}
      className={cn(
        "pointer-events-none fixed z-[39] transition-[left,top,opacity] duration-700 ease-out motion-reduce:transition-none",
        !ready ? "opacity-0" : "opacity-100"
      )}
      style={style}
    >
      <div className={cn("group/guardian relative", shellClass)}>
        {state.bubbleOpen ? (
          <GuardianBubble
            profile={mockGuardianProfile}
            message={state.currentLine}
            visualState={state.visualState}
            placement={bubblePlacement}
            dockMode={dockMode}
            maxWidth={bubbleMaxWidth}
            isSqlLab={state.isSqlLab}
            onClose={() => send({ type: "CLOSE_BUBBLE" })}
            className={cn("absolute", bubbleClass)}
          />
        ) : null}

        <GuardianControls
          mode={controlsMode}
          onThink={() => send({ type: "START_THINKING" })}
          onSleep={() => send({ type: "USER_IDLE" })}
          onMinimize={() => send({ type: "MINIMIZE" })}
          className={cn("absolute max-sm:hidden", controlsClass)}
        />

        <div className="pointer-events-auto absolute inset-0">
          <GuardianSprite
            profile={mockGuardianProfile}
            visualState={state.visualState}
            reducedMotion={reducedMotion}
            size={spriteSize}
            onClick={() => send({ type: "SPRITE_CLICKED" })}
          />
        </div>
      </div>
    </div>
  )
}
