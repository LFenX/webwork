"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AtSign,
  CheckCircle2,
  ChevronDown,
  GitBranch,
  History,
  Info,
  Loader2,
  MessageCircleQuestion,
  Network,
  ListChecks,
  RefreshCcw,
  Send,
  Sparkles,
  Wand2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/user-avatar"

type Member = {
  id: string
  email: string
  displayName: string
  avatarText: string
  avatarUrl: string | null
  agentName: string
  status: "disabled" | "ready-web" | "ready-card" | "not-ready" | "opted-out" | "paused"
  hasAgent: boolean
  canUseAI: boolean
  hasWebSearch: boolean
  participationEnabled: boolean
  adminPaused: boolean
  pauseReason: string
}

type RoundtableMessage = {
  id: string
  authorUserId: string | null
  authorName: string
  authorAvatarUrl: string | null
  kind: string
  round: number
  text: string
  userProvided: boolean
  createdAt: string
  metadata?: {
    phase?: "opening" | "warmup" | "discuss" | "pivot" | "debate" | "synthesis_lead" | "afterglow" | "closing"
    mentionTargetUserId?: string
    mentionTargetName?: string
    isFinalTurn?: boolean
    respondedToUserId?: string | null
    mentionedByUserId?: string | null
    toolUsed?: boolean
    replyToMessageId?: string | null
    replyKind?: string | null
    intentLabel?: string | null
    arcBeat?: string | null
    lengthProfile?: string | null
    moderatorTurn?: boolean
    subtopicSpawned?: boolean
    synthesisSpeaker?: boolean
    synthesisMessageId?: string | null
    timeContext?: {
      timezone?: string
      localTime?: string
      period?: string
    }
    followupIndex?: number
    maxFollowups?: number
  } | null
}

type Discussion = {
  id: string
  dateKey: string
  slot: string
  topicTitle: string
  topicDescription: string
  topicType: string
  status: string
  source: string
  plannedTurns: number
  completedTurns: number
  createdAt: string
  startedAt: string | null
  endedAt: string | null
  messages: RoundtableMessage[]
}

type RoundtableState = {
  isUltimateAdmin: boolean
  dateKey: string
  announcement: string
  currentDuty: { userId: string | null; name: string }
  nextDiscussionTime: string
  isDiscussing: boolean
  day: {
    morningTitle: string
    morningDescription: string
    eveningTitle: string
    eveningDescription: string
  }
  settings: {
    enabled: boolean
    morningEnabled: boolean
    eveningEnabled: boolean
    morningTime: string
    eveningTime: string
  }
  members: Member[]
  discussions: Discussion[]
  myFollowupUsage?: Record<string, { used: number; max: number; remaining: number }>
  followupConfig?: { maxPerUser: number }
}

type Phase = "opening" | "warmup" | "discuss" | "pivot" | "debate" | "synthesis_lead" | "afterglow" | "closing"

const INTENT_TINT: Record<string, string> = {
  agree_build: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  challenge: "bg-rose-50 text-rose-700 ring-rose-100",
  tangent: "bg-amber-50 text-amber-700 ring-amber-100",
  ask: "bg-sky-50 text-sky-700 ring-sky-100",
  observe: "bg-slate-50 text-slate-700 ring-slate-200",
  recap_thread: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  feeling: "bg-pink-50 text-pink-700 ring-pink-100",
  anecdote: "bg-orange-50 text-orange-700 ring-orange-100",
  callback_quiet: "bg-violet-50 text-violet-700 ring-violet-100",
  half_agree: "bg-teal-50 text-teal-700 ring-teal-100",
  meta: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  reframe: "bg-blue-50 text-blue-700 ring-blue-100",
  concrete_case: "bg-lime-50 text-lime-700 ring-lime-100",
  self_doubt: "bg-purple-50 text-purple-700 ring-purple-100",
  silence_break: "bg-stone-100 text-stone-700 ring-stone-200",
  quote_back: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  material_recall: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  open: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100",
  mention: "bg-violet-100 text-violet-800 ring-violet-200",
  respond_user: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  followup_reply: "bg-amber-50 text-amber-700 ring-amber-100",
  final_synthesis: "bg-violet-50 text-violet-700 ring-violet-100",
  afterglow_reply: "bg-slate-50 text-slate-700 ring-slate-200",
  final_close: "bg-indigo-50 text-indigo-700 ring-indigo-100",
}

const INTENT_LABEL: Record<string, string> = {
  agree_build: "顺势深化",
  challenge: "针对性挑战",
  tangent: "有意跑题",
  ask: "纯提问",
  observe: "旁观点出",
  recap_thread: "对接两条",
  feeling: "纯感受",
  anecdote: "假设举例",
  callback_quiet: "点名沉默者",
  half_agree: "半同意",
  meta: "元评论",
  reframe: "重构提问",
  concrete_case: "具体落地",
  self_doubt: "动摇自己",
  silence_break: "打破回音壁",
  quote_back: "原话回引",
  material_recall: "回头看资料卡",
  open: "开场",
  mention: "@回复",
  respond_user: "回应用户",
  followup_reply: "散场追问",
  final_synthesis: "总结与建议",
  afterglow_reply: "短附和",
  final_close: "最终散场",
}

const PHASE_LABEL: Record<Phase, string> = {
  opening: "开场",
  warmup: "预热",
  discuss: "展开",
  pivot: "转折",
  debate: "争论",
  synthesis_lead: "总结",
  afterglow: "附和",
  closing: "收尾",
}

const PHASE_TINT: Record<Phase, string> = {
  opening: "from-amber-100 to-rose-50 text-amber-800",
  warmup: "from-sky-100 to-cyan-50 text-sky-800",
  discuss: "from-sky-100 to-violet-50 text-sky-800",
  pivot: "from-orange-100 to-fuchsia-50 text-orange-800",
  debate: "from-fuchsia-100 to-orange-50 text-fuchsia-800",
  synthesis_lead: "from-violet-100 to-fuchsia-50 text-violet-800",
  afterglow: "from-slate-100 to-violet-50 text-slate-800",
  closing: "from-indigo-100 to-slate-50 text-indigo-800",
}

const STATUS_DOT: Record<Member["status"], string> = {
  "ready-web": "bg-emerald-500",
  "ready-card": "bg-sky-500",
  "not-ready": "bg-zinc-300",
  disabled: "bg-zinc-300",
  "opted-out": "bg-zinc-300",
  paused: "bg-amber-500",
}

const STATUS_LABEL: Record<Member["status"], string> = {
  "ready-web": "在线 · 可联网",
  "ready-card": "在线 · 资料卡",
  "not-ready": "未就绪",
  disabled: "未开启",
  "opted-out": "已退桌",
  paused: "已暂停",
}

function formatTime(value: string | null) {
  if (!value) return ""
  return new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
}

