"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { mockGuardianProfile } from "@/lib/sql-guardian/mock-profile"
import {
  GUARDIAN_WAKE_EVENT,
  getGuardianWakeDetail,
  wakeGuardian,
} from "@/lib/sql-guardian/client-events"
import type { GuardianContext, GuardianVisualState } from "@/lib/sql-guardian/types"
import { GuardianBubble } from "@/components/sql-guardian/GuardianBubble"
import { GuardianControls } from "@/components/sql-guardian/GuardianControls"
import { GuardianSprite } from "@/components/sql-guardian/GuardianSprite"

const FIRST_OPEN_LINE = "我在数据港口守着呢。需要我帮你看一眼 SQL 航线吗？"
const SLEEPING_LINE = "呼……等你召唤我。"
const THINKING_LINE = "让我看看这些表之间的潮汐。"

const GENERAL_LINES = [
  "我在站点边界巡航。你写东西的时候，我会安静一点。",
  "今天的数据风很平稳。",
  "如果你迷路了，我可以带你回 SQL 港口。",
]

const SQL_LAB_LINES = [
  "我闻到了查询语句的味道。",
  "这条 SQL 航线看起来可以再检查一下。",
  "我先守着结果表，别让坏查询溜过去。",
]

function isSqlLabPath(pathname: string) {
  return pathname === "/sql" || pathname.startsWith("/sql/")
}

function pickLine(lines: string[], index: number) {
  return lines[index % lines.length] ?? FIRST_OPEN_LINE
}

export function GuardianHost() {
  const pathname = usePathname() ?? "/"
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [visualState, setVisualState] = useState<GuardianVisualState>("idle")
  const [message, setMessage] = useState(FIRST_OPEN_LINE)
  const [lineIndex, setLineIndex] = useState(0)
  const [hasOpened, setHasOpened] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  const context = useMemo<GuardianContext>(() => ({
    pagePath: pathname,
    isSqlLab: isSqlLabPath(pathname),
  }), [pathname])

  const contextLines = context.isSqlLab ? SQL_LAB_LINES : GENERAL_LINES
  const hostBottom = context.isSqlLab
    ? "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)"
    : "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)"

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(media.matches)

    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)")
    const collapseForNarrowScreen = () => {
      setMinimized(true)
      setBubbleOpen(false)
      setVisualState("hidden")
    }
    const timer = media.matches ? window.setTimeout(collapseForNarrowScreen, 0) : undefined

    const update = () => {
      if (!media.matches) return
      collapseForNarrowScreen()
    }

    media.addEventListener("change", update)
    return () => {
      if (timer) window.clearTimeout(timer)
      media.removeEventListener("change", update)
    }
  }, [])

  const openBubble = useCallback((state: GuardianVisualState = "talking", line?: string) => {
    setMinimized(false)
    setVisualState(state)
    setBubbleOpen(true)
    setMessage((current) => {
      if (line) return line
      if (!hasOpened) return FIRST_OPEN_LINE
      return current
    })
    setHasOpened(true)
  }, [hasOpened])

  const rotateContextLine = useCallback((state: GuardianVisualState = "talking") => {
    const line = !hasOpened ? FIRST_OPEN_LINE : pickLine(contextLines, lineIndex)
    setLineIndex((value) => value + 1)
    openBubble(state, line)
  }, [contextLines, hasOpened, lineIndex, openBubble])

  useEffect(() => {
    const handleWake = (event: Event) => {
      const { reason } = getGuardianWakeDetail(event)
      const nextLine = reason === "sql-lab-home"
        ? pickLine(SQL_LAB_LINES, lineIndex)
        : pickLine(contextLines, lineIndex)

      setLineIndex((value) => value + 1)
      openBubble("talking", nextLine)
    }

    window.addEventListener(GUARDIAN_WAKE_EVENT, handleWake)
    return () => window.removeEventListener(GUARDIAN_WAKE_EVENT, handleWake)
  }, [contextLines, lineIndex, openBubble])

  function closeBubble() {
    setBubbleOpen(false)
    setVisualState("idle")
  }

  function minimizeGuardian() {
    setBubbleOpen(false)
    setMinimized(true)
    setVisualState("hidden")
  }

  function restoreGuardian() {
    wakeGuardian("minimized-dock")
  }

  function thinkGuardian() {
    openBubble("thinking", THINKING_LINE)
  }

  function sleepGuardian() {
    openBubble("sleeping", SLEEPING_LINE)
  }

  if (minimized) {
    return (
      <div
        data-sql-guardian-host
        className="pointer-events-none fixed right-4 z-[39] sm:right-6"
        style={{ bottom: hostBottom }}
      >
        <div className="pointer-events-auto">
          <GuardianSprite
            profile={mockGuardianProfile}
            visualState="sleeping"
            reducedMotion={reducedMotion}
            size="sm"
            onClick={restoreGuardian}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      data-sql-guardian-host
      data-page-path={context.pagePath}
      className={cn(
        "pointer-events-none fixed right-4 z-[39] flex flex-col items-end gap-2 sm:right-6",
        context.isSqlLab ? "max-sm:right-3" : ""
      )}
      style={{ bottom: hostBottom }}
    >
      {bubbleOpen ? (
        <GuardianBubble
          profile={mockGuardianProfile}
          message={message}
          visualState={visualState}
          onClose={closeBubble}
        />
      ) : null}

      <div className="flex flex-col items-end gap-2">
        <GuardianControls onThink={thinkGuardian} onSleep={sleepGuardian} onMinimize={minimizeGuardian} />
        <GuardianSprite
          profile={mockGuardianProfile}
          visualState={visualState}
          reducedMotion={reducedMotion}
          onClick={() => rotateContextLine("talking")}
        />
      </div>
    </div>
  )
}
