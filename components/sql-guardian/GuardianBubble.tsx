"use client"

import type { CSSProperties, FormEvent, KeyboardEvent } from "react"
import { Ban, Brain, Check, MessageCircle, RotateCcw, Send, Settings, Trash2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  GuardianBubblePlacement,
  GuardianDialogueClient,
  GuardianDockMode,
  GuardianMemoryBridgeClient,
  GuardianMemoryClient,
  GuardianProfile,
  GuardianProgress,
  GuardianResetResponse,
  GuardianResetScope,
  GuardianSettings,
  GuardianVisualState,
} from "@/lib/sql-guardian/types"
import { getGuardianMoodVisual, getGuardianVisualForm } from "@/lib/sql-guardian/visual-forms"

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
  memories?: GuardianMemoryClient[]
  memoryOpen?: boolean
  memoryLoading?: boolean
  memoryError?: string | null
  memoryEnabled?: boolean
  memoryDraft?: string
  memoryNoticeCount?: number
  onMemoryDraftChange?: (value: string) => void
  onOpenMemory?: () => void
  onCloseMemory?: () => void
  onCreateMemory?: () => void
  onConfirmMemory?: (id: string) => void
  onRejectMemory?: (id: string) => void
  onDeleteMemory?: (id: string) => void
  onToggleMemoryEnabled?: (enabled: boolean) => void
  bridgeItems?: GuardianMemoryBridgeClient[]
  bridgeOpen?: boolean
  bridgeLoading?: boolean
  bridgeError?: string | null
  bridgeEnabled?: boolean
  bridgeSoulWingAvailable?: boolean
  onOpenBridge?: () => void
  onCloseBridge?: () => void
  onToggleBridgeEnabled?: (enabled: boolean) => void
  onRevokeBridge?: (id: string) => void
  settings?: GuardianSettings
  settingsOpen?: boolean
  settingsLoading?: boolean
  settingsError?: string | null
  onOpenSettings?: () => void
  onCloseSettings?: () => void
  onToggleSetting?: <K extends keyof GuardianSettings>(key: K, value: GuardianSettings[K]) => void
  resetScope?: GuardianResetScope
  resetConfirmText?: string
  resetPending?: boolean
  resetError?: string | null
  resetLastResult?: GuardianResetResponse | null
  onResetScopeChange?: (scope: GuardianResetScope) => void
  onResetConfirmTextChange?: (value: string) => void
  onSubmitReset?: () => void
  settingsOnly?: boolean
  className?: string
}

const SETTING_GROUPS: Array<{
  label: string
  items: Array<{ key: keyof GuardianSettings; label: string }>
}> = [
  {
    label: "Basics",
    items: [
      { key: "guardianEnabled", label: "Show Guardian" },
      { key: "animationsEnabled", label: "Animations" },
      { key: "autoPatrolEnabled", label: "Auto patrol" },
      { key: "autoBubbleEnabled", label: "Auto bubble" },
      { key: "autoBubbleInSqlLab", label: "SQL Lab bubbles" },
    ],
  },
  {
    label: "Privacy",
    items: [
      { key: "guardianEventTrackingEnabled", label: "Growth events" },
      { key: "guardianChatHistoryEnabled", label: "Chat history" },
      { key: "guardianMemoryEnabled", label: "Long memory" },
      { key: "sqlAssistantPersonaEnabled", label: "SQL Assistant style" },
    ],
  },
  {
    label: "Sharing",
    items: [
      { key: "soulwingToGuardianMemoryBridgeEnabled", label: "SoulWing to Guardian" },
      { key: "guardianToSoulWingMemoryBridgeEnabled", label: "Guardian to SoulWing" },
    ],
  },
]

const RESET_SCOPE_LABELS: Record<GuardianResetScope, string> = {
  dialogues: "Clear short dialogues",
  events: "Clear growth events",
  memories: "Clear Guardian memories",
  bridge: "Revoke shared summaries",
  profile: "Reset Guardian profile",
  all: "Full Guardian reset",
}