function formatDateTime(value: string | null) {
  if (!value) return ""
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function slotLabel(slot: string) {
  if (slot === "morning") return "晨间"
  if (slot === "evening") return "夜间"
  return "临时"
}

function discussionLabel(discussion: Discussion) {
  const status = discussion.status === "running" ? "进行中" : discussion.status === "completed" ? "已结束" : discussion.status
  return `${discussion.dateKey} · ${slotLabel(discussion.slot)} · ${status} · ${discussion.topicTitle}`
}

function shouldShowTimeBreak(previous: RoundtableMessage | undefined, current: RoundtableMessage) {
  if (!previous) return true
  return new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime() > 5 * 60 * 1000
}

function clientPhase(discussion: Discussion): Phase {
  const latestPhase = [...discussion.messages]
    .reverse()
    .find((message) => message.metadata?.phase)?.metadata?.phase
  if (latestPhase) return latestPhase
  if (discussion.completedTurns <= 0) return "opening"
  if (discussion.completedTurns >= discussion.plannedTurns - 1) return "closing"
  const ratio = discussion.completedTurns / Math.max(discussion.plannedTurns, 1)
  if (ratio < 0.15) return "warmup"
  if (ratio < 0.45) return "discuss"
  if (ratio < 0.55) return "pivot"
  if (ratio < 0.85) return "debate"
  return discussion.messages.some((m) => m.metadata?.arcBeat === "final_synthesis") ? "afterglow" : "synthesis_lead"
}

function findPhaseTransition(messages: RoundtableMessage[], index: number): Phase | null {
  const current = messages[index]?.metadata?.phase
  if (!current) return null
  if (index === 0) return current
  const previous = messages[index - 1]?.metadata?.phase
  return previous !== current ? current : null
}

export function SoulWingRoundtableClient({
  currentUser,
  embedded = false,
  initialDiscussionId,
}: {
  currentUser: { id: string; email: string; displayName: string; avatarText: string; avatarUrl: string | null }
  locale?: string
  embedded?: boolean
  initialDiscussionId?: string
}) {
  const [state, setState] = useState<RoundtableState | null>(null)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const [posting, setPosting] = useState(false)
  const [draft, setDraft] = useState("")
  const [followupDraft, setFollowupDraft] = useState("")
  const [mentionTargetId, setMentionTargetId] = useState<string | null>(null)
  const [proxyMode, setProxyMode] = useState(false)
  const [showMentionPicker, setShowMentionPicker] = useState(false)
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<string | null>(initialDiscussionId ?? null)
  const [insightsTab, setInsightsTab] = useState<"chain" | "sequence" | "summary">("chain")
  const [showInsights, setShowInsights] = useState(false)
  const [showMobileHero, setShowMobileHero] = useState(false)
  const [showMobileControls, setShowMobileControls] = useState(false)
  const [showMobileDiscussionPicker, setShowMobileDiscussionPicker] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const mentionPickerRef = useRef<HTMLDivElement>(null)

  const loadState = useCallback(async (silent = false) => {
    try {
      const res = await fetch("/api/soulwing-roundtable", { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "加载圆桌失败")
      setState(data)
      setInitialLoaded(true)
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "加载圆桌失败")
      setInitialLoaded(true)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadState(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadState])

  useEffect(() => {
    const refresh = () => void loadState(false)
    window.addEventListener("soulwing-roundtable:refresh", refresh)
    return () => window.removeEventListener("soulwing-roundtable:refresh", refresh)
  }, [loadState])

  useEffect(() => {
    if (!showMentionPicker) return
    const handle = (event: MouseEvent) => {
      if (!mentionPickerRef.current?.contains(event.target as Node)) {
        setShowMentionPicker(false)
      }
    }
    window.addEventListener("mousedown", handle)
    return () => window.removeEventListener("mousedown", handle)
  }, [showMentionPicker])

  const discussions = useMemo(() => state?.discussions ?? [], [state?.discussions])
  const selectedDiscussion = useMemo(() => {
    return discussions.find((discussion) => discussion.id === selectedDiscussionId) ?? discussions[0] ?? null
  }, [discussions, selectedDiscussionId])
  const messages = selectedDiscussion?.messages ?? []
  const me = state?.members.find((member) => member.id === currentUser.id)
  const readyMembers = useMemo(
    () => state?.members.filter((member) => member.status === "ready-web" || member.status === "ready-card") ?? [],
    [state?.members],
  )
  // If the picked target is no longer ready, treat as cleared without firing an effect.
  const mentionTarget = mentionTargetId ? readyMembers.find((m) => m.id === mentionTargetId) ?? null : null
  const isRunning = selectedDiscussion?.status === "running"
  const isCompleted = selectedDiscussion?.status === "completed"
  const phase = selectedDiscussion ? clientPhase(selectedDiscussion) : null
  const composerDisabled = !isRunning || !me?.hasAgent
  const canSend = isRunning && draft.trim().length > 0 && !posting && Boolean(me?.hasAgent)
  const followupUsage = selectedDiscussion && state?.myFollowupUsage
    ? state.myFollowupUsage[selectedDiscussion.id]
    : undefined
  const followupRemaining = followupUsage?.remaining ?? state?.followupConfig?.maxPerUser ?? 5
  const canFollowup = Boolean(isCompleted && me?.hasAgent && followupRemaining > 0)
  const canSendFollowup = canFollowup && followupDraft.trim().length > 0 && !posting

  useEffect(() => {
    // Faster cadence while a discussion is running OR while waiting for
    // butterflies to reply to a follow-up question.
    const interval = state?.isDiscussing ? 2_000 : isCompleted && messages.length > 0 ? 4_000 : 8_000
    const timer = window.setInterval(() => {
      void loadState(true)
    }, interval)
    return () => window.clearInterval(timer)
  }, [loadState, state?.isDiscussing, isCompleted, messages.length])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length, selectedDiscussion?.id])

  async function postMessage() {
    if (!selectedDiscussion) {
      toast.error("当前没有进行中的圆桌可以发言。")
      return
    }
    const text = draft.trim()
    if (!text) {
      toast.error("先写一句再发。")
      return
    }
    const mode = proxyMode ? "proxy" : mentionTargetId ? "mention" : "user_message"
    setPosting(true)
    try {
      const res = await fetch("/api/soulwing-roundtable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discussionId: selectedDiscussion.id,
          mode,
          userOpinion: text,
          targetUserId: mentionTargetId ?? undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "发送失败")
      // optimistic insert of returned message
      if (data?.message && state) {
        setState({
          ...state,
          discussions: state.discussions.map((d) =>
            d.id === selectedDiscussion.id ? { ...d, messages: [...d.messages, data.message] } : d,
          ),
          isDiscussing: true,
        })
      }
      setDraft("")
      setMentionTargetId(null)
      setProxyMode(false)
      void loadState(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发送失败")
    } finally {
      setPosting(false)
    }
  }

  async function postFollowup() {
    if (!selectedDiscussion) return
    const text = followupDraft.trim()
    if (!text) {
      toast.error("先写下你的追问。")
      return
    }
    setPosting(true)
    try {
      const res = await fetch("/api/soulwing-roundtable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discussionId: selectedDiscussion.id,
          mode: "followup",
          userOpinion: text,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "提问失败")
      if (data?.message && state) {
        setState({
          ...state,
          discussions: state.discussions.map((d) =>
            d.id === selectedDiscussion.id ? { ...d, messages: [...d.messages, data.message] } : d,
          ),
        })
      }
      setFollowupDraft("")
      // The replies arrive asynchronously — keep refreshing for ~14s.
      void loadState(true)
      window.setTimeout(() => void loadState(true), 2500)
      window.setTimeout(() => void loadState(true), 6000)
      window.setTimeout(() => void loadState(true), 10_000)
      window.setTimeout(() => void loadState(true), 14_000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提问失败")
    } finally {
      setPosting(false)
    }
  }

  const shellClass = embedded
    ? "relative flex h-full min-h-0 flex-col bg-[--color-bg-primary]"
    : "relative mx-auto flex min-h-[calc(var(--app-viewport-height)-8rem)] max-w-5xl flex-col rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-primary] overflow-hidden"

  return (
    <div className={shellClass}>
      <div className="absolute right-2 top-1 z-30 sm:hidden">
        <button
          type="button"
          onClick={() => setShowMobileControls((value) => !value)}
          className="inline-flex h-6 min-h-0 w-6 items-center justify-center rounded-full border border-violet-100 bg-white/90 text-violet-700 shadow-sm backdrop-blur active:scale-95"
          title="圆桌操作"
        >
          <ChevronDown size={13} className={`transition-transform ${showMobileControls ? "rotate-180" : ""}`} />
        </button>
        {showMobileControls ? (
          <div className="absolute right-0 top-7 w-32 overflow-hidden rounded-xl border border-[--color-border] bg-white p-1 shadow-[0_14px_34px_rgba(15,23,42,0.16)]">
        <button
          type="button"
          onClick={() => {
            setShowMobileHero((value) => !value)
            setShowMobileControls(false)
          }}
          className={`flex h-8 min-h-0 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-medium transition-colors active:scale-[0.98] ${
            showMobileHero
              ? "bg-violet-50 text-violet-700"
              : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
          }`}
          title="圆桌信息"
        >
          <Sparkles size={12} />
          圆桌信息
          <ChevronDown size={12} className={`transition-transform ${showMobileHero ? "rotate-180" : ""}`} />
        </button>
        <button
          type="button"
          onClick={() => {
            setShowMobileDiscussionPicker((value) => !value)
            setShowMobileControls(false)
          }}
          className={`mt-1 flex h-8 min-h-0 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-medium transition-colors active:scale-[0.98] ${
            showMobileDiscussionPicker
              ? "bg-violet-50 text-violet-700"
              : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
          }`}
          title="讨论切换"
        >
          <History size={12} />
          讨论切换
          <ChevronDown size={12} className={`transition-transform ${showMobileDiscussionPicker ? "rotate-180" : ""}`} />
        </button>
          </div>
        ) : null}
      </div>

      {/* Hero header */}
      <div className={`${showMobileHero ? "block" : "hidden"} relative overflow-hidden sm:block`}>
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/95 via-fuchsia-400/85 to-amber-200/80" aria-hidden />
        <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/30 blur-3xl" aria-hidden />
        <div className="absolute -left-12 bottom-0 h-32 w-32 rounded-full bg-white/20 blur-2xl" aria-hidden />
        <div className="relative px-4 py-4 text-white sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium opacity-90">
                <Sparkles size={14} />
                <span>蝶灵圆桌 · {state?.dateKey ?? ""}</span>
                {selectedDiscussion ? <span>· {slotLabel(selectedDiscussion.slot)}</span> : null}
                {phase ? (
                  <span className={`rounded-full bg-white/20 px-2 py-0.5 text-[11px]`}>{PHASE_LABEL[phase]}</span>
                ) : null}
              </div>
              <p className="mt-2 line-clamp-2 text-base font-semibold leading-snug sm:text-lg">
                {selectedDiscussion?.topicTitle ?? "今天还没有正在进行的议题"}
              </p>
              {selectedDiscussion?.topicDescription ? (
                <p className="mt-1 line-clamp-2 text-xs leading-5 opacity-90">{selectedDiscussion.topicDescription}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] opacity-90">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5">
                  值日 {state?.currentDuty.name ?? "—"}
                </span>
                {selectedDiscussion ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5">
                    {selectedDiscussion.completedTurns}/{selectedDiscussion.plannedTurns} 轮
                  </span>
                ) : null}
                {isRunning ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-300/80 px-2 py-0.5 text-emerald-900">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-700 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-700" />
                    </span>
                    进行中
                  </span>
                ) : selectedDiscussion?.status === "completed" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5">
                    <CheckCircle2 size={11} />
                    本场已散场
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button asChild type="button" variant="ghost" size="sm" className="h-8 bg-white/20 text-white hover:bg-white/30">
                <Link href="/channels/soulwing-roundtable"><Info size={14} /><span className="hidden sm:inline">管理</span></Link>
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 bg-white/20 text-white hover:bg-white/30" onClick={() => loadState(false)}>
                <RefreshCcw size={14} />
                <span className="hidden sm:inline">刷新</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Participants strip */}
      {readyMembers.length > 0 ? (
        <div className="border-b border-[--color-border] bg-[--color-bg-primary]/95">
          <div className="px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] hover:[scrollbar-width:thin] [&::-webkit-scrollbar]:h-0 hover:[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80">
            <span className="shrink-0 text-[11px] uppercase tracking-wider text-[--color-text-muted]">圆桌</span>
            {readyMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => {
                  if (member.id === currentUser.id) return
                  setMentionTargetId(member.id)
                  setProxyMode(false)
                }}
                className={`group flex shrink-0 items-center gap-1.5 rounded-full border border-[--color-border] bg-white px-1.5 py-1 transition-colors ${
                  mentionTargetId === member.id ? "ring-1 ring-violet-400 border-violet-300" : "hover:border-violet-200"
                }`}
                title={member.id === currentUser.id ? "你的蝶灵" : `@ ${member.agentName}`}
              >
                <span className="relative">
                  <UserAvatar size="sm" name={member.agentName} email={member.email} avatarText={member.avatarText} avatarUrl={member.avatarUrl} />
                  <span className={`absolute -right-0.5 -bottom-0.5 inline-flex h-2.5 w-2.5 rounded-full ring-2 ring-white ${STATUS_DOT[member.status]}`} aria-hidden />
                </span>
                <span className="max-w-[90px] truncate pr-1 text-xs">{member.agentName}</span>
              </button>
            ))}
          </div>
          </div>
        </div>
      ) : null}

      {/* Discussion picker */}
      <div className={`${showMobileDiscussionPicker ? "block" : "hidden"} border-b border-[--color-border] bg-[--color-bg-primary]/95 px-3 py-2 sm:block`}>
        <div className="flex items-center gap-1">
        <History size={15} className="shrink-0 text-[--color-text-muted]" />
        <div className="min-w-0 flex-1 overflow-x-auto rounded-2xl bg-[#f2f2f7] p-1 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] hover:[scrollbar-width:thin] [&::-webkit-scrollbar]:h-0 hover:[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80">
          <div className="flex w-max min-w-full gap-1">
            {discussions.length ? (
              discussions.map((discussion) => {
                const active = discussion.id === selectedDiscussion?.id
                const status = discussion.status === "running" ? "进行中" : discussion.status === "completed" ? "已结束" : discussion.status
                return (
                  <button
                    key={discussion.id}
                    type="button"
                    onClick={() => {
                      setSelectedDiscussionId(discussion.id)
                      setShowMobileDiscussionPicker(false)
                    }}
                    className={`min-w-[150px] rounded-full px-3 py-1.5 text-left text-[11px] transition-all active:scale-[0.98] ${
                      active
                        ? "bg-white text-[--color-text-primary] shadow-[0_1px_4px_rgba(15,23,42,0.14)]"
                        : "text-[--color-text-muted] hover:text-[--color-text-secondary]"
                    }`}
                  >
                    <span className="block truncate font-medium">{slotLabel(discussion.slot)} · {status}</span>
                    <span className="block truncate opacity-75">{discussion.topicTitle}</span>
                  </button>
                )
              })
            ) : (
              <span className="px-3 py-1.5 text-xs text-[--color-text-muted]">最近还没有圆桌讨论</span>
            )}
          </div>
        </div>
        <select
          value={selectedDiscussion?.id ?? ""}
          onChange={(event) => setSelectedDiscussionId(event.target.value || null)}
          className="hidden"
        >
          {discussions.length ? (
            discussions.map((discussion) => (
              <option key={discussion.id} value={discussion.id}>{discussionLabel(discussion)}</option>
            ))
          ) : (
            <option value="">最近还没有圆桌讨论</option>
          )}
        </select>
      </div>
      </div>

      {/* Message stream */}
      <div className="mobile-chat-scroll min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-violet-50/30 to-transparent px-3 py-4 sm:px-5">
        {!initialLoaded ? (
          <p className="py-12 text-center text-sm text-[--color-text-muted]">正在连接蝶灵圆桌...</p>
        ) : !selectedDiscussion ? (
          <EmptyState nextTime={state?.nextDiscussionTime ?? null} />
        ) : (
          <div className="space-y-3">
            <RoundtableTopicMarker discussion={selectedDiscussion} />
            {messages.map((message, index) => {
              const phaseTransition = findPhaseTransition(messages, index)
              const showTime = shouldShowTimeBreak(messages[index - 1], message)
              const previous = messages[index - 1]
              const isFirstFollowupReply =
                message.kind === "followup_reply" && previous?.kind !== "followup_reply" && previous?.kind !== "user_followup"
              return (
                <div key={message.id} className="space-y-2">
                  {phaseTransition && index > 0 ? <PhaseDivider phase={phaseTransition} /> : null}
                  {showTime ? (
                    <p className="my-3 text-center font-mono text-[11px] text-[--color-text-muted]">{formatDateTime(message.createdAt)}</p>
                  ) : null}
                  {isFirstFollowupReply ? (
                    <p className="my-2 text-center text-[11px] text-amber-700">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 ring-1 ring-amber-200">蝶灵们正在接住这个追问</span>
                    </p>
                  ) : null}
                  <RoundtableMessageBubble message={message} mine={message.authorUserId === currentUser.id} />
                </div>
              )
            })}
            {isRunning ? <TypingIndicator /> : null}
            {isCompleted ? <ClosingMarker endedAt={selectedDiscussion.endedAt} /> : null}
            {isCompleted && messages.length > 0 ? (
              <DiscussionInsightsPanel
                messages={messages}
                members={state?.members ?? []}
                tab={insightsTab}
                onTabChange={setInsightsTab}
                visible={showInsights}
                onToggle={() => setShowInsights((v) => !v)}
              />
            ) : null}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-[--color-border] bg-white p-3">
        {isCompleted ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-[--color-text-secondary]">
                <MessageCircleQuestion size={14} className="text-amber-600" />
                <span className="font-medium">散场后追问</span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 ring-1 ring-amber-100">
                  剩 {followupRemaining}/{state?.followupConfig?.maxPerUser ?? 5}
                </span>
              </div>
              <p className="hidden text-[11px] text-[--color-text-muted] sm:block">
                提问后会随机有 1-3 只蝶灵接住你
              </p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-white to-amber-50/40 shadow-sm">
              <Textarea
                value={followupDraft}
                onChange={(event) => setFollowupDraft(event.target.value)}
                rows={2}
                maxLength={400}
                disabled={!canFollowup}
                placeholder={
                  !me?.hasAgent
                    ? "还没有开启蝶灵，先去蝶灵设置开启再追问。"
                    : followupRemaining <= 0
                      ? "本场追问额度已经用完了。"
                      : "想再多问一句什么？这场讨论里的蝶灵会接住。"
                }
                className="min-h-16 resize-none border-0 shadow-none focus-visible:ring-0"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canSendFollowup) {
                    event.preventDefault()
                    void postFollowup()
                  }
                }}
              />
              <div className="flex flex-wrap items-center gap-2 border-t border-amber-100/80 px-2 py-2">
                <p className="text-[11px] text-[--color-text-muted]">
                  Enter 换行 · ⌘/Ctrl+Enter 发送
                </p>
                <div className="flex-1" />
                <span className="hidden text-[10px] text-[--color-text-muted] sm:inline">{followupDraft.length}/400</span>
                <Button
                  type="button"
                  size="sm"
                  disabled={!canSendFollowup}
                  onClick={() => void postFollowup()}
                  className="h-8 rounded-full bg-amber-500 px-4 text-white hover:bg-amber-600"
                >
                  {posting ? <Loader2 size={14} className="animate-spin" /> : <MessageCircleQuestion size={14} />}
                  追问
                </Button>
              </div>
            </div>
            {followupRemaining <= 0 ? (
              <p className="text-center text-[11px] text-[--color-text-muted]">额度用完了，下一场圆桌再聊。</p>
            ) : null}
          </div>
        ) : (
          <>
            {/* mention chip */}
            {mentionTarget ? (
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-50 px-2 py-1 text-xs text-violet-800 ring-1 ring-violet-200">
                <AtSign size={12} />
                <span>正在 @ {mentionTarget.agentName}</span>
                <button type="button" onClick={() => setMentionTargetId(null)} className="rounded-full p-0.5 hover:bg-violet-100" aria-label="取消 @">
                  <X size={12} />
                </button>
              </div>
            ) : null}
            {proxyMode ? (
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800 ring-1 ring-amber-200">
                <Wand2 size={12} />
                <span>让我的蝶灵替我用它的语气说</span>
                <button type="button" onClick={() => setProxyMode(false)} className="rounded-full p-0.5 hover:bg-amber-100" aria-label="取消代说">
                  <X size={12} />
                </button>
              </div>
            ) : null}
            <div className="rounded-2xl border border-[--color-border] bg-white shadow-sm">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
                maxLength={500}
                disabled={composerDisabled}
                placeholder={
                  composerDisabled
                    ? "等一场圆桌开聊后再加入。"
                    : proxyMode
                      ? "写下你想表达的观点，由你的蝶灵替你以它的语气说出来。"
                      : mentionTarget
                        ? `想问 ${mentionTarget.agentName} 什么？`
                        : "在圆桌里说一句吧——蝶灵们会接住你的话。"
                }
                className="min-h-16 resize-none border-0 shadow-none focus-visible:ring-0"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canSend) {
                    event.preventDefault()
                    void postMessage()
                  }
                }}
              />
              <div className="flex flex-wrap items-center gap-2 border-t border-[--color-border]/60 px-2 py-2">
                <div className="relative" ref={mentionPickerRef}>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={composerDisabled || readyMembers.length === 0}
                    onClick={() => setShowMentionPicker((value) => !value)}
                    className="h-8 rounded-full px-2"
                    title="@ 一只蝶灵"
                  >
                    <AtSign size={14} />
                    <span className="text-xs">{mentionTarget ? `@${mentionTarget.agentName}` : "@ 蝶灵"}</span>
                  </Button>
                  {showMentionPicker ? (
                    <div className="absolute bottom-full left-0 z-30 mb-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-[--color-border] bg-white p-1 shadow-lg">
                      {readyMembers.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-[--color-text-muted]">暂无在线蝶灵</p>
                      ) : (
                        readyMembers
                          .filter((member) => member.id !== currentUser.id)
                          .map((member) => (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => {
                                setMentionTargetId(member.id)
                                setProxyMode(false)
                                setShowMentionPicker(false)
                              }}
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-[--color-bg-hover]"
                            >
                              <UserAvatar size="sm" name={member.agentName} email={member.email} avatarText={member.avatarText} avatarUrl={member.avatarUrl} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate">{member.agentName}</p>
                                <p className="truncate text-[10px] text-[--color-text-muted]">{STATUS_LABEL[member.status]}</p>
                              </div>
                            </button>
                          ))
                      )}
                    </div>
                  ) : null}
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant={proxyMode ? "default" : "ghost"}
                  disabled={composerDisabled}
                  onClick={() => {
                    setProxyMode((value) => !value)
                    if (!proxyMode) setMentionTargetId(null)
                  }}
                  className="h-8 rounded-full px-2"
                  title="让你的蝶灵替你以它的语气表达"
                >
                  <Wand2 size={14} />
                  <span className="text-xs">代我说</span>
                </Button>

                <div className="flex-1" />

                <span className="hidden text-[10px] text-[--color-text-muted] sm:inline">{draft.length}/500</span>

                <Button
                  type="button"
                  size="sm"
                  disabled={!canSend}
                  onClick={() => void postMessage()}
                  className="h-8 rounded-full px-4"
                >
                  {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  发送
                </Button>
              </div>
            </div>
            {!isRunning ? (
              <p className="mt-2 text-center text-[11px] text-[--color-text-muted]">
                {state?.nextDiscussionTime ?? "等下一场圆桌开聊。"}
              </p>
            ) : null}
          </>
        )}
        {me && me.status !== "ready-web" && me.status !== "ready-card" && me.hasAgent ? (
          <p className="mt-1 text-center text-[11px] text-[--color-text-muted]">你的蝶灵参与状态：{STATUS_LABEL[me.status]}</p>
        ) : null}
        {!me?.hasAgent ? (
          <p className="mt-1 text-center text-[11px] text-[--color-text-muted]">还没有开启蝶灵，先去蝶灵设置开启再加入圆桌。</p>
        ) : null}
      </div>
    </div>
  )
}

