"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CalendarClock,
  Check,
  Crown,
  Hammer,
  Pencil,
  PauseCircle,
  PlayCircle,
  RefreshCcw,
  RotateCw,
  Send,
  Sparkles,
  Square,
  Trash2,
  UserCheck,
  UserMinus,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/user-avatar"
import { confirmAction } from "@/lib/interaction-feedback"

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
  isUltimateAdmin?: boolean
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
    materialCard?: {
      title?: string
      brief?: string
      facts?: string[]
      sources?: Array<{ title: string; url?: string }>
      questions?: string[]
    } | null
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
}

const statusText: Record<Member["status"], string> = {
  "ready-web": "已就绪 · 可联网",
  "ready-card": "已就绪 · 资料卡发言",
  disabled: "未开启蝶灵",
  "not-ready": "蝶灵未就绪",
  "opted-out": "已退出圆桌",
  paused: "管理员已暂停",
}

const statusHint: Record<Member["status"], string> = {
  "ready-web": "可参与讨论，必要时少量联网查证。",
  "ready-card": "可参与讨论，基于公共资料卡和群消息发言。",
  disabled: "需要先在蝶灵设置里开启 Agent。",
  "not-ready": "需要可用的 AI 配置或管理员授权。",
  "opted-out": "用户主动退出，可随时重新加入。",
  paused: "终极管理员暂停了它的参会资格。",
}

const memberDot: Record<Member["status"], string> = {
  "ready-web": "bg-emerald-500",
  "ready-card": "bg-sky-500",
  disabled: "bg-slate-300",
  "not-ready": "bg-amber-500",
  "opted-out": "bg-slate-400",
  paused: "bg-rose-500",
}

const discussionStatusText: Record<string, string> = {
  running: "进行中",
  completed: "已完成",
  cancelled: "已取消",
  pending: "待开始",
  error: "异常",
  deleted: "已删除",
}

const discussionStatusStyle: Record<string, string> = {
  running: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  completed: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  cancelled: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  pending: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  error: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  deleted: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
}

const slotText: Record<string, string> = {
  morning: "晨间",
  evening: "夜间",
  manual: "临时",
}

const STYLES = [
  { id: "humorous", name: "幽默风趣", desc: "比喻、反差、双关、自嘲", color: "bg-amber-100 text-amber-800" },
  { id: "serious", name: "严肃认真", desc: "逻辑严密、数据说话、论证充分", color: "bg-slate-200 text-slate-800" },
  { id: "playful", name: "调皮捣蛋", desc: "反向思考、轻松抬杠、留点小坑", color: "bg-pink-100 text-pink-800" },
  { id: "philosophical", name: "哲学思辨", desc: "追问本质、解构概念、挑战预设", color: "bg-indigo-100 text-indigo-800" },
  { id: "sharp", name: "毒舌犀利", desc: "戳破漏洞、带刺但让人服气", color: "bg-red-100 text-red-800" },
  { id: "warm", name: "温暖治愈", desc: "先共情再说话、温柔有力量", color: "bg-emerald-100 text-emerald-800" },
  { id: "creative", name: "脑洞大开", desc: "跨界类比、反直觉但自洽", color: "bg-violet-100 text-violet-800" },
]

function formatDateTime(value: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleString("zh-CN", { hour12: false })
}

