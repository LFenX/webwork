"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { confirmAction } from "@/lib/interaction-feedback"

type AgentProfileData = {
  userId: string
  enabled: boolean
  soulContent: string
  identityContent: string
  userContextContent: string
  rulesContent: string
  soulVersion: number
  identityVersion: number
  userContextVersion: number
  rulesVersion: number
  avatarUrl: string | null
}

type MemoryFactItem = {
  id: string
  category: string
  title: string
  content: string
  tags: string[]
  source: string
  importance: string
  createdAt: string
  updatedAt: string
}

type MemoryEventItem = {
  id: string
  conversationId: string | null
  topicSummary: string
  keyTakeaways: string
  relatedModules: string[]
  keywords: string[]
  importance: string
  sensitive: boolean
  createdAt: string
}

type MemoryToolEventItem = {
  id: string
  action: string
  module: string | null
  title: string | null
  articleId: string | null
  folderId: string | null
  folderName: string | null
  sourceModule: string | null
  targetModule: string | null
  slugChanged: boolean | null
  changedFields: string[]
  createdAt: string
}

type MemorySettingsData = {
  enableLongTermMemory: boolean
  enablePersonaContext: boolean
  enableConversationArchive: boolean
  enableToolMemoryEvents: boolean
  enableMemoryRecall: boolean
  enableMemoryTools: boolean
  storeFullConversations: boolean
  autoTagSensitiveContent: boolean
  requireConfirmBeforeSave: boolean
}

type PersonaSectionId = "identity" | "soul" | "user" | "rules"

const CATEGORY_LABELS: Record<string, string> = {
  preference: "偏好",
  project: "项目",
  decision: "决策",
  workflow: "工作流",
  bugfix: "问题修复",
  content_operation: "内容操作",
  other: "其他",
}

const CATEGORIES = Object.keys(CATEGORY_LABELS)

const IMPORTANCE_LABELS: Record<string, string> = { low: "低", medium: "中", high: "高" }

const ACTION_LABELS: Record<string, string> = {
  create_article: "创建文章",
  update_article: "修改文章",
  move_article: "移动文章",
  same_module_move: "模块内移动",
  cross_module_move: "跨模块移动",
  create_folder: "创建文件夹",
  create_folder_duplicate: "创建文件夹(复用)",
}

function formatDate(s: string) {
  return new Date(s).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-10 rounded-full px-4 text-[13px] sm:px-5 sm:text-sm font-medium transition-all whitespace-nowrap ${
        active
          ? "bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.20)]"
          : "text-slate-600 hover:bg-blue-50 hover:text-blue-600"
      }`}
    >
      {children}
    </button>
  )
}

function Toggle({ label, description, value, onChange, warning }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void; warning?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[16px] border border-slate-100 bg-white px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.025)]">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[--color-text-primary]">{label}</p>
        <p className="mt-0.5 text-xs text-[--color-text-muted]">{description}</p>
        {warning ? <p className="mt-1 text-xs text-[--color-warning]">{warning}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`mt-0.5 relative inline-flex h-7 w-11 shrink-0 items-center rounded-full border-2 transition-colors p-0.5 ${
          value
            ? "border-blue-500 bg-blue-500"
            : "border-gray-300 bg-gray-200"
        }`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${value ? "translate-x-[18px]" : "translate-x-0"}`} />
      </button>
    </div>
  )
}

function SoulwingStackLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-[18px] border border-slate-100 bg-white px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.025)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-44 max-w-full rounded-full bg-slate-100" />
              <div className="h-3 w-full rounded-full bg-slate-100" />
              <div className="h-3 w-2/3 rounded-full bg-slate-100" />
            </div>
            <div className="h-7 w-20 shrink-0 rounded-full bg-blue-50" />
          </div>
        </div>
      ))}
    </div>
  )
}

function SoulwingPersonaLoading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true">
      <div className="rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.045)] sm:p-5">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 rounded-full bg-slate-100" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-32 rounded-full bg-slate-100" />
            <div className="h-3 w-full rounded-full bg-slate-100" />
            <div className="h-3 w-3/4 rounded-full bg-slate-100" />
          </div>
          <div className="hidden h-10 w-28 rounded-full bg-blue-50 sm:block" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden rounded-[18px] border border-slate-200/80 bg-white p-2 lg:block">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="mb-2 h-20 rounded-[14px] bg-slate-100" />
          ))}
        </aside>
        <section className="min-h-[560px] rounded-[18px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.045)]">
          <div className="h-4 w-20 rounded-full bg-blue-50" />
          <div className="mt-3 h-6 w-44 rounded-[10px] bg-slate-100" />
          <div className="mt-2 h-4 w-2/3 rounded-full bg-slate-100" />
          <div className="mt-6 space-y-3 rounded-[16px] bg-slate-50 p-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className={`h-3 rounded-full bg-slate-100 ${index % 4 === 0 ? "w-2/3" : "w-full"}`} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function SoulwingToggleLoading() {
  return <SoulwingStackLoading rows={7} />
}