const RESET_SCOPE_IMPACT: Record<GuardianResetScope, string> = {
  dialogues: "Deletes only SQL Guardian short dialogue history.",
  events: "Deletes Guardian growth events and resets level/EXP.",
  memories: "Deletes SQL Guardian long memories.",
  bridge: "Revokes active SoulWing shared summaries; audit remains.",
  profile: "Resets name, visual seed, level, mood, and personality. Privacy settings stay.",
  all: "Clears Guardian dialogues, events, memories, revokes bridge, and resets profile. Privacy settings stay.",
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
  memories = [],
  memoryOpen = false,
  memoryLoading = false,
  memoryError,
  memoryEnabled = true,
  memoryDraft = "",
  memoryNoticeCount = 0,
  onMemoryDraftChange,
  onOpenMemory,
  onCloseMemory,
  onCreateMemory,
  onConfirmMemory,
  onRejectMemory,
  onDeleteMemory,
  onToggleMemoryEnabled,
  bridgeItems = [],
  bridgeOpen = false,
  bridgeLoading = false,
  bridgeError,
  bridgeEnabled = false,
  bridgeSoulWingAvailable = true,
  onOpenBridge,
  onCloseBridge,
  onToggleBridgeEnabled,
  onRevokeBridge,
  settings,
  settingsOpen = false,
  settingsLoading = false,
  settingsError,
  onOpenSettings,
  onCloseSettings,
  onToggleSetting,
  resetScope = "dialogues",
  resetConfirmText = "",
  resetPending = false,
  resetError,
  resetLastResult,
  onResetScopeChange,
  onResetConfirmTextChange,
  onSubmitReset,
  settingsOnly = false,
  className,
}: GuardianBubbleProps) {
  const compact = placement === "compact" || dockMode === "compact" || dockMode === "minimized"
  const visualForm = getGuardianVisualForm({ formStage: profile.formStage, level: profile.level })
  const moodVisual = getGuardianMoodVisual(profile.mood)
  const progressPercent = progress ? Math.max(0, Math.min(100, Math.round(progress.progress * 100))) : null
  const currentExp = profile.exp ?? 0
  const trimmedInput = chatInput.trim()
  const inputTooLong = chatInput.length > 1000
  const canSubmitChat = Boolean(trimmedInput) && !chatPending && !inputTooLong
  const visibleDialogues = dialogues.slice(-6)
  const visibleMemories = memories.slice(0, compact ? 0 : 6)
  const visibleBridgeItems = bridgeItems.slice(0, compact ? 0 : 4)
  const memoryDraftTooLong = memoryDraft.length > 500
  const canCreateMemory = memoryEnabled && Boolean(memoryDraft.trim()) && !memoryLoading && !memoryDraftTooLong
  const canSubmitReset = resetConfirmText === "RESET SQL GUARDIAN" && !resetPending
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
      data-form-stage={visualForm.formStage}
      data-mood={moodVisual.mood}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold">{profile.name}</span>
            <Badge variant="secondary" className={cn("px-2 py-0 font-mono text-[9px]", visualForm.borderClassName)}>
              Lv.{profile.level}
            </Badge>
            <Badge variant="secondary" className={cn("px-1.5 py-0 font-mono text-[9px]", compact ? "hidden" : "")}>
              {visualForm.shortLabel}
            </Badge>
            <span className={cn("font-mono text-[9px] text-[--color-text-muted]", compact ? "hidden" : "")}>
              {moodVisual.label} / {visualState}
            </span>
          </div>
          <div className={cn("mt-0.5 truncate font-mono text-[9px] text-[--color-text-muted]", compact ? "max-w-[150px]" : "max-w-[230px]")}>
            {profile.title} / {visualForm.label}
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
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={settingsOpen ? onCloseSettings : onOpenSettings}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[10px] text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand] motion-reduce:transition-none"
            aria-label="Open SQL Guardian settings"
            title="SQL Guardian settings"
          >
            <Settings size={13} />
            Settings
          </button>
          {!settingsOnly ? (
            <button
              type="button"
              onClick={memoryOpen ? onCloseMemory : onOpenMemory}
              className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[10px] text-emerald-700 transition hover:bg-emerald-50 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand] motion-reduce:transition-none"
              aria-label="Open SQL Guardian memory"
              title="SQL Guardian memory"
            >
              <Brain size={13} />
              Memory{memoryNoticeCount ? ` ${memoryNoticeCount}` : ""}
            </button>
          ) : null}
        </div>
        {settingsOpen ? (
          <div className="mb-2 rounded border border-slate-200 bg-slate-50/55 p-2">
            {compact ? (
              <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-slate-700">
                <span>{settingsLoading ? "Loading settings..." : settings?.guardianEnabled === false ? "Guardian paused" : "Guardian on"}</span>
                <button
                  type="button"
                  onClick={() => onToggleSetting?.("guardianEnabled", !(settings?.guardianEnabled ?? true))}
                  className="rounded px-1.5 py-0.5 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]"
                  aria-label="Toggle SQL Guardian"
                  title="Toggle Guardian"
                >
                  {settings?.guardianEnabled === false ? "Resume" : "Pause"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {SETTING_GROUPS.map((group) => (
                  <div key={group.label} className="rounded border border-white/70 bg-white/55 p-2">
                    <div className="mb-1 font-mono text-[9px] uppercase text-slate-500">{group.label}</div>
                    <div className="grid gap-1.5">
                      {group.items.map((item) => {
                        const checked = settings ? settings[item.key] : false
                        return (
                          <label key={item.key} className="flex items-center justify-between gap-2 text-[11px] leading-4 text-[--color-text-secondary]">
                            <span>{item.label}</span>
                            <button
                              type="button"
                              onClick={() => onToggleSetting?.(item.key, !checked)}
                              className={cn(
                                "rounded border px-2 py-0.5 font-mono text-[9px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand] motion-reduce:transition-none",
                                checked
                                  ? "border-cyan-200 bg-cyan-50 text-cyan-800"
                                  : "border-slate-200 bg-white text-slate-500"
                              )}
                              aria-label={`Toggle ${item.label}`}
                              title={item.label}
                            >
                              {checked ? "On" : "Off"}
                            </button>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <div className="rounded border border-rose-100 bg-rose-50/45 p-2">
                  <div className="mb-1 flex items-center gap-1.5 font-mono text-[9px] uppercase text-rose-700">
                    <RotateCcw size={12} />
                    Danger zone
                  </div>
                  <select
                    value={resetScope}
                    onChange={(event) => onResetScopeChange?.(event.target.value as GuardianResetScope)}
                    className="w-full rounded border border-rose-100 bg-white px-2 py-1 text-[11px] text-[--color-text-secondary] outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                    aria-label="SQL Guardian reset scope"
                  >
                    {(Object.keys(RESET_SCOPE_LABELS) as GuardianResetScope[]).map((scope) => (
                      <option key={scope} value={scope}>{RESET_SCOPE_LABELS[scope]}</option>
                    ))}
                  </select>
                  <div className="mt-1 text-[10px] leading-4 text-rose-700">
                    {RESET_SCOPE_IMPACT[resetScope]}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <input
                      value={resetConfirmText}
                      onChange={(event) => onResetConfirmTextChange?.(event.target.value)}
                      className="min-w-0 flex-1 rounded border border-rose-100 bg-white px-2 py-1 font-mono text-[10px] outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                      placeholder="RESET SQL GUARDIAN"
                      aria-label="Reset confirmation text"
                    />
                    <button
                      type="button"
                      disabled={!canSubmitReset}
                      onClick={onSubmitReset}
                      className="rounded border border-rose-200 bg-rose-50 px-2 py-1 font-mono text-[10px] text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]"
                      aria-label="Confirm SQL Guardian reset"
                      title="Reset"
                    >
                      {resetPending ? "Resetting" : "Reset"}
                    </button>
                  </div>
                  {resetError || resetLastResult ? (
                    <div className={cn("mt-1 font-mono text-[9px]", resetError ? "text-rose-700" : "text-emerald-700")}>
                      {resetError ?? `Done: ${RESET_SCOPE_LABELS[resetLastResult!.scope]}`}
                    </div>
                  ) : null}
                </div>
                {settingsError ? (
                  <div className="font-mono text-[9px] text-rose-600">{settingsError}</div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
        {!settingsOnly && memoryOpen ? (
          <div className="mb-2 rounded border border-emerald-100 bg-emerald-50/40 p-2">
            <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
              <span className="text-emerald-900">Memory {memoryEnabled ? "on" : "paused"}</span>
              <button
                type="button"
                onClick={() => onToggleMemoryEnabled?.(!memoryEnabled)}
                className="rounded px-1.5 py-0.5 text-emerald-700 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]"
                aria-label={memoryEnabled ? "Pause SQL Guardian memory" : "Resume SQL Guardian memory"}
                title={memoryEnabled ? "Pause memory" : "Resume memory"}
              >
                {memoryEnabled ? "Pause" : "Resume"}
              </button>
            </div>
            {compact ? (
              <div className="mt-1 font-mono text-[9px] text-[--color-text-muted]">
                {memoryLoading ? "Loading..." : `${memories.length} saved or pending`}
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {visibleMemories.length ? (
                  <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                    {visibleMemories.map((memory) => (
                      <div key={memory.id} className="rounded border border-emerald-100 bg-white/60 p-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-mono text-[9px] uppercase text-emerald-700">
                              {memory.status} · {memory.type}
                            </div>
                            <div className="line-clamp-2 text-[11px] leading-4 text-[--color-text-secondary]">
                              {memory.summary || memory.content}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {memory.status === "candidate" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onConfirmMemory?.(memory.id)}
                                  className="rounded p-1 text-emerald-700 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]"
                                  aria-label="Confirm Guardian memory"
                                  title="Confirm"
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRejectMemory?.(memory.id)}
                                  className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]"
                                  aria-label="Reject Guardian memory"
                                  title="Reject"
                                >
                                  <Ban size={12} />
                                </button>
                              </>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => onDeleteMemory?.(memory.id)}
                              className="rounded p-1 text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]"
                              aria-label="Delete Guardian memory"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="font-mono text-[10px] text-[--color-text-muted]">
                    {memoryLoading ? "Loading memories..." : "No visible memories yet."}
                  </div>
                )}
                <div className="flex items-end gap-1.5">
                  <textarea
                    value={memoryDraft}
                    onChange={(event) => onMemoryDraftChange?.(event.target.value)}
                    rows={1}
                    maxLength={500}
                    disabled={!memoryEnabled}
                    className="min-h-8 flex-1 resize-none rounded border border-emerald-100 bg-white/70 px-2 py-1.5 text-xs leading-4 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
                    placeholder={memoryEnabled ? "Add a small preference..." : "Memory is paused"}
                    aria-label="New SQL Guardian memory"
                  />
                  <button
                    type="button"
                    disabled={!canCreateMemory}
                    onClick={onCreateMemory}
                    className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 font-mono text-[10px] text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]"
                    aria-label="Create Guardian memory"
                    title="Remember"
                  >
                    Save
                  </button>
                </div>
                {memoryError || memoryDraftTooLong ? (
                  <div className="font-mono text-[9px] text-rose-600">
                    {memoryDraftTooLong ? "Memory text is too long." : memoryError}
                  </div>
                ) : null}
                <div className="rounded border border-cyan-100 bg-cyan-50/40 p-2">
                  <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                    <button
                      type="button"
                      onClick={bridgeOpen ? onCloseBridge : onOpenBridge}
                      className="rounded px-1.5 py-0.5 text-cyan-800 hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]"
                      aria-label="Open SoulWing memory bridge"
                      title="SoulWing memory bridge"
                    >
                      与蝶灵共享记忆
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleBridgeEnabled?.(!bridgeEnabled)}
                      className="rounded px-1.5 py-0.5 text-cyan-700 hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]"
                      aria-label={bridgeEnabled ? "Disable SoulWing to Guardian memory bridge" : "Enable SoulWing to Guardian memory bridge"}
                      title={bridgeEnabled ? "Disable bridge" : "Enable bridge"}
                    >
                      {bridgeEnabled ? "On" : "Off"}
                    </button>
                  </div>
                  <div className="mt-1 text-[10px] leading-4 text-[--color-text-muted]">
                    只有你授权的摘要会被 Guardian 看到，蝶灵的完整记忆不会被直接读取。
                  </div>
                  {!bridgeSoulWingAvailable ? (
                    <div className="mt-1 font-mono text-[9px] text-amber-700">
                      SoulWing memory recall is paused.
                    </div>
                  ) : null}
                  {bridgeOpen ? (
                    <div className="mt-2 space-y-1">
                      {visibleBridgeItems.length ? (
                        visibleBridgeItems.map((item) => (
                          <div key={item.id} className="rounded border border-cyan-100 bg-white/60 p-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-mono text-[9px] uppercase text-cyan-700">
                                  {item.type}
                                </div>
                                <div className="line-clamp-2 text-[11px] leading-4 text-[--color-text-secondary]">
                                  {item.sharedSummary}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => onRevokeBridge?.(item.id)}
                                className="rounded p-1 text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]"
                                aria-label="Revoke shared SoulWing memory summary"
                                title="Revoke"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="font-mono text-[10px] text-[--color-text-muted]">
                          {bridgeLoading ? "Loading bridge..." : "No shared summaries yet."}
                        </div>
                      )}
                      {bridgeError ? (
                        <div className="font-mono text-[9px] text-rose-600">{bridgeError}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        ) : null}
        {!settingsOnly && !chatOpen ? (
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
        ) : !settingsOnly ? (
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
        ) : null}
      </div>
      {!settingsOnly ? (
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-cyan-100">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none", visualForm.progressClassName)}
            style={{ width: `${progressPercent ?? 12}%` }}
          />
        </div>
        {progress ? (
          <span className={cn("font-mono text-[9px] text-[--color-text-muted]", compact ? "hidden" : "")}>
            EXP {currentExp}/{progress.nextLevelExp}
          </span>
        ) : null}
      </div>
      ) : null}
    </div>
  )
}
