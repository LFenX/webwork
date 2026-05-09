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
import { getGuardianLevelUpLine } from "@/lib/sql-guardian/visual-forms"
import type {
  GuardianBubblePlacement,
  GuardianClientEventType,
  GuardianDockMode,
  GuardianRuntimeState,
  GuardianSettings,
} from "@/lib/sql-guardian/types"
import { GuardianBubble } from "@/components/sql-guardian/GuardianBubble"
import { GuardianControls } from "@/components/sql-guardian/GuardianControls"
import { GuardianSprite } from "@/components/sql-guardian/GuardianSprite"
import { useGuardianChat } from "@/components/sql-guardian/useGuardianChat"
import { useGuardianController } from "@/components/sql-guardian/useGuardianController"
import { useGuardianMemoryBridge } from "@/components/sql-guardian/useGuardianMemoryBridge"
import { useGuardianMemories } from "@/components/sql-guardian/useGuardianMemories"
import { useGuardianMotion } from "@/components/sql-guardian/useGuardianMotion"
import { useGuardianProfile } from "@/components/sql-guardian/useGuardianProfile"
import { useGuardianReset } from "@/components/sql-guardian/useGuardianReset"
import { useGuardianSettings } from "@/components/sql-guardian/useGuardianSettings"

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
    updateProfile,
  } = useGuardianProfile()
  const guardianSettings = useGuardianSettings({ profile, onProfileUpdated: applyProfileUpdate })
  const guardianMemories = useGuardianMemories({ profile, updateProfile })
  const guardianMemoryBridge = useGuardianMemoryBridge({ profile })
  const stateRef = useRef<GuardianRuntimeState>(state)
  const handledLevelUpAtRef = useRef<number | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const effectiveReducedMotion = reducedMotion || !guardianSettings.settings.animationsEnabled
  const {
    position,
    dockMode,
    bubblePlacement,
    bubbleMaxWidth,
    ready,
    style,
    teleportToDock,
    teleportToHome,
  } = useGuardianMotion({
    state,
    reducedMotion: effectiveReducedMotion,
    autoPatrolEnabled: guardianSettings.settings.guardianEnabled && guardianSettings.settings.autoPatrolEnabled,
    send,
  })
  const handleChatReply = useCallback((reply: string) => {
    send({ type: "OPEN_BUBBLE", line: reply })
  }, [send])
  const guardianChat = useGuardianChat({
    pagePath: pathname,
    guardianEnabled: guardianSettings.settings.guardianEnabled,
    chatHistoryEnabled: guardianSettings.settings.guardianChatHistoryEnabled,
    onReply: handleChatReply,
    onProfileUpdated: applyProfileUpdate,
    onMemoryCandidates: guardianMemories.handleChatMemoryCandidates,
  })
  const guardianReset = useGuardianReset({
    onReset: (response) => {
      applyProfileUpdate(response)
      void guardianMemories.refreshMemories()
      void guardianMemoryBridge.refreshBridge()
      void guardianChat.refreshDialogues()
    },
  })

  const handleToggleSetting = useCallback(async <K extends keyof GuardianSettings>(
    key: K,
    value: GuardianSettings[K]
  ) => {
    const response = await guardianSettings.updateSetting(key, value)
    if (!response) return response

    if (key === "guardianMemoryEnabled") {
      void guardianMemories.refreshMemories()
    }
    if (
      key === "soulwingToGuardianMemoryBridgeEnabled" ||
      key === "guardianToSoulWingMemoryBridgeEnabled"
    ) {
      void guardianMemoryBridge.refreshBridge()
    }
    if (key === "guardianChatHistoryEnabled") {
      void guardianChat.refreshDialogues()
    }

    return response
  }, [guardianChat, guardianMemoryBridge, guardianMemories, guardianSettings])

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
    if (!guardianSettings.settings.guardianEnabled) return
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
  }, [dockMode, guardianSettings.settings.guardianEnabled, isSqlLab, recordGuardianEvent, send, teleportToDock])

  useEffect(() => {
    if (!guardianSettings.settings.guardianEnabled) return
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
  }, [guardianSettings.settings.guardianEnabled, send])

  const handleWake = useCallback((event: Event) => {
    if (!guardianSettings.settings.guardianEnabled) return
    const { reason } = getGuardianWakeDetail(event)
    if (reason === "home-clicked" || reason === "sql-lab") {
      send({ type: "HOME_CLICKED", useTeleport: !effectiveReducedMotion, line: HOME_WAKE_LINE })
      teleportToHome({ immediate: effectiveReducedMotion })
      void recordGuardianEvent("HOME_CLICKED", "sql-assistant-home", { dockMode, reason })
      return
    }

    send({ type: "WAKE", useTeleport: false })
    if (!reason || reason === "manual" || reason === "minimized-dock") {
      void recordGuardianEvent("GUARDIAN_WOKE", "guardian-wake", { reason: reason ?? "manual" })
    }
  }, [dockMode, effectiveReducedMotion, guardianSettings.settings.guardianEnabled, recordGuardianEvent, send, teleportToHome])

  useEffect(() => {
    window.addEventListener(GUARDIAN_WAKE_EVENT, handleWake)
    return () => window.removeEventListener(GUARDIAN_WAKE_EVENT, handleWake)
  }, [handleWake])

  useEffect(() => {
    const handleCommand = (event: Event) => {
      const detail = getGuardianCommandDetail(event)
      if (!detail) return
      if (!guardianSettings.settings.guardianEnabled) return
      send({ type: detail.command })
      if (detail.command === "WAKE" || detail.command === "RESTORE") {
        void recordGuardianEvent("GUARDIAN_WOKE", "guardian-command")
      }
    }

    window.addEventListener(GUARDIAN_COMMAND_EVENT, handleCommand)
    return () => window.removeEventListener(GUARDIAN_COMMAND_EVENT, handleCommand)
  }, [guardianSettings.settings.guardianEnabled, recordGuardianEvent, send])

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
    if (!guardianSettings.settings.autoBubbleEnabled) {
      acknowledgeLevelUp()
      return
    }
    send({
      type: "LEVEL_UP",
      line: getGuardianLevelUpLine({
        level: lastLevelUp.level,
        title: lastLevelUp.title,
        formStage: profile.formStage,
      }),
    })

    const timer = window.setTimeout(() => {
      send({ type: "LEVEL_UP_COMPLETE" })
      acknowledgeLevelUp()
    }, effectiveReducedMotion ? 1_800 : LEVEL_UP_RESET_MS)

    return () => window.clearTimeout(timer)
  }, [
    acknowledgeLevelUp,
    effectiveReducedMotion,
    guardianSettings.settings.autoBubbleEnabled,
    lastLevelUp,
    profile.formStage,
    send,
  ])

  useEffect(() => {
    if (!state.isSqlLab || !state.bubbleOpen || guardianChat.chatOpen || guardianChat.pending) return
    const timer = window.setTimeout(() => {
      send({ type: "CLOSE_BUBBLE" })
    }, SQL_LAB_BUBBLE_AUTO_CLOSE_MS)

    return () => window.clearTimeout(timer)
  }, [
    guardianChat.chatOpen,
    guardianChat.pending,
    send,
    state.bubbleOpen,
    state.currentLine,
    state.isSqlLab,
  ])

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

  if (!guardianSettings.settings.guardianEnabled) {
    return (
      <div
        data-sql-guardian-host
        data-page-path={pathname}
        data-dock-mode="disabled"
        className="pointer-events-none fixed bottom-5 right-5 z-[39] max-w-[min(22rem,calc(100vw-2rem))]"
      >
        <div className="pointer-events-auto rounded-md border border-cyan-100 bg-[--color-bg-surface]/95 p-2 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleToggleSetting("guardianEnabled", true)}
              className="rounded border border-cyan-200 bg-cyan-50 px-2 py-1 font-mono text-[10px] text-cyan-800 hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]"
              aria-label="Resume SQL Guardian"
              title="Resume SQL Guardian"
            >
              Resume Guardian
            </button>
            <button
              type="button"
              onClick={guardianSettings.settingsOpen ? guardianSettings.closeSettings : guardianSettings.openSettings}
              className="rounded px-2 py-1 font-mono text-[10px] text-[--color-text-muted] hover:bg-[--color-bg-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]"
              aria-label="Open SQL Guardian settings"
              title="Settings"
            >
              Settings
            </button>
          </div>
          {guardianSettings.settingsOpen ? (
            <GuardianBubble
              profile={profile}
              progress={progress}
              message="SQL Guardian is paused. You can resume it here without losing your privacy settings."
              visualState="sleeping"
              onClose={guardianSettings.closeSettings}
              placement="above-left"
              dockMode="floating"
              maxWidth={320}
              isSqlLab={isSqlLab}
              settingsOnly
              settings={guardianSettings.settings}
              settingsOpen
              settingsLoading={guardianSettings.loading}
              settingsError={guardianSettings.error}
              onCloseSettings={guardianSettings.closeSettings}
              onToggleSetting={handleToggleSetting}
              resetScope={guardianReset.scope}
              resetConfirmText={guardianReset.confirmText}
              resetPending={guardianReset.pending}
              resetError={guardianReset.error}
              resetLastResult={guardianReset.lastResult}
              onResetScopeChange={guardianReset.setScope}
              onResetConfirmTextChange={guardianReset.setConfirmText}
              onSubmitReset={guardianReset.submitReset}
              className="mt-2"
            />
          ) : null}
        </div>
      </div>
    )
  }

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
            reducedMotion={effectiveReducedMotion}
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
            memories={guardianMemories.memories}
            memoryOpen={guardianMemories.memoryOpen}
            memoryLoading={guardianMemories.loading}
            memoryError={guardianMemories.error}
            memoryEnabled={guardianMemories.memoryEnabled}
            memoryDraft={guardianMemories.draft}
            memoryNoticeCount={guardianMemories.candidateNoticeCount}
            onMemoryDraftChange={guardianMemories.setDraft}
            onOpenMemory={guardianMemories.openMemory}
            onCloseMemory={guardianMemories.closeMemory}
            onCreateMemory={guardianMemories.createMemory}
            onConfirmMemory={guardianMemories.confirmMemory}
            onRejectMemory={guardianMemories.rejectMemory}
            onDeleteMemory={guardianMemories.deleteMemory}
            onToggleMemoryEnabled={guardianMemories.setMemoryEnabled}
            bridgeItems={guardianMemoryBridge.items}
            bridgeOpen={guardianMemoryBridge.bridgeOpen}
            bridgeLoading={guardianMemoryBridge.loading}
            bridgeError={guardianMemoryBridge.error}
            bridgeEnabled={guardianMemoryBridge.soulwingToGuardianEnabled}
            bridgeSoulWingAvailable={guardianMemoryBridge.soulWingMemoryAvailable}
            onOpenBridge={guardianMemoryBridge.openBridge}
            onCloseBridge={guardianMemoryBridge.closeBridge}
            onToggleBridgeEnabled={guardianMemoryBridge.setSoulwingToGuardianEnabled}
            onRevokeBridge={guardianMemoryBridge.revokeBridge}
            settings={guardianSettings.settings}
            settingsOpen={guardianSettings.settingsOpen}
            settingsLoading={guardianSettings.loading}
            settingsError={guardianSettings.error}
            onOpenSettings={guardianSettings.openSettings}
            onCloseSettings={guardianSettings.closeSettings}
            onToggleSetting={handleToggleSetting}
            resetScope={guardianReset.scope}
            resetConfirmText={guardianReset.confirmText}
            resetPending={guardianReset.pending}
            resetError={guardianReset.error}
            resetLastResult={guardianReset.lastResult}
            onResetScopeChange={guardianReset.setScope}
            onResetConfirmTextChange={guardianReset.setConfirmText}
            onSubmitReset={guardianReset.submitReset}
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
            reducedMotion={effectiveReducedMotion}
            size={spriteSize}
            onClick={handleSpriteClick}
          />
        </div>
      </div>
    </div>
  )
}