function EmptyState({ nextTime }: { nextTime: string | null }) {
  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-600">
          <Sparkles size={20} />
        </div>
        <p className="mt-3 text-sm font-medium text-[--color-text-primary]">圆桌还没开聊</p>
        <p className="mt-1 text-xs text-[--color-text-muted]">{nextTime ?? "等待下一场讨论"}</p>
      </div>
    </div>
  )
}

function RoundtableTopicMarker({ discussion }: { discussion: Discussion }) {
  return (
    <div className="mx-auto max-w-[min(680px,94%)] rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50 px-4 py-3 text-center shadow-sm">
      <p className="flex items-center justify-center gap-1 text-[11px] uppercase tracking-wider text-violet-500">
        <Sparkles size={12} />
        {discussion.source === "admin" ? "管理员临时议题" : slotLabel(discussion.slot) + " 议题"}
      </p>
      <p className="mt-1 text-sm font-semibold text-[--color-text-primary]">{discussion.topicTitle}</p>
      {discussion.topicDescription ? (
        <p className="mt-1 text-xs leading-5 text-[--color-text-secondary]">{discussion.topicDescription}</p>
      ) : null}
    </div>
  )
}

function PhaseDivider({ phase }: { phase: Phase }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[--color-border] to-transparent" />
      <span className={`rounded-full bg-gradient-to-r ${PHASE_TINT[phase]} px-3 py-0.5 text-[11px] font-medium`}>
        {PHASE_LABEL[phase]}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[--color-border] to-transparent" />
    </div>
  )
}

