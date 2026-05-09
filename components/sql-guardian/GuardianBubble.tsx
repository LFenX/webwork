"use client"

import type { CSSProperties, FormEvent, KeyboardEvent } from "react"
import { MessageCircle, Send, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  GuardianBubblePlacement,
  GuardianDialogueClient,
  GuardianDockMode,
  GuardianProfile,
  GuardianProgress,
  GuardianVisualState,
} from "@/lib/sql-guardian/types"

type GuardianBubbleProps = {
  profile: GuardianProfile
  progress?: GuardianProgress
  message: string
  visualState: GuardianVisualState
  onClose: () => void
  placement?: GuardianBubblePlacement
  dockMode?: GuardianDockMode
  maxWidth?: number
  isSqlLab?: boolean
  dialogues?: GuardianDialogueClient[]
  loadingDialogues?: boolean
  chatOpen?: boolean
  chatPending?: boolean
  chatError?: string | null
  chatInput?: string
  onChatInputChange?: (value: string) => void
  onOpenChat?: () => void
  onCloseChat?: () => void
  onSubmitChat?: () => void
  className?: string
}

export function GuardianBubble({
  profile,
  progress,
  message,
  visualState,
  onClose,
  placement = "above-left",
  dockMode = "floating",
  maxWidth = 340,
  isSqlLab = false,
  dialogues = [],
  loadingDialogues = false,
  chatOpen = false,
  chatPending = false,
  chatError,
  chatInput = "",
  onChatInputChange,
  onOpenChat,
  onCloseChat,
  onSubmitChat,
  className,
}: GuardianBubbleProps) {
  const compact = placement === "compact" || dockMode === "compact" || dockMode === "minimized"
  const progressPercent = progress ? Math.max(0, Math.min(100, Math.round(progress.progress * 100))) : null
  const currentExp = profile.exp ?? 0
  const trimmedInput = chatInput.trim()
  const inputTooLong = chatInput.length > 1000
  const canSubmitChat = Boolean(trimmedInput) && !chatPending && !inputTooLong
  const visibleDialogues = dialogues.slice(-6)
  const style = {
    width: `min(${maxWidth}px, calc(100vw - ${compact ? "1.5rem" : "2rem"}))`,
  } satisfies CSSProperties

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (canSubmitChat) onSubmitChat?.()
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return
    event.preventDefault()
    if (canSubmitChat) onSubmitChat?.()
  }

  return (
    <div
      className={cn(
        "pointer-events-auto rounded-md border border-[--color-border] bg-[--color-bg-surface]/95 text-[--color-text-primary] shadow-[0_12px_28px_rgba(15,23,42,0.11)] backdrop-blur-sm",
        compact ? "p-2.5" : "p-3",
        isSqlLab ? "shadow-[0_10px_22px_rgba(15,23,42,0.09)]" : "",
        className
      )}
      style={style}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold">{profile.name}</span>
            <Badge variant="secondary" className="px-2 py-0 font-mono text-[9px]">
              Lv.{profile.level}
            </Badge>
            <span className={cn("font-mono text-[9px] text-[--color-text-muted]", compact ? "hidden" : "")}>
              {visualState}
            </span>
          </div>
          <div className={cn("mt-0.5 truncate font-mono text-[9px] text-[--color-text-muted]", compact ? "max-w-[150px]" : "max-w-[230px]")}>
            {profile.title}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[--color-text-muted] opacity-60 transition hover:bg-[--color-bg-hover] hover:text-[--color-text-primary] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand] motion-reduce:transition-none"
          aria-label="关闭 SQL Guardian 气泡"
          title="关闭"
        >
          <X size={14} />
        </button>
      </div>
      <p
        className={cn(
          "mt-2 overflow-hidden",
          compact ? "max-h-10 text-xs leading-5" : isSqlLab ? "text-[13px] leading-5" : "text-sm leading-6"
        )}
      >
        {message}
      </p>
      <div className="mt-2 border-t border-[--color-border]/70 pt-2">
        {!chatOpen ? (
          <button
            type="button"
            onClick={onOpenChat}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[10px] text-cyan-700 transition hover:bg-cyan-50 hover:text-cyan-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand] motion-reduce:transition-none"
            aria-label="和 SQL Guardian 说话"
            title="和 SQL Guardian 说话"
          >
            <MessageCircle size={13} />
            和我说话
          </button>
        ) : (
          <div className="space-y-2">
            {!compact && visibleDialogues.length ? (
              <div className="max-h-32 space-y-1 overflow-y-auto pr-1 text-[11px] leading-4 text-[--color-text-muted]">
                {visibleDialogues.map((dialogue) => (
                  <div key={dialogue.id} className="grid grid-cols-[3.5rem_1fr] gap-1">
                    <span className="font-mono text-[9px] uppercase">
                      {dialogue.role === "user" ? "You" : profile.name}
                    </span>
                    <span className="line-clamp-2 text-[--color-text-secondary]">
                      {dialogue.content}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            <form onSubmit={handleSubmit} className="space-y-1.5">
              <div className="flex items-end gap-1.5">
                <textarea
                  value={chatInput}
                  onChange={(event) => onChatInputChange?.(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  rows={compact ? 1 : 2}
                  maxLength={1000}
                  className={cn(
                    "min-h-8 flex-1 resize-none rounded border border-[--color-border] bg-[--color-bg-surface] px-2 py-1.5 text-xs leading-4 text-[--color-text-primary] outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200 motion-reduce:transition-none",
                    isSqlLab ? "max-h-16" : "max-h-24"
                  )}
                  placeholder={chatPending ? "正在想一想..." : "轻轻说一句..."}
                  aria-label="给 SQL Guardian 的短消息"
                  disabled={chatPending}
                />
                <button
                  type="submit"
                  disabled={!canSubmitChat}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded border border-cyan-200 bg-cyan-50 text-cyan-700 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand] motion-reduce:transition-none"
                  aria-label="发送给 SQL Guardian"
                  title="发送"
                >
                  <Send size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 font-mono text-[9px] text-[--color-text-muted]">
                <span>
                  {chatPending
                    ? "正在听字段名说话..."
                    : loadingDialogues
                      ? "读取短历史..."
                      : chatError === "cooldown" || chatError === "rate-limited"
                        ? "稍等几秒再发。"
                        : inputTooLong
                          ? "消息太长了。"
                          : "Enter 发送 · Shift+Enter 换行"}
                </span>
                <button
                  type="button"
                  onClick={onCloseChat}
                  className="rounded px-1 text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]"
                  aria-label="收起 SQL Guardian 输入框"
                  title="收起"
                >
                  收起
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-cyan-100">
          <div
            className="h-full rounded-full bg-cyan-400/70 transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${progressPercent ?? 12}%` }}
          />
        </div>
        {progress ? (
          <span className={cn("font-mono text-[9px] text-[--color-text-muted]", compact ? "hidden" : "")}>
            EXP {currentExp}/{progress.nextLevelExp}
          </span>
        ) : null}
      </div>
    </div>
  )
}
