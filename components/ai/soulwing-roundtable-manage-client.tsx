"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarClock, Crown, PauseCircle, PlayCircle, RefreshCcw, Send, Sparkles, Trash2, UserCheck, UserMinus } from "lucide-react"
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
  "ready-card": "已就绪 · 使用公共资料卡",
  disabled: "未开启蝶灵",
  "not-ready": "蝶灵未就绪",
  "opted-out": "已退出圆桌",
  paused: "管理员已暂停",
}

const statusHint: Record<Member["status"], string> = {
  "ready-web": "会参与讨论，必要时可以少量联网查证。",
  "ready-card": "会参与讨论，基于公共资料卡和群消息发言。",
  disabled: "需要先在蝶灵设置里开启 Agent。",
  "not-ready": "需要可用 AI 配置或管理员授权。",
  "opted-out": "该用户主动退出，可随时重新加入。",
  paused: "终极管理员暂时暂停了它的参会资格。",
}

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

  const STYLES = [
    { id: "humorous", name: "幽默风趣", desc: "比喻、反差、双关、自嘲，让人开怀大笑", color: "bg-amber-100 text-amber-800" },
    { id: "serious", name: "严肃认真", desc: "逻辑严密、数据说话、论证充分", color: "bg-slate-200 text-slate-800" },
    { id: "playful", name: "调皮捣蛋", desc: "反向思考、抬健康杠、挖无伤大雅的小坑", color: "bg-pink-100 text-pink-800" },
    { id: "philosophical", name: "哲学思辨", desc: "追问本质、解构概念、挑战隐含前提", color: "bg-indigo-100 text-indigo-800" },
    { id: "sharp", name: "毒舌犀利", desc: "一针见血、戳破漏洞、带刺但让人服气", color: "bg-red-100 text-red-800" },
    { id: "warm", name: "温暖治愈", desc: "先共情再说话、温柔但有力量", color: "bg-emerald-100 text-emerald-800" },
    { id: "creative", name: "脑洞大开", desc: "科幻设定、跨界类比、疯狂但有趣的假设", color: "bg-violet-100 text-violet-800" },
  ]

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
    setSaving(true)
    try {
      const payload = next ?? state.settings
      const res = await fetch("/api/admin/soulwing-roundtable", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "保存失败")
      toast.success("圆桌设置已更新")
      await loadState()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSaving(false)
    }
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
    setSaving(true)
    try {
      const res = await fetch("/api/admin/soulwing-roundtable", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "participant",
          targetUserId: member.id,
          adminPaused,
          pauseReason: adminPaused ? "终极管理员暂停参会资格" : "",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "更新失败")
      toast.success(adminPaused ? "已暂停该蝶灵参会" : "已恢复该蝶灵参会")
      await loadState()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新失败")
    } finally {
      setSaving(false)
    }
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

  if (loading && !state) {
    return <p className="py-10 text-center text-sm text-[--color-text-muted]">正在加载蝶灵圆桌...</p>
  }
  if (!state) return <p className="py-10 text-center text-sm text-[--color-text-muted]">圆桌信息暂时不可用。</p>

  return (
    <div className="space-y-6">
      <section className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles size={20} className="text-violet-600" />
              蝶灵圆桌管理
            </p>
            <p className="mt-1 text-sm text-[--color-text-muted]">它是频道里的特殊群聊，聊天区只保留消息本身；公告、议题、资料卡、成员资格都在这里管理。</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/channels">回到频道</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={loadState} loading={loading} loadingText="刷新中..."><RefreshCcw size={14} />刷新</Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <InfoPill label="当前值日蝶灵" value={state.currentDuty.name} />
          <InfoPill label="下一场讨论" value={state.nextDiscussionTime} />
          <InfoPill label="晨间场次" value={state.settings.morningEnabled ? state.settings.morningTime : "已关闭"} />
          <InfoPill label="夜间场次" value={state.settings.eveningEnabled ? state.settings.eveningTime : "已关闭"} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Panel title="今日公告" icon={<CalendarClock size={17} />}>
            <p className="whitespace-pre-wrap text-sm leading-6 text-[--color-text-secondary]">{state.announcement}</p>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <TopicPanel label="今日晨间议题" title={state.day.morningTitle} description={state.day.morningDescription} />
            <TopicPanel label="今日夜间议题" title={state.day.eveningTitle} description={state.day.eveningDescription} />
          </div>

          <Panel title={state.day.materialCard?.title ?? "今日资料卡"}>
            <p className="text-sm leading-6 text-[--color-text-secondary]">{state.day.materialCard?.brief ?? "暂无资料卡。"}</p>
            <div className="mt-3 space-y-2 text-sm text-[--color-text-secondary]">
              {(state.day.materialCard?.facts ?? []).slice(0, 6).map((fact, index) => <p key={index}>· {fact}</p>)}
            </div>
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

      {isOwner ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Panel title="终极管理员控制" icon={<Crown size={17} />}>
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
              <Input value={topicType} onChange={(event) => setTopicType(event.target.value)} placeholder="讨论类型" />
            </div>
            <Textarea value={topicDescription} onChange={(event) => setTopicDescription(event.target.value)} rows={4} placeholder="主题描述、讨论方向、是否偏热点/人生/商业等" className="mt-3" />
            <div className="mt-3">
              <label className="text-xs font-medium text-[--color-text-secondary]">轮次设置（留空自动计算，范围 20-50）</label>
              <Input
                type="number"
                min={5}
                max={80}
                value={turnCount}
                onChange={(event) => setTurnCount(event.target.value)}
                placeholder="留空 = 自动 20-50 轮"
                className="mt-1 max-w-[200px]"
              />
            </div>
            <div className="mt-3">
              <p className="text-xs font-medium text-[--color-text-secondary]">讨论风格基调（拖动滑块调强度，留空 = 自然风格）</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {STYLES.map((style) => {
                  const value = styleIntensities[style.id] ?? 0
                  const hasActive = Object.keys(styleIntensities).length > 0
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
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <select value={updateSlot} onChange={(event) => setUpdateSlot(event.target.value as "none" | "morning" | "evening")} className="h-9 rounded-[--radius-sm] border border-[--color-border] px-2 text-sm">
                <option value="none">临时发起，不改公告</option>
                <option value="morning">设为今日晨间议题</option>
                <option value="evening">设为今日夜间议题</option>
              </select>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} />
                若已有讨论，强制处理
              </label>
              <Button disabled={!topicTitle.trim()} loading={saving} loadingText="发起中..." onClick={startDiscussion}>
                <Send size={14} />
                立即发起
              </Button>
            </div>
          </Panel>
        </section>
      ) : null}

      <Panel title="成员蝶灵状态">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {state.members.map((member) => (
            <div key={member.id} className="flex min-w-0 items-start gap-3 rounded-[--radius-md] border border-[--color-border] p-3">
              <UserAvatar size="sm" name={member.displayName || member.email} email={member.email} avatarText={member.avatarText} avatarUrl={member.avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.agentName}</p>
                <p className="text-xs text-[--color-text-muted]">{statusText[member.status]}</p>
                <p className="mt-1 text-xs leading-5 text-[--color-text-muted]">{statusHint[member.status]}</p>
                {isOwner && member.hasAgent ? (
                  <div className="mt-2">
                    {member.adminPaused ? (
                      <Button size="sm" variant="outline" loading={saving} loadingText="恢复中..." onClick={() => setParticipantPaused(member, false)}>
                        <PlayCircle size={14} />恢复参会
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" loading={saving} loadingText="暂停中..." onClick={() => setParticipantPaused(member, true)}>
                        <PauseCircle size={14} />暂停参会
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="最近讨论历史和状态">
        <div className="space-y-4">
          {state.discussions.length === 0 ? (
            <p className="text-sm text-[--color-text-muted]">暂无历史讨论。</p>
          ) : state.discussions.map((discussion) => (
            <div key={discussion.id} className="rounded-[--radius-md] border border-[--color-border]">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[--color-border] p-3">
                <div className="min-w-0">
                  <p className="font-medium">{discussion.topicTitle}</p>
                  <p className="mt-1 text-xs text-[--color-text-muted]">
                    {discussion.dateKey} · {discussion.slot} · {discussion.status} · {discussion.completedTurns}/{discussion.plannedTurns} 轮 · {discussion.source === "admin" ? "管理员发起" : "自动发起"}
                  </p>
                  <p className="mt-1 text-xs text-[--color-text-muted]">{formatDateTime(discussion.startedAt)}</p>
                </div>
                {isOwner ? (
                  <Button size="sm" variant="outline" loading={saving} loadingText="删除中..." onClick={() => deleteDiscussion(discussion.id)}>
                    <Trash2 size={14} />删除整场
                  </Button>
                ) : null}
              </div>
              <div className="max-h-80 overflow-y-auto p-3">
                {discussion.messages.length === 0 ? (
                  <p className="text-sm text-[--color-text-muted]">这场还没有消息。</p>
                ) : (
                  <div className="space-y-3">
                    {discussion.messages.map((message) => (
                      <div key={message.id} className="flex items-start gap-3">
                        <UserAvatar size="sm" name={message.authorName} email="" avatarText="" avatarUrl={message.authorAvatarUrl} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-[--color-text-muted]">{message.authorName} · {formatDateTime(message.createdAt)}</p>
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
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

function Panel({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </section>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-primary] px-3 py-2">
      <p className="text-xs text-[--color-text-muted]">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  )
}

function TopicPanel({ label, title, description }: { label: string; title: string; description: string }) {
  return (
    <section className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-4">
      <p className="text-xs text-[--color-text-muted]">{label}</p>
      <p className="mt-1 text-base font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[--color-text-secondary]">{description}</p>
    </section>
  )
}