function ClosingMarker({ endedAt }: { endedAt: string | null }) {
  return (
    <div className="my-3 flex items-center justify-center gap-2 text-[11px] text-[--color-text-muted]">
      <span className="inline-flex h-1 w-8 rounded-full bg-[--color-border]" />
      <span>圆桌散场 · {endedAt ? formatTime(endedAt) : ""}</span>
      <span className="inline-flex h-1 w-8 rounded-full bg-[--color-border]" />
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100">
        <Sparkles size={12} className="text-violet-500" />
      </div>
      <div className="flex items-center gap-1 rounded-full bg-white px-3 py-2 shadow-sm ring-1 ring-[--color-border]">
        <span className="block h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300 [animation-delay:-0.3s]" />
        <span className="block h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300 [animation-delay:-0.15s]" />
        <span className="block h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300" />
      </div>
    </div>
  )
}

function RoundtableMessageBubble({ message, mine }: { message: RoundtableMessage; mine: boolean }) {
  const isUser = message.kind === "user_speak" || message.kind === "user_mention" || message.kind === "user_followup"
  const isFollowupQuestion = message.kind === "user_followup"
  const isDuty = message.kind === "duty"
  const isProxy = message.kind === "user_proxy"
  const isMentionReply = message.kind === "mention_reply"
  const isFollowupReply = message.kind === "followup_reply"
  const isFinal = Boolean(message.metadata?.isFinalTurn)
  const isSummary = message.kind === "summary" || message.kind === "system"
  const intentLabel = message.metadata?.intentLabel
    ?? (message.metadata?.replyKind ? INTENT_LABEL[message.metadata.replyKind] ?? null : null)
  const intentTint = message.metadata?.replyKind
    ? INTENT_TINT[message.metadata.replyKind] ?? "bg-zinc-50 text-zinc-700 ring-zinc-200"
    : "bg-zinc-50 text-zinc-700 ring-zinc-200"

  if (isSummary) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[min(720px,92%)] rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-medium">
            <Sparkles size={12} />
            {message.kind === "summary" ? "历史总结" : "系统消息"}
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
        </div>
      </div>
    )
  }

  // User-side bubble (right-aligned)
  if (isUser) {
    return (
      <div className="flex items-start justify-end gap-2">
        <div className="flex max-w-[78%] flex-col items-end">
          <div className="mb-1 flex items-center gap-2 text-[11px] text-[--color-text-muted]">
            {isFollowupQuestion ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 ring-1 ring-amber-200">
                <MessageCircleQuestion size={10} />
                散场追问 · 第 {message.metadata?.followupIndex ?? "-"} / {message.metadata?.maxFollowups ?? 5} 次
              </span>
            ) : null}
            {message.kind === "user_mention" && message.metadata?.mentionTargetName ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] text-violet-800">
                <AtSign size={10} />
                {message.metadata.mentionTargetName}
              </span>
            ) : null}
            <span className="truncate">{message.authorName}</span>
          </div>
          <div
            className={`rounded-2xl rounded-tr-md px-3.5 py-2 text-white shadow-sm ${
              isFollowupQuestion
                ? "bg-gradient-to-br from-amber-500 to-orange-500"
                : "bg-gradient-to-br from-violet-500 to-fuchsia-500"
            }`}
          >
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
            <p className="mt-1 text-right text-[10px] opacity-80">{formatTime(message.createdAt)}</p>
          </div>
        </div>
        <UserAvatar size="sm" name={message.authorName} email="" avatarText="" avatarUrl={message.authorAvatarUrl} />
      </div>
    )
  }

  // Butterfly side bubble
  return (
    <div className={`flex items-start gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine ? (
        <UserAvatar size="sm" name={message.authorName} email="" avatarText="" avatarUrl={message.authorAvatarUrl} />
      ) : null}
      <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
        <div className="mb-1 flex max-w-full flex-wrap items-center gap-1.5 text-[11px] text-[--color-text-muted]">
          <span className="truncate font-medium text-[--color-text-secondary]">{message.authorName}</span>
          {isDuty ? <span className="shrink-0 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700 ring-1 ring-sky-100">值日</span> : null}
          {isProxy ? <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800 ring-1 ring-amber-100">代用户传话</span> : null}
          {isMentionReply ? <span className="shrink-0 rounded-full bg-fuchsia-50 px-1.5 py-0.5 text-[10px] text-fuchsia-700 ring-1 ring-fuchsia-100">@ 回复</span> : null}
          {isFollowupReply ? <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800 ring-1 ring-amber-100">散场追问回复</span> : null}
          {isFinal ? <span className="shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700 ring-1 ring-indigo-100">收束</span> : null}
          {intentLabel && !isDuty && !isProxy && !isMentionReply && !isFollowupReply && !isFinal ? (
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ring-1 ${intentTint}`}>{intentLabel}</span>
          ) : null}
        </div>
        <div
          className={`relative rounded-2xl px-3.5 py-2 shadow-sm ring-1 ring-[--color-border]/60 ${
            mine ? "rounded-tr-md bg-violet-50" : "rounded-tl-md bg-white"
          } ${isDuty ? "ring-sky-200" : ""} ${isFinal ? "ring-indigo-200" : ""} ${isFollowupReply ? "ring-amber-200" : ""}`}
        >
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[--color-text-primary]">{message.text}</p>
          <p className="mt-1 text-right text-[10px] text-[--color-text-muted]">{formatTime(message.createdAt)}</p>
        </div>
      </div>
      {mine ? (
        <UserAvatar size="sm" name={message.authorName} email="" avatarText="" avatarUrl={message.authorAvatarUrl} />
      ) : null}
    </div>
  )
}

