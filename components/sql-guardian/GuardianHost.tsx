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
import type {
  GuardianBubblePlacement,
  GuardianClientEventType,
  GuardianDockMode,
  GuardianRuntimeState,
} from "@/lib/sql-guardian/types"
import { GuardianBubble } from "@/components/sql-guardian/GuardianBubble"
import { GuardianControls } from "@/components/sql-guardian/GuardianControls"
import { GuardianSprite } from "@/components/sql-guardian/GuardianSprite"
import { useGuardianChat } from "@/components/sql-guardian/useGuardianChat"
import { useGuardianController } from "@/components/sql-guardian/useGuardianController"
import { useGuardianMotion } from "@/components/sql-guardian/useGuardianMotion"
import { useGuardianProfile } from "@/components/sql-guardian/useGuardianProfile"

const ACTIVITY_THROTTLE_MS = 1_200
const THINKING_RESET_MS = 3_800
const LEVEL_UP_RESET_MS = 3_400
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

function getLevelUpLine(level: number, title: string) {
  return `数据港的灯更亮了，Lv.${level} 守门人归位。现在我是：${title}。`
}

export function GuardianHost() {
  const pathname = usePathname() ?? "/"
  const isSqlLab = useMemo(() => isSqlLabPath(pathname), [pathname])
  const { state, send } = useGuardianController(isSqlLab)
  const {
    profile,
    progress,
    recordEvent,
    lastLevelUp,
    acknowledgeLevelUp,
    applyProfileUpdate,
  } = useGuardianProfile()
  const stateRef = useRef<GuardianRuntimeState>(state)
  const handledLevelUpAtRef = useRef<number | null>(null)
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
  const handleChatReply = useCallback((reply: string) => {
    send({ type: "OPEN_BUBBLE", line: reply })
  }, [send])
  const guardianChat = useGuardianChat({
    pagePath: pathname,
    onReply: handleChatReply,
    onProfileUpdated: applyProfileUpdate,
  })

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const recordGuardianEvent = useCallback((
    eventType: GuardianClientEventType,
    source: string,
    eventPayloadJson?: Record<string, unknown>
  ) => {
    return recordEvent({
      eventType,
      source,
      pagePath: pathname,
      eventPayloadJson,
    })
  }, [pathname, recordEvent])

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
        void recordGuardianEvent("ENTER_SQL_LAB", "route", { dockMode })
      }
      if (!isSqlLab && current.isSqlLab) {
        send({ type: "LEAVE_SQL_LAB" })
        teleportToDock({ immediate: true })
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [dockMode, isSqlLab, recordGuardianEvent, send, teleportToDock])

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
      void recordGuardianEvent("HOME_CLICKED", "sql-assistant-home", { dockMode, reason })
      return
    }

    send({ type: "WAKE", useTeleport: false })
    if (!reason || reason === "manual" || reason === "minimized-dock") {
      void recordGuardianEvent("GUARDIAN_WOKE", "guardian-wake", { reason: reason ?? "manual" })
    }
  }, [dockMode, recordGuardianEvent, reducedMotion, send, teleportToHome])

  useEffect(() => {
    window.addEventListener(GUARDIAN_WAKE_EVENT, handleWake)
    return () => window.removeEventListener(GUARDIAN_WAKE_EVENT, handleWake)
  }, [handleWake])

  useEffect(() => {
    const handleCommand = (event: Event) => {
      const detail = getGuardianCommandDetail(event)
      if (!detail) return
      send({ type: detail.command })
      if (detail.command === "WAKE" || detail.command === "RESTORE") {
        void recordGuardianEvent("GUARDIAN_WOKE", "guardian-command")
      }
    }

    window.addEventListener(GUARDIAN_COMMAND_EVENT, handleCommand)
    return () => window.removeEventListener(GUARDIAN_COMMAND_EVENT, handleCommand)
  }, [recordGuardianEvent, send])

  useEffect(() => {
    if (state.visualState !== "thinking") return
    const timer = window.setTimeout(() => {
      send({ type: "STOP_THINKING" })
    }, THINKING_RESET_MS)

    return () => window.clearTimeout(timer)
  }, [send, state.visualState])

  useEffect(() => {
    if (!lastLevelUp || handledLevelUpAtRef.current === lastLevelUp.at) return
    handledLevelUpAtRef.current = lastLevelUp.at
    send({ type: "LEVEL_UP", line: getLevelUpLine(lastLevelUp.level, lastLevelUp.title) })

    const timer = window.setTimeout(() => {
      send({ type: "LEVEL_UP_COMPLETE" })
      acknowledgeLevelUp()
    }, reducedMotion ? 1_800 : LEVEL_UP_RESET_MS)

    return () => window.clearTimeout(timer)
  }, [acknowledgeLevelUp, lastLevelUp, reducedMotion, send])

  useEffect(() => {
    if (!state.isSqlLab || !state.bubbleOpen || guardianChat.chatOpen || guardianChat.pending) return
    const timer = window.setTimeout(() => {
      send({ type: "CLOSE_BUBBLE" })
    }, SQL_LAB_BUBBLE_AUTO_CLOSE_MS)

    return () => window.clearTimeout(timer)
  }, [guardianChat.chatOpen, guardianChat.pending, send, state.bubbleOpen, state.currentLine, state.isSqlLab])

  const handleMinimizedSpriteClick = useCallback(() => {
    send({ type: "WAKE" })
    void recordGuardianEvent("GUARDIAN_WOKE", "minimized-sprite")
  }, [recordGuardianEvent, send])

  const handleSpriteClick = useCallback(() => {
    const bubbleWasOpen = stateRef.current.bubbleOpen
    send({ type: "SPRITE_CLICKED" })
    void recordGuardianEvent("SPRITE_CLICKED", "guardian-sprite")
    if (!bubbleWasOpen) {
      void recordGuardianEvent("BUBBLE_OPENED", "guardian-sprite")
    }
  }, [recordGuardianEvent, send])

  const handleSubmitChat = useCallback(() => {
    send({ type: "START_THINKING", line: "让我听听这条查询航线的回声。" })
    void guardianChat.sendMessage()
  }, [guardianChat, send])

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
            profile={profile}
            visualState="sleeping"
            reducedMotion={reducedMotion}
            size="sm"
            onClick={handleMinimizedSpriteClick}
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
            profile={profile}
            progress={progress}
            message={state.currentLine}
            visualState={state.visualState}
            placement={bubblePlacement}
            dockMode={dockMode}
            maxWidth={bubbleMaxWidth}
            isSqlLab={state.isSqlLab}
            dialogues={guardianChat.dialogues}
            loadingDialogues={guardianChat.loadingDialogues}
            chatOpen={guardianChat.chatOpen}
            chatPending={guardianChat.pending}
            chatError={guardianChat.error}
            chatInput={guardianChat.input}
            onChatInputChange={guardianChat.setInput}
            onOpenChat={guardianChat.openChat}
            onCloseChat={guardianChat.closeChat}
            onSubmitChat={handleSubmitChat}
            onClose={() => send({ type: "CLOSE_BUBBLE" })}
            className={cn("absolute", bubbleClass)}
          />
        ) : null}

        <GuardianControls
          profile={profile}
          mode={controlsMode}
          onThink={() => send({ type: "START_THINKING" })}
          onSleep={() => send({ type: "USER_IDLE" })}
          onMinimize={() => send({ type: "MINIMIZE" })}
          className={cn("absolute max-sm:hidden", controlsClass)}
        />

        <div className="pointer-events-auto absolute inset-0">
          <GuardianSprite
            profile={profile}
            visualState={state.visualState}
            reducedMotion={reducedMotion}
            size={spriteSize}
            onClick={handleSpriteClick}
          />
        </div>
      </div>
    </div>
  )
}
