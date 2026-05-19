"use client"

import { useCallback, useEffect, useRef } from "react"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { StepCard, type SqlRunRepairInput } from "@/components/sql-lab/stage/step-card"
import type { SqlThreadDetail } from "@/lib/sql-lab/types"

type Props = {
  thread: SqlThreadDetail | null
  loading?: boolean
  streaming?: boolean
  onApplySql?: (sql: string, title?: string) => void
  onRunSql?: (sql: string, title?: string, stepId?: string) => void
  onRepairSql?: (input: SqlRunRepairInput) => void
  onInsertTable?: (qualifiedName: string) => void
  rewindBeforeStepId?: string | null
  onRewindBefore?: (stepId: string) => void
  onClearRewind?: () => void
  emptyHint?: string
}

const STAGE_THREAD_BOTTOM_STICKY_THRESHOLD = 120
const STAGE_THREAD_BOTTOM_RESUME_THRESHOLD = 4

function isStageThreadNearBottom(element: HTMLElement | null) {
  if (!element) return true
  return element.scrollHeight - element.scrollTop - element.clientHeight <= STAGE_THREAD_BOTTOM_STICKY_THRESHOLD
}

function isStageThreadAtBottom(element: HTMLElement | null) {
  if (!element) return true
  return element.scrollHeight - element.scrollTop - element.clientHeight <= STAGE_THREAD_BOTTOM_RESUME_THRESHOLD
}