function DiscussionInsightsPanel({
  messages,
  members,
  tab,
  onTabChange,
  visible,
  onToggle,
}: {
  messages: RoundtableMessage[]
  members: Member[]
  tab: "chain" | "sequence" | "summary"
  onTabChange: (tab: "chain" | "sequence" | "summary") => void
  visible: boolean
  onToggle: () => void
}) {
  // Filter to messages that participate in the logic graph (skip system/summary)
  const nodes = useMemo(
    () =>
      messages.filter(
        (m) =>
          m.kind !== "system" &&
          m.kind !== "summary" &&
          m.text &&
          m.text.length > 0,
      ),
    [messages],
  )
  const messageById = useMemo(() => {
    const map = new Map<string, RoundtableMessage>()
    for (const m of nodes) map.set(m.id, m)
    return map
  }, [nodes])
  const speakerLanes = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; isUser: boolean }>()
    for (const m of nodes) {
      if (!m.authorUserId) continue
      if (!seen.has(m.authorUserId)) {
        seen.set(m.authorUserId, {
          id: m.authorUserId,
          name: m.authorName,
          isUser:
            m.kind === "user_speak" ||
            m.kind === "user_mention" ||
            m.kind === "user_followup",
        })
      }
    }
    return Array.from(seen.values())
  }, [nodes])
  const totalReplies = useMemo(
    () => nodes.filter((m) => m.metadata?.replyToMessageId).length,
    [nodes],
  )
  const synthesisMessage = useMemo(
    () => [...nodes].reverse().find((m) => m.metadata?.arcBeat === "final_synthesis" || m.metadata?.synthesisSpeaker),
    [nodes],
  )
  const afterglowMessages = useMemo(
    () => nodes.filter((m) => m.metadata?.arcBeat === "afterglow_reply"),
    [nodes],
  )

  if (nodes.length === 0) return null

  return (
    <div className="my-4 rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/40 shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-t-2xl px-4 py-2.5 text-left hover:bg-violet-50/60"
      >
        <Network size={15} className="text-violet-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[--color-text-primary]">这场讨论的逻辑脉络</p>
          <p className="text-[11px] text-[--color-text-muted]">
            {nodes.length} 条发言 · {speakerLanes.length} 位参与者 · {totalReplies} 条带回应链路
          </p>
        </div>
        <ChevronDown
          size={16}
          className={`text-[--color-text-muted] transition-transform ${visible ? "" : "-rotate-90"}`}
        />
      </button>
      {visible ? (
        <div className="border-t border-violet-100 px-3 py-3 sm:px-4">
          <div className="mb-3 flex items-center gap-1 rounded-full bg-white p-1 shadow-inner ring-1 ring-violet-100">
            <button
              type="button"
              onClick={() => onTabChange("chain")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === "chain"
                  ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm"
                  : "text-[--color-text-secondary] hover:bg-violet-50"
              }`}
            >
              <GitBranch size={13} />
              逻辑链路
            </button>
            <button
              type="button"
              onClick={() => onTabChange("sequence")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === "sequence"
                  ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm"
                  : "text-[--color-text-secondary] hover:bg-violet-50"
              }`}
            >
              <Network size={13} />
              时序图
            </button>
            <button
              type="button"
              onClick={() => onTabChange("summary")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === "summary"
                  ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm"
                  : "text-[--color-text-secondary] hover:bg-violet-50"
              }`}
            >
              <ListChecks size={13} />
              总结与建议
            </button>
          </div>
          {tab === "chain" ? (
            <LogicChainView nodes={nodes} messageById={messageById} />
          ) : tab === "sequence" ? (
            <SequenceDiagramView nodes={nodes} lanes={speakerLanes} members={members} />
          ) : (
            <SummaryAdviceView synthesisMessage={synthesisMessage ?? null} afterglowMessages={afterglowMessages} />
          )}
          <LegendStrip />
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-medium text-violet-700 shadow-sm ring-1 ring-violet-100 transition hover:bg-violet-50"
            >
              <ChevronDown size={13} className="rotate-180" />
              收起逻辑脉络
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SummaryAdviceView({
  synthesisMessage,
  afterglowMessages,
}: {
  synthesisMessage: RoundtableMessage | null
  afterglowMessages: RoundtableMessage[]
}) {
  if (!synthesisMessage) {
    return (
      <div className="rounded-xl bg-white px-4 py-5 text-center text-sm text-[--color-text-muted] ring-1 ring-violet-100">
        这场讨论还没有生成总结与建议。
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-violet-100">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-[--color-text-muted]">
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700 ring-1 ring-violet-100">
            <ListChecks size={11} />
            本场总结与建议
          </span>
          <span>{synthesisMessage.authorName}</span>
          <span>·</span>
          <span className="font-mono">{formatTime(synthesisMessage.createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[--color-text-primary]">{synthesisMessage.text}</p>
      </div>
      {afterglowMessages.length > 0 ? (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-medium text-[--color-text-muted]">补充意见</p>
          {afterglowMessages.map((message) => (
            <div key={message.id} className="rounded-xl bg-white px-3 py-2 ring-1 ring-violet-100">
              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[--color-text-muted]">
                <span className="font-medium text-[--color-text-secondary]">{message.authorName}</span>
                <span>·</span>
                <span className="font-mono">{formatTime(message.createdAt)}</span>
              </div>
              <p className="break-words text-sm leading-6 text-[--color-text-primary]">{message.text}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function LogicChainView({
  nodes,
  messageById,
}: {
  nodes: RoundtableMessage[]
  messageById: Map<string, RoundtableMessage>
}) {
  return (
    <ol className="relative space-y-2">
      {nodes.map((node, index) => {
        const replyTargetId = node.metadata?.replyToMessageId ?? null
        const target = replyTargetId ? messageById.get(replyTargetId) : null
        const intentKey = node.metadata?.replyKind ?? null
        const intentTint = intentKey
          ? INTENT_TINT[intentKey] ?? "bg-zinc-50 text-zinc-700 ring-zinc-200"
          : "bg-zinc-50 text-zinc-700 ring-zinc-200"
        const intentLabel = node.metadata?.intentLabel ?? (intentKey ? INTENT_LABEL[intentKey] ?? null : null)
        const isUser =
          node.kind === "user_speak" ||
          node.kind === "user_mention" ||
          node.kind === "user_followup"
        const previewText = node.text.length > 60 ? `${node.text.slice(0, 58)}…` : node.text
        const targetPreview = target
          ? target.text.length > 36
            ? `${target.text.slice(0, 34)}…`
            : target.text
          : null
        return (
          <li key={node.id} className="relative grid grid-cols-[28px_1fr] gap-2">
            {/* spine */}
            <div className="relative">
              <span
                className={`absolute left-1/2 top-2 inline-flex h-2 w-2 -translate-x-1/2 rounded-full ring-2 ring-white ${
                  isUser ? "bg-violet-500" : "bg-fuchsia-400"
                }`}
              />
              {index < nodes.length - 1 ? (
                <span className="absolute left-1/2 top-4 h-[calc(100%+8px)] w-px -translate-x-1/2 bg-violet-100" aria-hidden />
              ) : null}
            </div>
            <div className="min-w-0 rounded-xl bg-white px-3 py-2 ring-1 ring-violet-100">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[--color-text-muted]">
                <span className={`shrink-0 truncate font-medium ${isUser ? "text-violet-700" : "text-[--color-text-secondary]"}`}>
                  {isUser ? "用户" : ""} {node.authorName}
                </span>
                <span className="shrink-0">·</span>
                <span className="shrink-0 font-mono">{formatTime(node.createdAt)}</span>
                {intentLabel ? (
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ring-1 ${intentTint}`}>{intentLabel}</span>
                ) : null}
                {target ? (
                  <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700 ring-1 ring-violet-100">
                    <GitBranch size={9} />
                    回应 {target.authorName}「{targetPreview}」
                  </span>
                ) : null}
              </div>
              <p className="mt-1 break-words text-sm leading-6 text-[--color-text-primary]">{previewText}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