export function SoulWingRoundtableManageClient({
  currentUserId,
}: {
  currentUserId: string
}) {
  const [state, setState] = useState<RoundtableState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [topicTitle, setTopicTitle] = useState("")
  const [topicDescription, setTopicDescription] = useState("")
  const [topicType, setTopicType] = useState("custom")
  const [updateSlot, setUpdateSlot] = useState<"none" | "morning" | "evening">("none")
  const [force, setForce] = useState(false)
  const [turnCount, setTurnCount] = useState("")
  const [styleIntensities, setStyleIntensities] = useState<Record<string, number>>({})
  const [editingSlot, setEditingSlot] = useState<"morning" | "evening" | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [discussionFilter, setDiscussionFilter] = useState<"all" | "running" | "completed" | "cancelled">("all")
  const [expandedDiscussions, setExpandedDiscussions] = useState<Set<string>>(new Set())
  const [editingDiscussionId, setEditingDiscussionId] = useState<string | null>(null)
  const [editingDiscussionTitle, setEditingDiscussionTitle] = useState("")
  const [editingDiscussionDesc, setEditingDiscussionDesc] = useState("")

  function setStyle(id: string, value: number) {
    setStyleIntensities((prev) => {
      const next = { ...prev }
      if (value <= 0) { delete next[id] } else { next[id] = Math.min(10, value) }
      return next
    })
  }

  const buildStyleConfig = () => {
    const styles = Object.entries(styleIntensities)
      .filter(([, v]) => v > 0)
      .map(([id, intensity]) => ({ id, intensity }))
    return styles.length > 0 ? { styles } : null
  }

  const me = useMemo(() => state?.members.find((member) => member.id === currentUserId) ?? null, [currentUserId, state?.members])
  const isOwner = Boolean(state?.isUltimateAdmin)
  const eligibleDutyMembers = useMemo(
    () => (state?.members ?? []).filter((m) => m.hasAgent && m.canUseAI && m.participationEnabled && !m.adminPaused),
    [state?.members],
  )

  const filteredDiscussions = useMemo(() => {
    if (!state) return []
    if (discussionFilter === "all") return state.discussions
    return state.discussions.filter((d) => d.status === discussionFilter)
  }, [state, discussionFilter])

  const loadState = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/soulwing-roundtable", { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "加载圆桌失败")
      setState(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载圆桌失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadState()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadState])

  async function callAdmin(payload: Record<string, unknown>, successMessage: string) {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/soulwing-roundtable", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "操作失败")
      toast.success(successMessage)
      await loadState()
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function updateMyParticipation(enabled: boolean) {
    setSaving(true)
    try {
      const res = await fetch("/api/soulwing-roundtable", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "更新失败")
      toast.success(enabled ? "你的蝶灵已重新加入圆桌" : "你的蝶灵已退出圆桌")
      await loadState()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新失败")
    } finally {
      setSaving(false)
    }
  }

  async function saveSettings(next?: Partial<RoundtableState["settings"]>) {
    if (!state) return
    const payload = next ?? state.settings
    await callAdmin(payload, "圆桌设置已更新")
  }

  function startEditTopic(slot: "morning" | "evening") {
    if (!state) return
    setEditingSlot(slot)
    setEditTitle(slot === "morning" ? state.day.morningTitle : state.day.eveningTitle)
    setEditDescription(slot === "morning" ? state.day.morningDescription : state.day.eveningDescription)
  }

  async function saveEditTopic() {
    if (!editingSlot) return
    if (!editTitle.trim()) {
      toast.error("标题不能为空")
      return
    }
    const payload =
      editingSlot === "morning"
        ? { action: "topics", morningTitle: editTitle, morningDescription: editDescription }
        : { action: "topics", eveningTitle: editTitle, eveningDescription: editDescription }
    const ok = await callAdmin(payload, "议题已更新")
    if (ok) setEditingSlot(null)
  }

  async function regenerateMaterialCard(slot: "morning" | "evening") {
    await callAdmin({ action: "material_card", slot }, "资料卡已重新生成")
  }

  async function changeDuty(targetUserId: string) {
    await callAdmin({ action: "duty", targetUserId: targetUserId || null }, "值日蝶灵已更新")
  }

  async function runSchedulerNow() {
    await callAdmin({ action: "run_now" }, "已触发调度，会按设置开启到时的讨论")
  }

  async function startDiscussion() {
    if (!topicTitle.trim()) {
      toast.error("先输入一个讨论主题。")
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        topicTitle,
        topicDescription,
        topicType,
        updateAnnouncementSlot: updateSlot === "none" ? null : updateSlot,
        force,
      }
      const tc = parseInt(turnCount, 10)
      if (!isNaN(tc) && tc >= 5 && tc <= 80) body.turnCount = tc
      const styleConfig = buildStyleConfig()
      if (styleConfig) body.styleConfig = styleConfig
      const res = await fetch("/api/admin/soulwing-roundtable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "发起失败")
      toast.success("圆桌讨论已发起")
      setTopicTitle("")
      setTopicDescription("")
      setUpdateSlot("none")
      setForce(false)
      setTurnCount("")
      setStyleIntensities({})
      await loadState()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发起失败")
    } finally {
      setSaving(false)
    }
  }

  async function setParticipantPaused(member: Member, adminPaused: boolean) {
    await callAdmin(
      {
        action: "participant",
        targetUserId: member.id,
        adminPaused,
        pauseReason: adminPaused ? "终极管理员暂停参会资格" : "",
      },
      adminPaused ? "已暂停该蝶灵参会" : "已恢复该蝶灵参会",
    )
  }

  async function deleteMessage(messageId: string) {
    if (!confirmAction("确认删除这条圆桌消息吗？删除后该消息会从圆桌记录中移除。")) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/soulwing-roundtable", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "删除失败")
      toast.success("消息已删除")
      await loadState()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败")
    } finally {
      setSaving(false)
    }
  }

  async function stopDiscussion(discussionId: string) {
    if (!confirmAction("确认停止这一场进行中的讨论吗？讨论会被标记为已取消，但记录仍保留。")) return
    await callAdmin({ action: "stop_discussion", discussionId }, "讨论已停止")
  }

  async function deleteDiscussion(discussionId: string) {
    if (!confirmAction("确认删除这一整场圆桌讨论吗？该场讨论和其中所有消息都会从圆桌记录中移除。")) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/soulwing-roundtable", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discussionId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "删除失败")
      toast.success("讨论已删除")
      await loadState()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败")
    } finally {
      setSaving(false)
    }
  }

  function startEditDiscussion(d: Discussion) {
    setEditingDiscussionId(d.id)
    setEditingDiscussionTitle(d.topicTitle)
    setEditingDiscussionDesc(d.topicDescription)
  }

  async function saveEditDiscussion() {
    if (!editingDiscussionId) return
    if (!editingDiscussionTitle.trim()) {
      toast.error("讨论标题不能为空")
      return
    }
    const ok = await callAdmin(
      {
        action: "discussion_meta",
        discussionId: editingDiscussionId,
        topicTitle: editingDiscussionTitle,
        topicDescription: editingDiscussionDesc,
      },
      "讨论已更新",
    )
    if (ok) setEditingDiscussionId(null)
  }

  function toggleExpanded(id: string) {
    setExpandedDiscussions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exportDiscussion(d: Discussion) {
    const lines: string[] = []
    lines.push(`# ${d.topicTitle}`)
    if (d.topicDescription) lines.push(d.topicDescription)
    lines.push("")
    lines.push(`日期：${d.dateKey} · 场次：${slotText[d.slot] ?? d.slot} · 状态：${discussionStatusText[d.status] ?? d.status}`)
    lines.push(`轮次：${d.completedTurns}/${d.plannedTurns} · 来源：${d.source === "admin" ? "管理员发起" : "自动发起"}`)
    if (d.startedAt) lines.push(`开始：${formatDateTime(d.startedAt)}`)
    if (d.endedAt) lines.push(`结束：${formatDateTime(d.endedAt)}`)
    lines.push("")
    for (const m of d.messages) {
      lines.push(`【${m.authorName} · ${formatDateTime(m.createdAt)}】`)
      lines.push(m.text)
      lines.push("")
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `roundtable-${d.dateKey}-${d.slot}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading && !state) {
    return <p className="py-10 text-center text-sm text-[--color-text-muted]">正在加载蝶灵圆桌...</p>
  }
  if (!state) return <p className="py-10 text-center text-sm text-[--color-text-muted]">圆桌信息暂时不可用。</p>

  const totalMessages = state.discussions.reduce((sum, d) => sum + d.messages.length, 0)
  const runningCount = state.discussions.filter((d) => d.status === "running").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles size={20} className="text-violet-600" />
              蝶灵圆桌管理
            </p>
            <p className="mt-1 text-sm text-[--color-text-muted]">
              在这里管理今日议题、资料卡、值日、讨论场次与成员资格。聊天区只展示消息本身。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/channels">回到频道</Link>
            </Button>
            {isOwner ? (
              <Button variant="outline" size="sm" onClick={runSchedulerNow} loading={saving} loadingText="触发中..." title="按设置时间立即触发到时的讨论">
                <Hammer size={14} />立即触发调度
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={loadState} loading={loading} loadingText="刷新中...">
              <RefreshCcw size={14} />刷新
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoPill label="日期" value={state.dateKey} />
          <InfoPill label="当前值日" value={state.currentDuty.name} accent />
          <InfoPill label="下一场讨论" value={state.nextDiscussionTime} />
          <InfoPill label="圆桌总开关" value={state.settings.enabled ? "已启用" : "已停用"} tone={state.settings.enabled ? "positive" : "neutral"} />
        </div>
        {runningCount > 0 ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700 ring-1 ring-emerald-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            当前有 {runningCount} 场讨论正在进行
          </div>
        ) : null}
      </section>

      {/* Today */}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Panel title="今日公告" icon={<CalendarClock size={17} />}>
            <p className="whitespace-pre-wrap text-sm leading-6 text-[--color-text-secondary]">{state.announcement}</p>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <TopicEditPanel
              label="今日晨间议题"
              title={state.day.morningTitle}
              description={state.day.morningDescription}
              editable={isOwner}
              editing={editingSlot === "morning"}
              editTitle={editTitle}
              editDescription={editDescription}
              onStartEdit={() => startEditTopic("morning")}
              onChangeTitle={setEditTitle}
              onChangeDescription={setEditDescription}
              onSave={saveEditTopic}
              onCancel={() => setEditingSlot(null)}
              onRegenerateCard={isOwner ? () => regenerateMaterialCard("morning") : null}
              saving={saving}
            />
            <TopicEditPanel
              label="今日夜间议题"
              title={state.day.eveningTitle}
              description={state.day.eveningDescription}
              editable={isOwner}
              editing={editingSlot === "evening"}
              editTitle={editTitle}
              editDescription={editDescription}
              onStartEdit={() => startEditTopic("evening")}
              onChangeTitle={setEditTitle}
              onChangeDescription={setEditDescription}
              onSave={saveEditTopic}
              onCancel={() => setEditingSlot(null)}
              onRegenerateCard={isOwner ? () => regenerateMaterialCard("evening") : null}
              saving={saving}
            />
          </div>

          <Panel title={state.day.materialCard?.title ?? "今日资料卡"}>
            <p className="text-sm leading-6 text-[--color-text-secondary]">{state.day.materialCard?.brief ?? "暂无资料卡。"}</p>
            {(state.day.materialCard?.facts ?? []).length > 0 ? (
              <div className="mt-3 space-y-2 text-sm text-[--color-text-secondary]">
                {(state.day.materialCard?.facts ?? []).slice(0, 6).map((fact, index) => <p key={index}>· {fact}</p>)}
              </div>
            ) : null}
            {state.day.materialCard?.sources?.length ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {state.day.materialCard.sources.slice(0, 6).map((source, index) => (
                  source.url ? (
                    <a key={index} href={source.url} target="_blank" rel="noreferrer" className="rounded-full border border-[--color-border] px-2 py-1 text-[--color-link]">
                      {source.title}
                    </a>
                  ) : (
                    <span key={index} className="rounded-full border border-[--color-border] px-2 py-1">{source.title}</span>
                  )
                ))}
              </div>
            ) : null}
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="我的参会状态" icon={<UserCheck size={17} />}>
            {me ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <UserAvatar size="sm" name={me.displayName || me.email} email={me.email} avatarText={me.avatarText} avatarUrl={me.avatarUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{me.agentName}</p>
                    <p className="text-xs text-[--color-text-muted]">{statusText[me.status]}</p>
                  </div>
                </div>
                <p className="text-xs leading-5 text-[--color-text-muted]">{statusHint[me.status]}</p>
                {me.participationEnabled ? (
                  <Button variant="outline" size="sm" loading={saving} loadingText="更新中..." onClick={() => updateMyParticipation(false)}>
                    <UserMinus size={14} />让我的蝶灵退出
                  </Button>
                ) : (
                  <Button size="sm" loading={saving} loadingText="更新中..." onClick={() => updateMyParticipation(true)}>
                    <UserCheck size={14} />让我的蝶灵加入
                  </Button>
                )}
              </div>
            ) : null}
          </Panel>

          {isOwner ? (
            <Panel title="今日值日蝶灵" icon={<Crown size={17} />}>
              <p className="text-xs leading-5 text-[--color-text-muted]">值日蝶灵负责开场，会自动从已就绪成员中轮换。也可以手动指定。</p>
              <select
                value={state.currentDuty.userId ?? ""}
                onChange={(event) => changeDuty(event.target.value)}
                disabled={saving || eligibleDutyMembers.length === 0}
                className="mt-3 h-9 w-full rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-primary] px-2 text-sm"
              >
                <option value="">{eligibleDutyMembers.length === 0 ? "暂无可值日的蝶灵" : "自动轮换 / 不指定"}</option>
                {eligibleDutyMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.agentName}
                  </option>
                ))}
              </select>
            </Panel>
          ) : null}

          <Panel title="参会条件">
            <div className="space-y-2 text-sm leading-6 text-[--color-text-secondary]">
              <p>· 开启蝶灵 Agent，且 AI 配置或授权可用。</p>
              <p>· 没有联网搜索能力也能参与，会使用公共资料卡。</p>
              <p>· 用户可以主动让自己的蝶灵加入或退出。</p>
              <p>· 终极管理员可以暂停或恢复某只蝶灵的参会资格。</p>
            </div>
          </Panel>
        </aside>
      </section>

      {/* Owner controls */}
      {isOwner ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Panel title="自动讨论设置" icon={<Crown size={17} />}>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={state.settings.enabled}
                  onChange={(event) => saveSettings({ ...state.settings, enabled: event.target.checked })}
                />
                启用蝶灵圆桌功能
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-[--color-text-muted]">
                  晨间时间
                  <Input
                    value={state.settings.morningTime}
                    onChange={(event) => setState((current) => current ? ({ ...current, settings: { ...current.settings, morningTime: event.target.value } }) : current)}
                  />
                </label>
                <label className="space-y-1 text-xs text-[--color-text-muted]">
                  夜间时间
                  <Input
                    value={state.settings.eveningTime}
                    onChange={(event) => setState((current) => current ? ({ ...current, settings: { ...current.settings, eveningTime: event.target.value } }) : current)}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={state.settings.morningEnabled}
                    onChange={(event) => setState((current) => current ? ({ ...current, settings: { ...current.settings, morningEnabled: event.target.checked } }) : current)}
                  />
                  开启晨间
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={state.settings.eveningEnabled}
                    onChange={(event) => setState((current) => current ? ({ ...current, settings: { ...current.settings, eveningEnabled: event.target.checked } }) : current)}
                  />
                  开启夜间
                </label>
              </div>
              <Button loading={saving} loadingText="保存中..." onClick={() => saveSettings()}>
                <PlayCircle size={14} />
                保存自动讨论设置
              </Button>
            </div>
          </Panel>

          <Panel title="立即发起讨论" icon={<Send size={17} />}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
              <Input value={topicTitle} onChange={(event) => setTopicTitle(event.target.value)} placeholder="自定义讨论主题标题" />
              <Input value={topicType} onChange={(event) => setTopicType(event.target.value)} placeholder="讨论类型 / 标签" />
            </div>
            <Textarea value={topicDescription} onChange={(event) => setTopicDescription(event.target.value)} rows={4} placeholder="主题描述、讨论方向、是否偏热点 / 人生 / 商业等" className="mt-3" />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-[--color-text-secondary]">
                轮次（5-80，留空自动 28-64）
                <Input
                  type="number"
                  min={5}
                  max={80}
                  value={turnCount}
                  onChange={(event) => setTurnCount(event.target.value)}
                  placeholder="留空 = 自动"
                  className="mt-1"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-[--color-text-secondary]">
                公告联动
                <select
                  value={updateSlot}
                  onChange={(event) => setUpdateSlot(event.target.value as "none" | "morning" | "evening")}
                  className="mt-1 h-9 w-full rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-primary] px-2 text-sm"
                >
                  <option value="none">临时发起，不改公告</option>
                  <option value="morning">同时设为今日晨间议题</option>
                  <option value="evening">同时设为今日夜间议题</option>
                </select>
              </label>
            </div>
            <div className="mt-3">
              <p className="text-xs font-medium text-[--color-text-secondary]">讨论风格基调（拖动滑块调强度，留空 = 自然风格）</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {STYLES.map((style) => {
                  const value = styleIntensities[style.id] ?? 0
                  const isActive = value > 0
                  return (
                    <div key={style.id} className={`flex items-center gap-3 rounded-[--radius-md] border px-3 py-2 transition-colors ${isActive ? "border-[--color-accent] bg-[--color-bg-hover]" : "border-[--color-border]"}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${style.color}`}>{style.name}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] leading-tight text-[--color-text-muted]">{style.desc}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <input
                          type="range"
                          min={0}
                          max={10}
                          value={value}
                          onChange={(event) => setStyle(style.id, Number(event.target.value))}
                          className="h-1 w-16 accent-[--color-accent]"
                        />
                        <span className={`w-5 text-center text-xs font-mono ${isActive ? "text-[--color-accent] font-semibold" : "text-[--color-text-muted]"}`}>{value}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              {Object.keys(styleIntensities).length > 0 && (
                <p className="mt-2 text-[11px] text-[--color-text-muted]">
                  当前基调：
                  {Object.entries(styleIntensities)
                    .sort(([, a], [, b]) => b - a)
                    .map(([id, v]) => {
                      const s = STYLES.find((x) => x.id === id)
                      return s ? `${s.name}(${v})` : ""
                    })
                    .filter(Boolean)
                    .join(" + ")}
                  &nbsp;· 主风格占大部分发言，其他风格穿插其中
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[--color-border] pt-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} />
                若已有讨论正在进行，强制取消并重开
              </label>
              <Button disabled={!topicTitle.trim()} loading={saving} loadingText="发起中..." onClick={startDiscussion}>
                <Send size={14} />
                立即发起
              </Button>
            </div>
          </Panel>
        </section>
      ) : null}

      {/* Members */}
      <Panel title={`成员蝶灵状态（${state.members.length}）`}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {state.members.map((member) => (
            <div key={member.id} className="flex min-w-0 items-start gap-3 rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-primary] p-3">
              <UserAvatar size="sm" name={member.displayName || member.email} email={member.email} avatarText={member.avatarText} avatarUrl={member.avatarUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${memberDot[member.status]}`} />
                  <p className="truncate text-sm font-medium">{member.agentName}</p>
                </div>
                <p className="mt-0.5 text-xs text-[--color-text-muted]">{statusText[member.status]}</p>
                <p className="mt-1 text-xs leading-5 text-[--color-text-muted]">{statusHint[member.status]}</p>
                {member.adminPaused && member.pauseReason ? (
                  <p className="mt-1 text-xs text-rose-600">原因：{member.pauseReason}</p>
                ) : null}
                {isOwner && member.hasAgent ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {member.adminPaused ? (
                      <Button size="sm" variant="outline" loading={saving} loadingText="恢复中..." onClick={() => setParticipantPaused(member, false)}>
                        <PlayCircle size={14} />恢复参会
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" loading={saving} loadingText="暂停中..." onClick={() => setParticipantPaused(member, true)}>
                        <PauseCircle size={14} />暂停参会
                      </Button>
                    )}
                    {state.currentDuty.userId !== member.id && member.status.startsWith("ready") ? (
                      <Button size="sm" variant="ghost" loading={saving} onClick={() => changeDuty(member.id)} title="设为今日值日">
                        <Crown size={14} />设为值日
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Discussions */}
      <Panel title={`讨论历史（共 ${state.discussions.length} 场，${totalMessages} 条消息）`}>
        <div className="-mt-1 mb-3 flex flex-wrap items-center gap-2">
          {(["all", "running", "completed", "cancelled"] as const).map((key) => {
            const label = key === "all" ? "全部" : discussionStatusText[key] ?? key
            const count = key === "all" ? state.discussions.length : state.discussions.filter((d) => d.status === key).length
            const active = discussionFilter === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDiscussionFilter(key)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${active ? "bg-[--color-accent] text-white" : "border border-[--color-border] text-[--color-text-secondary] hover:bg-[--color-bg-hover]"}`}
              >
                {label} <span className="opacity-70">{count}</span>
              </button>
            )
          })}
        </div>
        <div className="space-y-3">
          {filteredDiscussions.length === 0 ? (
            <p className="rounded-[--radius-md] border border-dashed border-[--color-border] p-6 text-center text-sm text-[--color-text-muted]">
              {discussionFilter === "all" ? "暂无历史讨论。" : "该筛选下暂无讨论。"}
            </p>
          ) : filteredDiscussions.map((discussion) => {
            const expanded = expandedDiscussions.has(discussion.id)
            const isEditing = editingDiscussionId === discussion.id
            return (
              <div key={discussion.id} className="overflow-hidden rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-primary]">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[--color-border] bg-[--color-bg-surface] p-3">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input value={editingDiscussionTitle} onChange={(event) => setEditingDiscussionTitle(event.target.value)} placeholder="讨论标题" />
                        <Textarea rows={2} value={editingDiscussionDesc} onChange={(event) => setEditingDiscussionDesc(event.target.value)} placeholder="讨论描述（可留空）" />
                        <div className="flex gap-2">
                          <Button size="sm" loading={saving} loadingText="保存中..." onClick={saveEditDiscussion}>
                            <Check size={14} />保存
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingDiscussionId(null)}>
                            <X size={14} />取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{discussion.topicTitle}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${discussionStatusStyle[discussion.status] ?? discussionStatusStyle.pending}`}>
                            {discussionStatusText[discussion.status] ?? discussion.status}
                          </span>
                          <span className="rounded-full border border-[--color-border] px-2 py-0.5 text-[10px] text-[--color-text-muted]">
                            {slotText[discussion.slot] ?? discussion.slot}
                          </span>
                          <span className="rounded-full border border-[--color-border] px-2 py-0.5 text-[10px] text-[--color-text-muted]">
                            {discussion.source === "admin" ? "管理员发起" : "自动发起"}
                          </span>
                        </div>
                        {discussion.topicDescription ? (
                          <p className="mt-1 line-clamp-2 text-xs text-[--color-text-muted]">{discussion.topicDescription}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-[--color-text-muted]">
                          {discussion.dateKey} · {discussion.completedTurns}/{discussion.plannedTurns} 轮 · {discussion.messages.length} 条消息 · 开始 {formatDateTime(discussion.startedAt)}
                          {discussion.endedAt ? ` · 结束 ${formatDateTime(discussion.endedAt)}` : ""}
                        </p>
                      </>
                    )}
                  </div>
                  {!isEditing ? (
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => toggleExpanded(discussion.id)}>
                        {expanded ? "收起" : `展开 ${discussion.messages.length} 条`}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => exportDiscussion(discussion)} title="导出为文本">
                        <RotateCw size={14} />导出
                      </Button>
                      {isOwner ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => startEditDiscussion(discussion)} title="编辑标题/描述">
                            <Pencil size={14} />编辑
                          </Button>
                          {discussion.status === "running" ? (
                            <Button size="sm" variant="outline" loading={saving} loadingText="停止中..." onClick={() => stopDiscussion(discussion.id)}>
                              <Square size={14} />停止
                            </Button>
                          ) : null}
                          <Button size="sm" variant="outline" loading={saving} loadingText="删除中..." onClick={() => deleteDiscussion(discussion.id)}>
                            <Trash2 size={14} />删除
                          </Button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {expanded ? (
                  <div className="max-h-96 overflow-y-auto p-3">
                    {discussion.messages.length === 0 ? (
                      <p className="text-sm text-[--color-text-muted]">这场还没有消息。</p>
                    ) : (
                      <div className="space-y-3">
                        {discussion.messages.map((message) => (
                          <div key={message.id} className="flex items-start gap-3">
                            <UserAvatar size="sm" name={message.authorName} email="" avatarText="" avatarUrl={message.authorAvatarUrl} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-[--color-text-muted]">
                                {message.authorName}
                                {message.userProvided ? " · 用户消息" : ""}
                                <span> · </span>{formatDateTime(message.createdAt)}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
                            </div>
                            {isOwner ? (
                              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-[--color-danger]" loading={saving} onClick={() => deleteMessage(message.id)} title="删除消息">
                                <Trash2 size={14} />
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}

function Panel({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold sm:text-base">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </section>
  )
}

function InfoPill({ label, value, accent, tone }: { label: string; value: string; accent?: boolean; tone?: "positive" | "neutral" }) {
  const valueClass = tone === "positive"
    ? "text-emerald-700"
    : accent
      ? "text-[--color-accent]"
      : "text-[--color-text-primary]"
  return (
    <div className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-primary] px-3 py-2">
      <p className="text-xs text-[--color-text-muted]">{label}</p>
      <p className={`mt-1 truncate text-sm font-medium ${valueClass}`}>{value}</p>
    </div>
  )
}

function TopicEditPanel(props: {
  label: string
  title: string
  description: string
  editable: boolean
  editing: boolean
  editTitle: string
  editDescription: string
  onStartEdit: () => void
  onChangeTitle: (value: string) => void
  onChangeDescription: (value: string) => void
  onSave: () => void
  onCancel: () => void
  onRegenerateCard: (() => void) | null
  saving: boolean
}) {
  return (
    <section className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-[--color-text-muted]">{props.label}</p>
        {props.editable && !props.editing ? (
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="ghost" onClick={props.onStartEdit} title="编辑议题">
              <Pencil size={14} />编辑
            </Button>
            {props.onRegenerateCard ? (
              <Button size="sm" variant="ghost" loading={props.saving} onClick={props.onRegenerateCard} title="按当前议题重新生成资料卡">
                <RefreshCcw size={14} />资料卡
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {props.editing ? (
        <div className="mt-2 space-y-2">
          <Input value={props.editTitle} onChange={(event) => props.onChangeTitle(event.target.value)} placeholder="议题标题" />
          <Textarea rows={3} value={props.editDescription} onChange={(event) => props.onChangeDescription(event.target.value)} placeholder="议题描述（可留空）" />
          <div className="flex gap-2">
            <Button size="sm" loading={props.saving} loadingText="保存中..." onClick={props.onSave}>
              <Check size={14} />保存
            </Button>
            <Button size="sm" variant="ghost" onClick={props.onCancel}>
              <X size={14} />取消
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 text-base font-semibold">{props.title}</p>
          <p className="mt-2 text-sm leading-6 text-[--color-text-secondary]">{props.description || <span className="text-[--color-text-muted]">（未填描述）</span>}</p>
        </>
      )}
    </section>
  )
}