export function StageThread({ thread, loading, streaming, onApplySql, onRunSql, onRepairSql, onInsertTable, rewindBeforeStepId, onRewindBefore, onClearRewind, emptyHint }: Props) {
  const threadRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const shouldStickToBottomRef = useRef(true)
  const forceScrollToBottomRef = useRef(false)
  const userPausedAutoScrollRef = useRef(false)
  const userRequestedAutoScrollResumeRef = useRef(false)
  const scrollFrameRef = useRef<number | null>(null)
  const touchYRef = useRef<number | null>(null)
  const stepsLength = thread?.steps?.length ?? 0
  const lastStepId = stepsLength ? thread?.steps[stepsLength - 1]?.id ?? null : null
  const threadId = thread?.id ?? null

  const getScrollContainer = useCallback(() => threadRef.current?.parentElement as HTMLElement | null, [])

  const scrollToLatestStep = useCallback(() => {
    const container = getScrollContainer()
    if (!container) return

    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current)
      scrollFrameRef.current = null
    }

    container.scrollTop = container.scrollHeight
    if (!userPausedAutoScrollRef.current) {
      shouldStickToBottomRef.current = true
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null
      if (userPausedAutoScrollRef.current) return
      container.scrollTop = container.scrollHeight
    })
  }, [getScrollContainer])

  const pauseAutoScrollForUser = useCallback(() => {
    userPausedAutoScrollRef.current = true
    userRequestedAutoScrollResumeRef.current = false
    shouldStickToBottomRef.current = false
    forceScrollToBottomRef.current = false

    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current)
      scrollFrameRef.current = null
    }
  }, [])

  const requestAutoScrollResume = useCallback(() => {
    userRequestedAutoScrollResumeRef.current = true
  }, [])

  const syncAutoScrollAfterUserScroll = useCallback((container: HTMLElement) => {
    if (userPausedAutoScrollRef.current) {
      shouldStickToBottomRef.current = false
      if (userRequestedAutoScrollResumeRef.current && isStageThreadAtBottom(container)) {
        userPausedAutoScrollRef.current = false
        userRequestedAutoScrollResumeRef.current = false
        shouldStickToBottomRef.current = true
      }
      return
    }

    const isNearBottom = isStageThreadNearBottom(container)
    shouldStickToBottomRef.current = isNearBottom
    if (isNearBottom) userRequestedAutoScrollResumeRef.current = false
  }, [])

  useEffect(() => {
    shouldStickToBottomRef.current = true
    forceScrollToBottomRef.current = Boolean(threadId)
    userPausedAutoScrollRef.current = false
    userRequestedAutoScrollResumeRef.current = false
  }, [threadId])

  useEffect(() => {
    if (!stepsLength) return
    if (!forceScrollToBottomRef.current && (userPausedAutoScrollRef.current || !shouldStickToBottomRef.current)) return

    forceScrollToBottomRef.current = false
    scrollToLatestStep()
  }, [lastStepId, scrollToLatestStep, stepsLength, streaming])

  useEffect(() => {
    const container = getScrollContainer()
    if (!container) return
    const previousOverflowAnchor = container.style.overflowAnchor
    container.style.overflowAnchor = "none"
    const captureOptions = { passive: true, capture: true } as const
    const removeCaptureOptions = { capture: true } as const

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) pauseAutoScrollForUser()
      else if (event.deltaY > 0) requestAutoScrollResume()
    }
    const handleTouchStart = (event: TouchEvent) => {
      touchYRef.current = event.touches[0]?.clientY ?? null
    }
    const handleTouchMove = (event: TouchEvent) => {
      const currentY = event.touches[0]?.clientY ?? null
      const previousY = touchYRef.current
      if (currentY === null || previousY === null) {
        pauseAutoScrollForUser()
        touchYRef.current = currentY
        return
      }
      if (currentY > previousY) pauseAutoScrollForUser()
      else if (currentY < previousY) requestAutoScrollResume()
      touchYRef.current = currentY
    }
    const handleScroll = () => {
      syncAutoScrollAfterUserScroll(container)
    }

    container.addEventListener("wheel", handleWheel, captureOptions)
    container.addEventListener("touchstart", handleTouchStart, captureOptions)
    container.addEventListener("touchmove", handleTouchMove, captureOptions)
    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      container.style.overflowAnchor = previousOverflowAnchor
      container.removeEventListener("wheel", handleWheel, removeCaptureOptions)
      container.removeEventListener("touchstart", handleTouchStart, removeCaptureOptions)
      container.removeEventListener("touchmove", handleTouchMove, removeCaptureOptions)
      container.removeEventListener("scroll", handleScroll)
    }
  }, [getScrollContainer, loading, pauseAutoScrollForUser, requestAutoScrollResume, syncAutoScrollAfterUserScroll, threadId])

  useEffect(() => {
    const content = threadRef.current
    if (!content || typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(() => {
      if (!forceScrollToBottomRef.current && (userPausedAutoScrollRef.current || !shouldStickToBottomRef.current)) return
      forceScrollToBottomRef.current = false
      scrollToLatestStep()
    })

    observer.observe(content)
    return () => {
      observer.disconnect()
    }
  }, [scrollToLatestStep, threadId])

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current)
      }
    }
  }, [])

  if (loading) {
    return <div className="sql-stage-thread sql-stage-thread-loading">正在读取分析线程…</div>
  }

  if (!thread || !thread.steps.length) {
    return (
      <div className="sql-stage-thread sql-stage-thread-empty">
        <Sparkles size={24} />
        <strong>{thread ? "这条 Stage 还是空白" : "还没有任何分析"}</strong>
        <p>{emptyHint ?? "在下面的命令栏输入一个问题，让 AI 从数据目录里挑表、生成 SQL 并解读结果。"}</p>
      </div>
    )
  }

  const rewindIndex = rewindBeforeStepId ? thread.steps.findIndex((step) => step.id === rewindBeforeStepId) : -1
  const visibleSteps = rewindIndex >= 0 ? thread.steps.slice(0, rewindIndex) : thread.steps
  const hiddenCount = rewindIndex >= 0 ? thread.steps.length - visibleSteps.length : 0

  return (
    <div ref={threadRef} className={cn("sql-stage-thread", streaming && "is-streaming")}>
      {visibleSteps.map((step, index) => (
        <StepCard
          key={step.id}
          step={step}
          isLast={index === visibleSteps.length - 1}
          onApplySql={onApplySql}
          onRunSql={onRunSql}
          onRepairSql={onRepairSql}
          onInsertTable={onInsertTable}
          onRewindBefore={onRewindBefore}
        />
      ))}
      {hiddenCount ? (
        <div className="sql-stage-rewind-banner">
          已折叠 {hiddenCount} 个后续步骤。
          <button type="button" onClick={onClearRewind}>恢复完整时间线</button>
        </div>
      ) : null}
      <div ref={bottomRef} />
    </div>
  )
}