export function SoulWingSettingsClient() {
  const [tab, setTab] = useState<"persona" | "memory" | "logs" | "privacy" | "auto_reply">("persona")
  const [activePersonaSection, setActivePersonaSection] = useState<PersonaSectionId>("identity")

  // ── Persona state ──
  const [profile, setProfile] = useState<AgentProfileData | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [soul, setSoul] = useState("")
  const [identity, setIdentity] = useState("")
  const [userCtx, setUserCtx] = useState("")
  const [rules, setRules] = useState("")
  const [savingPersona, setSavingPersona] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [savingMemory, setSavingMemory] = useState(false)
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null)

  // ── Memory state ──
  const [facts, setFacts] = useState<MemoryFactItem[]>([])
  const [factsLoading, setFactsLoading] = useState(false)
  const [factSearch, setFactSearch] = useState("")
  const [factCategory, setFactCategory] = useState("")
  const [editingFact, setEditingFact] = useState<MemoryFactItem | null>(null)
  const [showNewFact, setShowNewFact] = useState(false)
  const [newCategory, setNewCategory] = useState("other")
  const [newTitle, setNewTitle] = useState("")
  const [newContent, setNewContent] = useState("")
  const [newTags, setNewTags] = useState("")
  const [newImportance, setNewImportance] = useState("medium")
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editCategory, setEditCategory] = useState("")
  const [editImportance, setEditImportance] = useState("")
  const [editTags, setEditTags] = useState("")

  // ── Logs state ──
  const [events, setEvents] = useState<MemoryEventItem[]>([])
  const [toolEvents, setToolEvents] = useState<MemoryToolEventItem[]>([])
  const [logTab, setLogTab] = useState<"events" | "tools">("events")
  const [logsLoading, setLogsLoading] = useState(false)

  // ── Privacy state ──
  const [settings, setSettings] = useState<MemorySettingsData | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)

  // ── Persona ────────────────────────────────────────────────────────────

  const loadProfile = useCallback(async () => {
    setProfileLoading(true)
    try {
      const res = await fetch("/api/ai/agent-profile")
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setProfile(data)
      setSoul(data.soulContent ?? "")
      setIdentity(data.identityContent ?? "")
      setUserCtx(data.userContextContent ?? "")
      setRules(data.rulesContent ?? "")
    } catch { toast.error("加载人格配置失败") }
    finally { setProfileLoading(false) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadProfile() }, [loadProfile])

  const saveProfile = async () => {
    setSavingPersona(true)
    try {
      const res = await fetch("/api/ai/agent-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soulContent: soul, identityContent: identity, userContextContent: userCtx, rulesContent: rules }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("人格配置已保存")
      await loadProfile()
    } catch { toast.error("保存人格配置失败") }
    finally { setSavingPersona(false) }
  }

  const onAvatarFilePicked = async (file: File | null) => {
    if (!file) return
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
      toast.error("仅支持 PNG / JPG / WebP / GIF 格式。")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("头像图片不能超过 2MB。")
      return
    }
    let dataUrl = ""
    try {
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
        reader.onerror = () => reject(reader.error ?? new Error("读取文件失败"))
        reader.readAsDataURL(file)
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取文件失败")
      return
    }
    if (!dataUrl) return
    setSavingAvatar(true)
    try {
      const res = await fetch("/api/ai/agent-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarDataUrl: dataUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "上传失败")
      toast.success("蝶灵头像已更新")
      await loadProfile()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败")
    } finally {
      setSavingAvatar(false)
      if (avatarFileInputRef.current) avatarFileInputRef.current.value = ""
    }
  }

  const resetAgentAvatar = async () => {
    if (!confirmAction("恢复为你账户的头像作为蝶灵头像？当前自定义蝶灵头像会被替换。")) return
    setSavingAvatar(true)
    try {
      const res = await fetch("/api/ai/agent-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "重置失败")
      toast.success("已恢复为账户头像")
      await loadProfile()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重置失败")
    } finally {
      setSavingAvatar(false)
    }
  }

  const restoreDefaults = async () => {
    if (!confirmAction("确定要恢复默认蝶灵模板吗？当前自定义的人格、身份、上下文和规则内容会被替换为原始默认值。")) return
    setSavingPersona(true)
    try {
      const res = await fetch("/api/ai/agent-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restoreDefaults: true }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("已恢复为原始默认蝶灵模板")
      await loadProfile()
    } catch { toast.error("恢复默认模板失败") }
    finally { setSavingPersona(false) }
  }

  const personaSections = [
    {
      id: "identity" as const,
      eyebrow: "IDENTITY",
      title: "蝶灵是谁",
      description: "定义蝶灵的身份、定位和与你的关系。",
      value: identity,
      setValue: setIdentity,
      version: profile?.identityVersion ?? 0,
      placeholder: "例如：中文名、与你的关系、核心定位、不可混淆的身份边界。",
    },
    {
      id: "soul" as const,
      eyebrow: "SOUL",
      title: "性格与表达方式",
      description: "定义蝶灵怎么说话、怎么思考、怎么做事。",
      value: soul,
      setValue: setSoul,
      version: profile?.soulVersion ?? 0,
      placeholder: "例如：语气、思考习惯、协作方式、回答偏好、情绪颗粒度。",
    },
    {
      id: "user" as const,
      eyebrow: "USER",
      title: "蝶灵认识的你",
      description: "告诉蝶灵关于你的背景、偏好、项目和长期目标。",
      value: userCtx,
      setValue: setUserCtx,
      version: profile?.userContextVersion ?? 0,
      placeholder: "例如：长期项目、偏好的工作方式、重要背景、你希望它记住的上下文。",
    },
    {
      id: "rules" as const,
      eyebrow: "RULES",
      title: "行为边界",
      description: "你为蝶灵设定的行为规则。平台级安全规则始终优先，此处规则不能覆盖。",
      value: rules,
      setValue: setRules,
      version: profile?.rulesVersion ?? 0,
      placeholder: "例如：必须遵守的表达边界、需要主动确认的场景、不要触碰的话题。",
    },
  ]
  const activePersona = personaSections.find(section => section.id === activePersonaSection) ?? personaSections[0]
  const hasPersonaChanges = profile
    ? identity !== (profile.identityContent ?? "")
      || soul !== (profile.soulContent ?? "")
      || userCtx !== (profile.userContextContent ?? "")
      || rules !== (profile.rulesContent ?? "")
    : false

  // ── Memory ─────────────────────────────────────────────────────────────

  const loadFacts = useCallback(async (keyword: string, category: string) => {
    setFactsLoading(true)
    try {
      const params = new URLSearchParams()
      if (keyword) params.set("keyword", keyword)
      if (category) params.set("category", category)
      const res = await fetch(`/api/ai/memory?${params}`)
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setFacts(data.items ?? [])
    } catch { toast.error("加载记忆列表失败") }
    finally { setFactsLoading(false) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadFacts(factSearch, factCategory) }, [factSearch, factCategory, loadFacts])

  const createFact = async () => {
    if (!newTitle.trim() || !newContent.trim()) { toast.error("标题和内容不能为空"); return }
    setSavingMemory(true)
    try {
      const res = await fetch("/api/ai/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCategory, title: newTitle.trim(), content: newContent.trim(), tags: newTags.split(",").map(s => s.trim()).filter(Boolean), importance: newImportance }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("记忆已创建")
      setShowNewFact(false)
      setNewTitle(""); setNewContent(""); setNewTags(""); setNewCategory("other"); setNewImportance("medium")
      await loadFacts(factSearch, factCategory)
    } catch { toast.error("创建记忆失败") }
    finally { setSavingMemory(false) }
  }

  const startEdit = (fact: MemoryFactItem) => {
    setEditingFact(fact)
    setEditTitle(fact.title)
    setEditContent(fact.content)
    setEditCategory(fact.category)
    setEditImportance(fact.importance)
    setEditTags((fact.tags ?? []).join(", "))
  }

  const saveEdit = async () => {
    if (!editingFact) return
    setSavingMemory(true)
    try {
      const res = await fetch(`/api/ai/memory/${editingFact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), content: editContent.trim(), category: editCategory, importance: editImportance, tags: editTags.split(",").map(s => s.trim()).filter(Boolean) }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("记忆已更新")
      setEditingFact(null)
      await loadFacts(factSearch, factCategory)
    } catch { toast.error("更新记忆失败") }
    finally { setSavingMemory(false) }
  }

  const forgetFact = async (fact: MemoryFactItem) => {
    if (!confirmAction(`确定要忘记这条记忆吗？\n\n"${fact.title}"\n\n忘记后不会硬删除，但默认不再展示。`)) return
    setSavingMemory(true)
    try {
      const res = await fetch(`/api/ai/memory/${fact.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      toast.success("已忘记这条记忆")
      await loadFacts(factSearch, factCategory)
    } catch { toast.error("忘记记忆失败") }
    finally { setSavingMemory(false) }
  }

  // ── Logs ───────────────────────────────────────────────────────────────

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const [eRes, tRes] = await Promise.all([
        fetch("/api/ai/memory/events"),
        fetch("/api/ai/memory/tool-events"),
      ])
      if (eRes.ok) { const d = await eRes.json(); setEvents(d.items ?? []) }
      if (tRes.ok) { const d = await tRes.json(); setToolEvents(d.items ?? []) }
    } catch { /* silent */ }
    finally { setLogsLoading(false) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (tab === "logs") { setLogsLoading(true); loadLogs().finally(() => setLogsLoading(false)) } }, [tab, loadLogs])

  // ── Privacy ────────────────────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true)
    try {
      const res = await fetch("/api/ai/memory/settings")
      if (!res.ok) throw new Error("Failed")
      setSettings(await res.json())
    } catch { toast.error("加载隐私设置失败") }
    finally { setSettingsLoading(false) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadSettings() }, [loadSettings])

  const toggleSetting = async (key: keyof MemorySettingsData, value: boolean) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
    try {
      await fetch("/api/ai/memory/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      })
    } catch { toast.error("保存设置失败"); await loadSettings() }
  }

  // ── Auto-reply ──────────────────────────────────────────────────────────

  type AutoReplySettingRow = {
    id: string; enabled: boolean; scope: string; chatType: string | null; conversationId: string | null
    triggerMode: string; replyMode: string; templateText: string | null; customInstruction: string | null
    discloseAsAutoReply: boolean; allowGroupReply: boolean; cooldownMinutes: number; maxRepliesPerDay: number; createdAt: string
  }
  type AutoReplyLogRow = { id: string; chatType: string; replyText: string; replyMode: string; createdAt: string }

  const [autoReplySettings, setAutoReplySettings] = useState<AutoReplySettingRow[]>([])
  const [autoReplyLogs, setAutoReplyLogs] = useState<AutoReplyLogRow[]>([])
  const [autoReplyLoading, setAutoReplyLoading] = useState(false)
  const [autoReplyFeatureEnabled, setAutoReplyFeatureEnabled] = useState(false)
  const [savingAutoReply, setSavingAutoReply] = useState(false)

  const loadAutoReply = useCallback(async () => {
    setAutoReplyLoading(true)
    try {
      const [sRes, lRes] = await Promise.all([
        fetch("/api/chat/auto-reply/settings"),
        fetch("/api/chat/auto-reply/logs?limit=20"),
      ])
      if (sRes.ok) {
        const d = await sRes.json()
        setAutoReplySettings(d.items ?? [])
      }
      if (lRes.ok) { const d = await lRes.json(); setAutoReplyLogs(d.items ?? []) }
    } catch { /* silent */ }
    finally { setAutoReplyLoading(false) }
  }, [setAutoReplySettings])

  // After creating/patching a setting the response includes featureEnabled
  const syncFeatureEnabled = (data: { featureEnabled?: boolean }) => {
    if (typeof data.featureEnabled === "boolean") setAutoReplyFeatureEnabled(data.featureEnabled)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (tab === "auto_reply") void loadAutoReply() }, [tab, loadAutoReply])

  const createGlobalSetting = async () => {
    setSavingAutoReply(true)
    try {
      const res = await fetch("/api/chat/auto-reply/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "global", replyMode: "away_notice", discloseAsAutoReply: true }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      syncFeatureEnabled(data)
      toast.success("已创建默认自动回复配置")
      await loadAutoReply()
    } catch { toast.error("创建失败") }
    finally { setSavingAutoReply(false) }
  }

  const patchAutoReplySetting = async (id: string, patch: Partial<AutoReplySettingRow>) => {
    setSavingAutoReply(true)
    try {
      const res = await fetch(`/api/chat/auto-reply/settings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      syncFeatureEnabled(data)
      setAutoReplySettings(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
      toast.success("已保存")
    } catch { toast.error("保存失败") }
    finally { setSavingAutoReply(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="soulwing-settings-console space-y-5">
      {/* Tabs */}
      <div className="flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-[18px] border border-slate-200/80 bg-white p-1 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <TabButton active={tab === "persona"} onClick={() => setTab("persona")}>人格设置</TabButton>
        <TabButton active={tab === "memory"} onClick={() => setTab("memory")}>长期记忆</TabButton>
        <TabButton active={tab === "logs"} onClick={() => setTab("logs")}>自动记忆日志</TabButton>
        <TabButton active={tab === "privacy"} onClick={() => setTab("privacy")}>隐私与开关</TabButton>
        <TabButton active={tab === "auto_reply"} onClick={() => setTab("auto_reply")}>自动回复</TabButton>
      </div>

      {/* ═══ 人格设置 ═══ */}
      {tab === "persona" && (
        <div className="space-y-5">
          {profileLoading ? <SoulwingPersonaLoading /> : (
            <>
              {!profile?.enabled ? (
                <div className="rounded-[18px] border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  当前已关闭用户专属人格上下文。蝶灵将使用最简默认身份回复。
                </div>
              ) : null}

              <div className="rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.045)] sm:p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[--color-border-strong] bg-[--color-bg-hover]">
                    {profile?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatarUrl} alt="蝶灵头像" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-[--color-text-muted]">默认</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[--color-text-primary]">蝶灵头像</p>
                    <p className="mt-1 text-xs leading-5 text-[--color-text-muted]">
                      默认沿用你的账户头像。可以上传一张图片让你的蝶灵在圆桌、聊天等地方有独立形象。
                      {profile?.avatarUrl ? "" : " 当前正在使用账户头像。"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={avatarFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(event) => void onAvatarFilePicked(event.target.files?.[0] ?? null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={savingAvatar}
                      onClick={() => avatarFileInputRef.current?.click()}
                      className="rounded-full px-4"
                    >
                      {savingAvatar ? "上传中..." : profile?.avatarUrl ? "更换头像" : "上传头像"}
                    </Button>
                    {profile?.avatarUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={savingAvatar}
                        onClick={resetAgentAvatar}
                        className="rounded-full px-4 text-[--color-text-muted]"
                      >
                        恢复为账户头像
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-[--color-text-primary]">人格文件编辑器</p>
                    <p className="mt-1 text-sm text-[--color-text-muted]">选择一个分区专注编辑，保存时会一起更新四个人格文件。</p>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs ${
                    hasPersonaChanges
                      ? "bg-[--color-brand]/10 text-[--color-brand]"
                      : "bg-[--color-bg-hover] text-[--color-text-muted]"
                  }`}>
                    {hasPersonaChanges ? "有未保存修改" : "当前已保存"}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
                  <aside className="min-w-0">
                    <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:rounded-[18px] lg:border lg:border-slate-200/80 lg:bg-white lg:p-2 lg:shadow-[0_10px_24px_rgba(15,23,42,0.035)]">
                      {personaSections.map(section => {
                        const active = section.id === activePersona.id
                        return (
                          <button
                            key={section.id}
                            type="button"
                            onClick={() => setActivePersonaSection(section.id)}
                            className={`relative min-w-[148px] rounded-full px-4 py-2 text-left transition-all lg:min-w-0 lg:w-full lg:rounded-[--radius-md] lg:px-4 lg:py-3 ${
                              active
                                ? "bg-blue-600 pl-8 text-white shadow-[0_10px_24px_rgba(37,99,235,0.18)] lg:bg-blue-50 lg:pl-8 lg:text-slate-950 lg:shadow-none lg:ring-1 lg:ring-blue-100"
                                : "bg-slate-50 text-slate-600 hover:text-blue-600 lg:bg-transparent lg:hover:bg-slate-50"
                            }`}
                          >
                            {active ? <span className="pointer-events-none absolute bottom-3 left-3 top-3 z-10 w-[5px] rounded-full bg-[#2563EB] shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" aria-hidden="true" /> : null}
                            <span className={`block text-[11px] font-semibold ${active ? "text-[--color-bg-primary]/70 lg:text-[--color-brand]" : "text-[--color-text-muted]"}`}>{section.eyebrow}</span>
                            <span className="mt-0.5 block truncate text-sm font-semibold lg:mt-1 lg:truncate-none lg:pl-2">{section.title}</span>
                            <span className="mt-1 hidden text-xs leading-5 text-[--color-text-muted] lg:block">{section.description}</span>
                            <span className="mt-2 hidden text-[11px] text-[--color-text-muted] lg:block">
                              <span>v{section.version} · {section.value.trim().length || 0} 字</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </aside>

                  <section className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.045)]">
                    <div className="px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[--color-brand]">{activePersona.eyebrow}</p>
                          <h3 className="mt-1 text-lg font-semibold text-[--color-text-primary]">{activePersona.title}</h3>
                          <p className="mt-1 text-sm text-[--color-text-muted]">{activePersona.description}</p>
                        </div>
                        <div className="rounded-full bg-[--color-bg-hover] px-3 py-1.5 text-right">
                          <p className="text-[11px] text-[--color-text-muted]">当前版本</p>
                          <p className="text-xs font-semibold text-[--color-text-primary]">v{activePersona.version}</p>
                        </div>
                      </div>
                    </div>

                    <Textarea
                      wrap="soft"
                      rows={18}
                      value={activePersona.value}
                      onChange={e => activePersona.setValue(e.target.value)}
                      placeholder={activePersona.placeholder}
                      style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                      className="min-h-[420px] w-full max-w-full flex-1 resize-none overflow-x-hidden whitespace-pre-wrap rounded-none border-0 bg-[#f8fbff] px-4 py-4 text-sm leading-6 shadow-none [overflow-wrap:anywhere] [word-break:break-word] focus-visible:ring-0 focus-visible:ring-offset-0 sm:px-5"
                    />

                    <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
                      <p className="text-xs text-[--color-text-muted]">
                        当前分区 {activePersona.value.trim().length || 0} 字；保存会写入所有分区。
                      </p>
                      <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
                        <Button variant="outline" onClick={restoreDefaults} loading={savingPersona} loadingText="恢复中..." className="flex-1 rounded-full px-6 shadow-none text-xs sm:flex-none">
                          恢复默认模板
                        </Button>
                        <Button onClick={saveProfile} disabled={!hasPersonaChanges} loading={savingPersona} loadingText="保存中..." className="flex-1 rounded-full px-6 shadow-none sm:flex-none">
                          保存人格配置
                        </Button>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ 长期记忆 ═══ */}
      {tab === "memory" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input placeholder="搜索记忆..." value={factSearch} onChange={e => setFactSearch(e.target.value)} className="h-11 w-full rounded-full border-slate-200 bg-white text-sm shadow-none sm:max-w-[260px]" />
            <select value={factCategory} onChange={e => setFactCategory(e.target.value)} className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-none">
              <option value="">全部分类</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            <Button size="sm" onClick={() => setShowNewFact(!showNewFact)} className="ml-auto rounded-full shadow-none">
              + 新增记忆
            </Button>
          </div>

          {showNewFact && (
            <div className="space-y-3 rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <div className="grid grid-cols-2 gap-3">
                <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] px-3 py-2 text-sm shadow-none">
                  {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
                <select value={newImportance} onChange={e => setNewImportance(e.target.value)} className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] px-3 py-2 text-sm shadow-none">
                  {Object.entries(IMPORTANCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}重要度</option>)}
                </select>
              </div>
              <Input placeholder="标题" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="rounded-[--radius-md] bg-[--color-bg-surface] text-sm shadow-none" />
              <Textarea rows={3} placeholder="记忆内容" value={newContent} onChange={e => setNewContent(e.target.value)} className="min-h-[80px] rounded-[--radius-md] bg-[--color-bg-surface] text-sm" />
              <Input placeholder="标签（用逗号分隔）" value={newTags} onChange={e => setNewTags(e.target.value)} className="rounded-[--radius-md] bg-[--color-bg-surface] text-sm shadow-none" />
              <div className="flex gap-2">
                <Button size="sm" onClick={createFact} loading={savingMemory} loadingText="保存中..." className="rounded-full shadow-none">保存</Button>
                <Button size="sm" variant="outline" onClick={() => setShowNewFact(false)} className="rounded-full shadow-none text-xs">取消</Button>
              </div>
            </div>
          )}

          {/* Edit dialog */}
          <Dialog open={Boolean(editingFact)} onOpenChange={(open) => { if (!open) setEditingFact(null) }}>
            <DialogContent className="max-w-lg gap-0 p-0">
              <div className="p-5">
                <h3 className="mb-4 text-base font-semibold text-[--color-text-primary]">编辑记忆</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] px-3 py-2 text-sm shadow-none">
                      {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                    </select>
                    <select value={editImportance} onChange={e => setEditImportance(e.target.value)} className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] px-3 py-2 text-sm shadow-none">
                      {Object.entries(IMPORTANCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}重要度</option>)}
                    </select>
                  </div>
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="rounded-[--radius-md] bg-[--color-bg-surface] text-sm shadow-none" />
                  <Textarea rows={4} value={editContent} onChange={e => setEditContent(e.target.value)} className="min-h-[100px] rounded-[--radius-md] bg-[--color-bg-surface] text-sm" />
                  <Input value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="标签（逗号分隔）" className="rounded-[--radius-md] bg-[--color-bg-surface] text-sm shadow-none" />
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={saveEdit} loading={savingMemory} loadingText="保存中..." className="rounded-full shadow-none">保存</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingFact(null)} className="rounded-full shadow-none text-xs">取消</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {factsLoading ? (
            <SoulwingStackLoading rows={5} />
          ) : facts.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-[0_10px_24px_rgba(15,23,42,0.025)]">
              <p className="text-sm text-[--color-text-muted]">蝶灵还没有长期记忆。</p>
              <p className="mt-1 text-xs text-[--color-text-muted]/70">你可以在聊天中说&ldquo;记住&hellip;&hellip;&rdquo;，也可以手动新增一条。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {facts.map(fact => (
                <div key={fact.id} className="rounded-[18px] border border-slate-100 bg-white px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.025)] transition-colors hover:border-blue-100 hover:bg-blue-50/30">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-[--color-text-primary]">{fact.title}</span>
                        <span className="rounded-full bg-[--color-bg-hover] px-2 py-0.5 text-[11px] text-[--color-text-muted]">{CATEGORY_LABELS[fact.category] ?? fact.category}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${fact.importance === "high" ? "bg-[--color-warning-bg] text-[--color-warning]" : fact.importance === "medium" ? "bg-[--color-brand-soft] text-[--color-brand]" : "bg-[--color-bg-hover] text-[--color-text-muted]"}`}>{IMPORTANCE_LABELS[fact.importance] ?? fact.importance}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-[--color-text-secondary]">{fact.content}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[--color-text-muted]">
                        {(fact.tags ?? []).map(t => <span key={t} className="rounded-full bg-[--color-bg-hover] px-2 py-0.5">#{t}</span>)}
                        <span>{formatDate(fact.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 rounded-full px-3 text-xs shadow-none" onClick={() => startEdit(fact)}>编辑</Button>
                      <Button size="sm" variant="ghost" className="h-7 rounded-full px-3 text-xs text-red-600 shadow-none hover:text-red-700" onClick={() => forgetFact(fact)} loading={savingMemory} loadingText="忘记中...">忘记</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ 自动记忆日志 ═══ */}
      {tab === "logs" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <TabButton active={logTab === "events"} onClick={() => setLogTab("events")}>对话摘要</TabButton>
            <TabButton active={logTab === "tools"} onClick={() => setLogTab("tools")}>工具操作</TabButton>
          </div>

          {logsLoading ? <SoulwingStackLoading rows={5} /> : (
            <>
              {logTab === "events" && (
                events.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-[0_10px_24px_rgba(15,23,42,0.025)]">
                    <p className="text-sm text-[--color-text-muted]">暂无对话摘要。</p>
                    <p className="mt-1 text-xs text-[--color-text-muted]/70">每次蝶灵对话完成后会自动生成对话摘要。</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {events.map(e => (
                      <div key={e.id} className="rounded-[18px] border border-slate-100 bg-white px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.025)]">
                        <p className="text-sm font-medium text-[--color-text-primary] line-clamp-1">{e.topicSummary}</p>
                        {e.keyTakeaways ? <p className="mt-1 line-clamp-2 text-xs text-[--color-text-secondary]">{e.keyTakeaways}</p> : null}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[--color-text-muted]">
                          {(e.keywords as string[] ?? []).map(k => <span key={k} className="rounded-full bg-[--color-bg-hover] px-2 py-0.5">#{k}</span>)}
                          {(e.relatedModules as string[] ?? []).map(m => <span key={m} className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">{m}</span>)}
                          <span className="ml-auto">{formatDate(e.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
              {logTab === "tools" && (
                toolEvents.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-[0_10px_24px_rgba(15,23,42,0.025)]">
                    <p className="text-sm text-[--color-text-muted]">暂无工具操作记录。</p>
                    <p className="mt-1 text-xs text-[--color-text-muted]/70">当蝶灵通过工具创建或修改内容时，操作记录会自动保存。</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {toolEvents.map(t => (
                      <div key={t.id} className="rounded-[18px] border border-slate-100 bg-white px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.025)]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">{ACTION_LABELS[t.action] ?? t.action}</span>
                          {t.module ? <span className="text-xs text-[--color-text-muted]">{t.module}</span> : null}
                          {t.title ? <span className="text-sm font-medium text-[--color-text-primary]">{t.title}</span> : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[--color-text-muted]">
                          <span className="text-[--color-text-muted]/60 font-mono">{t.action}</span>
                          {t.changedFields && (t.changedFields as string[]).length > 0 ? <span>修改：{(t.changedFields as string[]).join("、")}</span> : null}
                          {t.slugChanged ? <span className="text-[--color-warning]">slug 已更新</span> : null}
                          {t.sourceModule ? <span>{t.sourceModule} → {t.targetModule}</span> : null}
                          <span className="ml-auto">{formatDate(t.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ 隐私与开关 ═══ */}
      {tab === "privacy" && (
        <div className="space-y-2">
          {settingsLoading ? <SoulwingToggleLoading /> : settings ? (
            <>
              <Toggle label="启用长期记忆" description="关闭后蝶灵不会写入新的长期记忆。已有记忆仍保留。" value={settings.enableLongTermMemory} onChange={v => toggleSetting("enableLongTermMemory", v)} warning={!settings.enableLongTermMemory ? "当前已关闭：蝶灵不会继续写入新记忆。" : undefined} />
              <Toggle label="启用蝶灵人格上下文" description="关闭后蝶灵将使用最简默认身份回复，不加载你的专属人格配置。" value={settings.enablePersonaContext} onChange={v => toggleSetting("enablePersonaContext", v)} />
              <Toggle label="保存对话摘要" description="每次蝶灵对话完成后，自动生成对话摘要并保存。" value={settings.enableConversationArchive} onChange={v => toggleSetting("enableConversationArchive", v)} />
              <Toggle label="保存工具操作记忆" description="蝶灵通过工具创建文章、修改内容时，自动记录操作摘要。" value={settings.enableToolMemoryEvents} onChange={v => toggleSetting("enableToolMemoryEvents", v)} />
              <Toggle label="允许蝶灵召回记忆" description="关闭后蝶灵在回答前不会主动查找历史记忆。" value={settings.enableMemoryRecall} onChange={v => toggleSetting("enableMemoryRecall", v)} warning={!settings.enableMemoryRecall ? "当前已关闭：蝶灵不会在回答前召回旧记忆。" : undefined} />
              <Toggle label="允许蝶灵主动使用记忆工具" description="关闭后蝶灵无法通过对话主动保存、搜索或忘记记忆。AI 工具返回 skipped。" value={settings.enableMemoryTools} onChange={v => toggleSetting("enableMemoryTools", v)} warning={!settings.enableMemoryTools ? "当前已关闭：蝶灵无法通过对话主动保存/搜索/忘记记忆。" : undefined} />
              <Toggle label="保存完整对话原文" description="开启后存储完整对话记录。当前版本暂未启用完整原文保存，开启后对话摘要仍会保存。" value={settings.storeFullConversations} onChange={v => toggleSetting("storeFullConversations", v)} warning={settings.storeFullConversations ? "注意：当前版本暂未实现完整原文保存功能。" : undefined} />
              <Toggle label="自动标记敏感内容" description="蝶灵会自动标记可能包含敏感信息的记忆。" value={settings.autoTagSensitiveContent} onChange={v => toggleSetting("autoTagSensitiveContent", v)} />
              <Toggle label="保存记忆前需要确认" description="开启后蝶灵在保存新记忆前会先请求你的确认。" value={settings.requireConfirmBeforeSave} onChange={v => toggleSetting("requireConfirmBeforeSave", v)} />
            </>
          ) : null}
        </div>
      )}

      {/* ═══ 自动回复 ═══ */}
      {tab === "auto_reply" && (
        <div className="space-y-5">
          {/* Feature gate banner */}
          {!autoReplyFeatureEnabled && (
            <div className="rounded-[18px] border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <p className="font-medium">自动回复功能尚未开放</p>
              <p className="mt-1 text-xs">你可以提前查看和配置设置，正式开放后将按照你的配置生效。此期间即使设置了开关也不会自动发送任何消息。</p>
            </div>
          )}

          {autoReplyLoading ? (
            <SoulwingStackLoading rows={3} />
          ) : autoReplySettings.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-[0_10px_24px_rgba(15,23,42,0.025)]">
              <p className="text-sm text-[--color-text-muted]">尚未创建自动回复配置。</p>
              <p className="mt-1 text-xs text-[--color-text-muted]/70">创建后可设置回复方式、冷却时间和每日上限。</p>
              <Button size="sm" onClick={createGlobalSetting} disabled={savingAutoReply} className="mt-4 rounded-full shadow-none">
                {savingAutoReply ? "创建中..." : "创建默认配置"}
              </Button>
            </div>
          ) : autoReplySettings.map(s => (
            <div key={s.id} className="space-y-4 rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              {/* Enable toggle */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[--color-text-primary]">启用自动回复</p>
                  <p className="mt-0.5 text-xs text-[--color-text-muted]">开启后蝶灵会在你不在线时帮你回复消息。</p>
                  {s.enabled && <p className="mt-1 text-xs text-amber-600">当前已开启：蝶灵会以你的身份发送消息，对方可能无法区分。</p>}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.enabled}
                  disabled={savingAutoReply}
                  onClick={() => patchAutoReplySetting(s.id, { enabled: !s.enabled })}
                  className={`mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full border-2 transition-colors disabled:opacity-50 ${
                    s.enabled ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-gray-200"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${s.enabled ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>

              {/* Reply mode */}
              <div>
                <label className="mb-1 block text-xs font-medium text-[--color-text-secondary]">回复方式</label>
                <select
                  value={s.replyMode}
                  onChange={e => patchAutoReplySetting(s.id, { replyMode: e.target.value })}
                  className="w-full rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] px-3 py-2 text-sm shadow-none"
                >
                  <option value="away_notice">不在通知（固定安全文案）</option>
                  <option value="template">自定义模板</option>
                  <option value="hybrid">混合（蝶灵结合语境简短回应）</option>
                  <option value="semantic">语义（蝶灵理解聊天后回复）</option>
                </select>
                <p className="mt-1 text-[11px] text-[--color-text-muted]">
                  {s.replyMode === "away_notice" && "使用固定安全文案，不会出现意外内容。推荐首次使用。"}
                  {s.replyMode === "template" && "使用你设定的模板发送，可包含个人风格。"}
                  {s.replyMode === "hybrid" && "蝶灵读取最近消息，生成一句简短回应，并说明你暂时不在。"}
                  {s.replyMode === "semantic" && "蝶灵理解聊天内容，生成语境自然的回复。存在内容不确定性，请谨慎开启。"}
                </p>
              </div>

              {s.replyMode === "template" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-[--color-text-secondary]">模板内容</label>
                  <Textarea
                    defaultValue={s.templateText ?? ""}
                    rows={2}
                    placeholder="例如：我现在在忙，稍后回复你。"
                    className="min-h-[60px] resize-none rounded-[--radius-md] bg-[--color-bg-surface] text-sm shadow-none"
                    onBlur={e => {
                      const val = e.target.value.trim()
                      if (val !== (s.templateText ?? "")) patchAutoReplySetting(s.id, { templateText: val || null })
                    }}
                  />
                </div>
              )}

              {(s.replyMode === "hybrid" || s.replyMode === "semantic") && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-[--color-text-secondary]">自定义要求（可选）</label>
                  <Textarea
                    defaultValue={s.customInstruction ?? ""}
                    rows={2}
                    placeholder="例如：保持简短、不要用敬语……"
                    className="min-h-[60px] resize-none rounded-[--radius-md] bg-[--color-bg-surface] text-sm shadow-none"
                    onBlur={e => {
                      const val = e.target.value.trim()
                      if (val !== (s.customInstruction ?? "")) patchAutoReplySetting(s.id, { customInstruction: val || null })
                    }}
                  />
                </div>
              )}

              {/* Disclose */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[--color-text-primary]">在消息中标注是自动回复</p>
                  <p className="mt-0.5 text-xs text-[--color-text-muted]">关闭后消息不会有任何标注，对方无法知道这是蝶灵发的。不建议关闭。</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.discloseAsAutoReply}
                  disabled={savingAutoReply}
                  onClick={() => patchAutoReplySetting(s.id, { discloseAsAutoReply: !s.discloseAsAutoReply })}
                  className={`mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full border-2 transition-colors disabled:opacity-50 ${
                    s.discloseAsAutoReply ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-gray-200"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${s.discloseAsAutoReply ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>

              {/* Group reply */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[--color-text-primary]">允许群聊自动回复</p>
                  <p className="mt-0.5 text-xs text-[--color-text-muted]">开启后蝶灵也会在群聊中代你发言。请注意可能影响群聊体验。</p>
                  {s.allowGroupReply && <p className="mt-1 text-xs text-red-600">注意：群聊中的自动回复所有成员都能看到。</p>}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.allowGroupReply}
                  disabled={savingAutoReply}
                  onClick={() => {
                    if (!s.allowGroupReply && !confirm("确定要开启群聊自动回复吗？蝶灵将以你的身份在群聊中发言，所有成员都可以看到。")) return
                    void patchAutoReplySetting(s.id, { allowGroupReply: !s.allowGroupReply })
                  }}
                  className={`mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full border-2 transition-colors disabled:opacity-50 ${
                    s.allowGroupReply ? "border-red-400 bg-red-400" : "border-gray-300 bg-gray-200"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${s.allowGroupReply ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>

              {/* Cooldown */}
              <div>
                <label className="mb-1 block text-xs font-medium text-[--color-text-secondary]">
                  冷却时间：{s.cooldownMinutes} 分钟
                </label>
                <input
                  type="range"
                  min={5} max={480} step={5}
                  value={s.cooldownMinutes}
                  onChange={e => setAutoReplySettings(prev => prev.map(r => r.id === s.id ? { ...r, cooldownMinutes: Number(e.target.value) } : r))}
                  onMouseUp={e => void patchAutoReplySetting(s.id, { cooldownMinutes: Number((e.target as HTMLInputElement).value) })}
                  onTouchEnd={e => void patchAutoReplySetting(s.id, { cooldownMinutes: Number((e.target as HTMLInputElement).value) })}
                  className="w-full accent-blue-500"
                />
                <p className="mt-1 text-[11px] text-[--color-text-muted]">同一对话在冷却期内只回复一次。</p>
              </div>

              {/* Daily limit */}
              <div>
                <label className="mb-1 block text-xs font-medium text-[--color-text-secondary]">
                  每日上限：{s.maxRepliesPerDay} 条
                </label>
                <input
                  type="range"
                  min={1} max={100} step={1}
                  value={s.maxRepliesPerDay}
                  onChange={e => setAutoReplySettings(prev => prev.map(r => r.id === s.id ? { ...r, maxRepliesPerDay: Number(e.target.value) } : r))}
                  onMouseUp={e => void patchAutoReplySetting(s.id, { maxRepliesPerDay: Number((e.target as HTMLInputElement).value) })}
                  onTouchEnd={e => void patchAutoReplySetting(s.id, { maxRepliesPerDay: Number((e.target as HTMLInputElement).value) })}
                  className="w-full accent-blue-500"
                />
                <p className="mt-1 text-[11px] text-[--color-text-muted]">每天最多自动发送的消息总数。</p>
              </div>
            </div>
          ))}

          {/* Recent logs */}
          {autoReplyLogs.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-[--color-text-primary]">最近自动回复记录</p>
              <div className="space-y-2">
                {autoReplyLogs.map(log => (
                  <div key={log.id} className="rounded-[16px] border border-slate-100 bg-white px-4 py-2.5 shadow-[0_8px_20px_rgba(15,23,42,0.025)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[--color-bg-hover] px-2 py-0.5 text-[11px] text-[--color-text-muted]">
                        {log.chatType === "direct" ? "单聊" : "群聊"}
                      </span>
                      <span className="text-xs text-[--color-text-muted]">{formatDate(log.createdAt)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-[--color-text-secondary]">{log.replyText}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