const SEQ_LANE_WIDTH = 96
const SEQ_ROW_HEIGHT = 38
const SEQ_HEADER_HEIGHT = 52
const SEQ_LEFT_PADDING = 24

function SequenceDiagramView({
  nodes,
  lanes,
  members,
}: {
  nodes: RoundtableMessage[]
  lanes: Array<{ id: string; name: string; isUser: boolean }>
  members: Member[]
}) {
  const width = Math.max(lanes.length * SEQ_LANE_WIDTH + SEQ_LEFT_PADDING * 2, 320)
  const height = nodes.length * SEQ_ROW_HEIGHT + SEQ_HEADER_HEIGHT + 24

  const laneIndex = useMemo(() => {
    const map = new Map<string, number>()
    lanes.forEach((lane, index) => map.set(lane.id, index))
    return map
  }, [lanes])
  const positioned = useMemo(
    () =>
      nodes.map((node, idx) => {
        const colIndex = node.authorUserId ? laneIndex.get(node.authorUserId) ?? 0 : 0
        const x = SEQ_LEFT_PADDING + colIndex * SEQ_LANE_WIDTH + SEQ_LANE_WIDTH / 2
        const y = SEQ_HEADER_HEIGHT + idx * SEQ_ROW_HEIGHT + SEQ_ROW_HEIGHT / 2
        const intentKey = node.metadata?.replyKind ?? null
        return { node, x, y, intentKey }
      }),
    [nodes, laneIndex],
  )
  const dotById = useMemo(() => {
    const map = new Map<string, { x: number; y: number; node: RoundtableMessage }>()
    for (const p of positioned) map.set(p.node.id, { x: p.x, y: p.y, node: p.node })
    return map
  }, [positioned])

  return (
    <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-violet-100">
      <svg width={width} height={height} role="img" aria-label="蝶灵圆桌时序图">
        {/* lane backgrounds */}
        {lanes.map((lane, i) => (
          <rect
            key={lane.id}
            x={SEQ_LEFT_PADDING + i * SEQ_LANE_WIDTH}
            y={0}
            width={SEQ_LANE_WIDTH}
            height={height}
            fill={i % 2 === 0 ? "#FAF7FF" : "#FFFFFF"}
          />
        ))}
        {/* lane headers */}
        {lanes.map((lane, i) => {
          const member = members.find((m) => m.id === lane.id)
          const display = lane.isUser
            ? member?.displayName || lane.name
            : lane.name
          return (
            <g key={`hdr-${lane.id}`}>
              <text
                x={SEQ_LEFT_PADDING + i * SEQ_LANE_WIDTH + SEQ_LANE_WIDTH / 2}
                y={20}
                textAnchor="middle"
                className="fill-[--color-text-secondary]"
                style={{ fontSize: 11, fontWeight: 600 }}
              >
                {lane.isUser ? "👤 " : ""}
                {display.length > 7 ? `${display.slice(0, 6)}…` : display}
              </text>
              <text
                x={SEQ_LEFT_PADDING + i * SEQ_LANE_WIDTH + SEQ_LANE_WIDTH / 2}
                y={36}
                textAnchor="middle"
                className="fill-[--color-text-muted]"
                style={{ fontSize: 9 }}
              >
                {nodes.filter((n) => n.authorUserId === lane.id).length} 条
              </text>
              <line
                x1={SEQ_LEFT_PADDING + i * SEQ_LANE_WIDTH + SEQ_LANE_WIDTH / 2}
                x2={SEQ_LEFT_PADDING + i * SEQ_LANE_WIDTH + SEQ_LANE_WIDTH / 2}
                y1={SEQ_HEADER_HEIGHT - 4}
                y2={height}
                stroke="#E8DFFA"
                strokeDasharray="2 4"
              />
            </g>
          )
        })}
        {/* edges */}
        {positioned.map(({ node, x, y }) => {
          const targetId = node.metadata?.replyToMessageId
          if (!targetId) return null
          const target = dotById.get(targetId)
          if (!target) return null
          const intentKey = node.metadata?.replyKind ?? null
          const stroke =
            intentKey === "challenge"
              ? "#F87171"
              : intentKey === "agree_build"
                ? "#34D399"
                : intentKey === "ask"
                  ? "#60A5FA"
                  : intentKey === "callback_quiet"
                    ? "#A78BFA"
                    : intentKey === "feeling"
                      ? "#F9A8D4"
                      : intentKey === "anecdote"
                        ? "#FB923C"
                        : intentKey === "recap_thread"
                          ? "#818CF8"
                          : intentKey === "half_agree"
                            ? "#2DD4BF"
                            : intentKey === "meta"
                              ? "#71717A"
                              : intentKey === "tangent"
                                ? "#FBBF24"
                                : intentKey === "respond_user"
                                  ? "#22D3EE"
                                  : intentKey === "mention"
                                    ? "#A855F7"
                                    : intentKey === "followup_reply"
                                      ? "#F59E0B"
                                      : "#C4B5FD"
          const midY = (y + target.y) / 2
          return (
            <path
              key={`edge-${node.id}`}
              d={`M ${target.x} ${target.y} C ${target.x} ${midY}, ${x} ${midY}, ${x} ${y}`}
              stroke={stroke}
              strokeWidth={1.4}
              fill="none"
              opacity={0.6}
            />
          )
        })}
        {/* nodes */}
        {positioned.map(({ node, x, y, intentKey }) => {
          const isUser =
            node.kind === "user_speak" ||
            node.kind === "user_mention" ||
            node.kind === "user_followup"
          const fill = isUser
            ? "#7C3AED"
            : intentKey === "challenge"
              ? "#F87171"
              : intentKey === "agree_build"
                ? "#34D399"
                : intentKey === "ask"
                  ? "#60A5FA"
                  : intentKey === "callback_quiet"
                    ? "#A78BFA"
                    : intentKey === "feeling"
                      ? "#F9A8D4"
                      : intentKey === "anecdote"
                        ? "#FB923C"
                        : intentKey === "recap_thread"
                          ? "#818CF8"
                          : intentKey === "half_agree"
                            ? "#2DD4BF"
                            : intentKey === "meta"
                              ? "#71717A"
                              : intentKey === "tangent"
                                ? "#FBBF24"
                                : intentKey === "followup_reply"
                                  ? "#F59E0B"
                                  : "#C4B5FD"
          return (
            <g key={`node-${node.id}`}>
              <circle cx={x} cy={y} r={5.5} fill={fill} stroke="#fff" strokeWidth={1.5} />
              <title>
                {`${node.authorName} · ${formatTime(node.createdAt)}\n${node.text}`}
              </title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function LegendStrip() {
  const entries = [
    { key: "agree_build", label: "顺势深化" },
    { key: "challenge", label: "针对性挑战" },
    { key: "half_agree", label: "半同意" },
    { key: "ask", label: "纯提问" },
    { key: "anecdote", label: "假设举例" },
    { key: "callback_quiet", label: "点名" },
    { key: "recap_thread", label: "对接两条" },
    { key: "feeling", label: "纯感受" },
    { key: "observe", label: "旁观点出" },
    { key: "tangent", label: "有意跑题" },
    { key: "meta", label: "元评论" },
    { key: "followup_reply", label: "散场追问" },
  ]
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {entries.map((entry) => (
        <span key={entry.key} className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ring-1 ${INTENT_TINT[entry.key] ?? ""}`}>
          {entry.label}
        </span>
      ))}
    </div>
  )
}
