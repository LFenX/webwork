"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent } from "@/components/ui/dialog"

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
      className={`rounded-full px-3 py-2 text-[13px] sm:px-4 sm:text-sm font-medium transition-colors whitespace-nowrap ${
        active
          ? "bg-[--color-brand] text-white shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.12)]"
          : "bg-[--color-bg-hover] text-[--color-text-secondary] hover:text-[--color-text-primary]"
      }`}
    >
      {children}
    </button>
  )
}

function Toggle({ label, description, value, onChange, warning }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void; warning?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[--radius-md] bg-[--color-bg-surface]/50 px-4 py-3">
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

export function SoulWingSettingsClient() {
  const [tab, setTab] = useState<"persona" | "memory" | "logs" | "privacy" | "auto_reply">("persona")

  // ── Persona state ──
  const [profile, setProfile] = useState<AgentProfileData | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [soul, setSoul] = useState("")
  const [identity, setIdentity] = useState("")
  const [userCtx, setUserCtx] = useState("")
  const [rules, setRules] = useState("")
  const [savingPersona, setSavingPersona] = useState(false)

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

  const restoreDefaults = async () => {
    if (!confirm("确定要恢复默认蝶灵模板吗？当前的自定义内容将替换为原始默认值。")) return
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
  }

  const forgetFact = async (fact: MemoryFactItem) => {
    if (!confirm(`确定要忘记这条记忆吗？\n\n"${fact.title}"\n\n忘记后不会硬删除，但默认不再展示。`)) return
    try {
      const res = await fetch(`/api/ai/memory/${fact.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      toast.success("已忘记这条记忆")
      await loadFacts(factSearch, factCategory)
    } catch { toast.error("忘记记忆失败") }
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
  }, [])

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
    <div>
      {/* Tabs */}
      <div className="mb-6 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
        <TabButton active={tab === "persona"} onClick={() => setTab("persona")}>人格设置</TabButton>
        <TabButton active={tab === "memory"} onClick={() => setTab("memory")}>长期记忆</TabButton>
        <TabButton active={tab === "logs"} onClick={() => setTab("logs")}>自动记忆日志</TabButton>
        <TabButton active={tab === "privacy"} onClick={() => setTab("privacy")}>隐私与开关</TabButton>
        <TabButton active={tab === "auto_reply"} onClick={() => setTab("auto_reply")}>自动回复</TabButton>
      </div>

      {/* ═══ 人格设置 ═══ */}
      {tab === "persona" && (
        <div className="space-y-5">
          {profileLoading ? <p className="text-sm text-[--color-text-muted]">加载中...</p> : (
            <>
              {!profile?.enabled ? (
                <div className="rounded-[--radius-lg] bg-[--color-warning-bg] px-4 py-3 text-sm text-[--color-warning]">
                  当前已关闭用户专属人格上下文。蝶灵将使用最简默认身份回复。
                </div>
              ) : null}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[--color-text-primary]">IDENTITY — 蝶灵是谁</label>
                <p className="mb-2 text-xs text-[--color-text-muted]">定义蝶灵的身份、定位和与你的关系。</p>
                <Textarea rows={4} value={identity} onChange={e => setIdentity(e.target.value)} className="min-h-[100px] resize-y rounded-[--radius-md] bg-[--color-bg-surface] text-sm" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[--color-text-primary]">SOUL — 蝶灵的性格与表达方式</label>
                <p className="mb-2 text-xs text-[--color-text-muted]">定义蝶灵怎么说话、怎么思考、怎么做事。</p>
                <Textarea rows={5} value={soul} onChange={e => setSoul(e.target.value)} className="min-h-[120px] resize-y rounded-[--radius-md] bg-[--color-bg-surface] text-sm" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[--color-text-primary]">USER — 蝶灵认识的你</label>
                <p className="mb-2 text-xs text-[--color-text-muted]">告诉蝶灵关于你的背景、偏好、项目和长期目标。</p>
                <Textarea rows={5} value={userCtx} onChange={e => setUserCtx(e.target.value)} className="min-h-[120px] resize-y rounded-[--radius-md] bg-[--color-bg-surface] text-sm" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[--color-text-primary]">RULES — 蝶灵的行为边界</label>
                <p className="mb-2 text-xs text-[--color-text-muted]">你为蝶灵设定的行为规则。注意：平台级安全规则始终优先，此处规则不能覆盖。</p>
                <Textarea rows={5} value={rules} onChange={e => setRules(e.target.value)} className="min-h-[120px] resize-y rounded-[--radius-md] bg-[--color-bg-surface] text-sm" />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={saveProfile} disabled={savingPersona} className="rounded-full px-6 shadow-none">
                  {savingPersona ? "保存中..." : "保存人格配置"}
                </Button>
                <Button variant="outline" onClick={restoreDefaults} className="rounded-full px-6 shadow-none text-xs">
                  恢复默认模板
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ 长期记忆 ═══ */}
      {tab === "memory" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input placeholder="搜索记忆..." value={factSearch} onChange={e => setFactSearch(e.target.value)} className="w-full sm:max-w-[240px] rounded-full bg-[--color-bg-surface] text-sm shadow-none" />
            <select value={factCategory} onChange={e => setFactCategory(e.target.value)} className="rounded-full border border-[--color-border] bg-[--color-bg-surface] px-3 py-1.5 text-sm text-[--color-text-primary] shadow-none">
              <option value="">全部分类</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            <Button size="sm" onClick={() => setShowNewFact(!showNewFact)} className="ml-auto rounded-full shadow-none">
              + 新增记忆
            </Button>
          </div>

          {showNewFact && (
            <div className="space-y-3 rounded-[--radius-lg] bg-[--color-bg-surface]/60 p-4">
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
                <Button size="sm" onClick={createFact} className="rounded-full shadow-none">保存</Button>
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
                  <Button size="sm" onClick={saveEdit} className="rounded-full shadow-none">保存</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingFact(null)} className="rounded-full shadow-none text-xs">取消</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {factsLoading ? (
            <p className="py-8 text-center text-sm text-[--color-text-muted]">加载中...</p>
          ) : facts.length === 0 ? (
            <div className="rounded-[--radius-lg] bg-[--color-bg-surface]/40 px-6 py-10 text-center">
              <p className="text-sm text-[--color-text-muted]">蝶灵还没有长期记忆。</p>
              <p className="mt-1 text-xs text-[--color-text-muted]/70">你可以在聊天中说&ldquo;记住&hellip;&hellip;&rdquo;，也可以手动新增一条。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {facts.map(fact => (
                <div key={fact.id} className="rounded-[--radius-lg] bg-[--color-bg-surface]/60 px-4 py-3 transition-colors hover:bg-[--color-bg-surface]/80">
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
                      <Button size="sm" variant="ghost" className="h-7 rounded-full px-3 text-xs text-red-600 shadow-none hover:text-red-700" onClick={() => forgetFact(fact)}>忘记</Button>
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

          {logsLoading ? <p className="py-8 text-center text-sm text-[--color-text-muted]">加载中...</p> : (
            <>
              {logTab === "events" && (
                events.length === 0 ? (
                  <div className="rounded-[--radius-lg] bg-[--color-bg-surface]/40 px-6 py-10 text-center">
                    <p className="text-sm text-[--color-text-muted]">暂无对话摘要。</p>
                    <p className="mt-1 text-xs text-[--color-text-muted]/70">每次蝶灵对话完成后会自动生成对话摘要。</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {events.map(e => (
                      <div key={e.id} className="rounded-[--radius-lg] bg-[--color-bg-surface]/60 px-4 py-3">
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
                  <div className="rounded-[--radius-lg] bg-[--color-bg-surface]/40 px-6 py-10 text-center">
                    <p className="text-sm text-[--color-text-muted]">暂无工具操作记录。</p>
                    <p className="mt-1 text-xs text-[--color-text-muted]/70">当蝶灵通过工具创建或修改内容时，操作记录会自动保存。</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {toolEvents.map(t => (
                      <div key={t.id} className="rounded-[--radius-lg] bg-[--color-bg-surface]/60 px-4 py-3">
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
          {settingsLoading ? <p className="text-sm text-[--color-text-muted]">加载中...</p> : settings ? (
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
            <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-warning-bg] px-4 py-3 text-sm text-[--color-warning]">
              <p className="font-medium">自动回复功能尚未开放</p>
              <p className="mt-1 text-xs">你可以提前查看和配置设置，正式开放后将按照你的配置生效。此期间即使设置了开关也不会自动发送任何消息。</p>
            </div>
          )}

          {autoReplyLoading ? (
            <p className="py-8 text-center text-sm text-[--color-text-muted]">加载中...</p>
          ) : autoReplySettings.length === 0 ? (
            <div className="rounded-[--radius-lg] bg-[--color-bg-surface]/40 px-6 py-10 text-center">
              <p className="text-sm text-[--color-text-muted]">尚未创建自动回复配置。</p>
              <p className="mt-1 text-xs text-[--color-text-muted]/70">创建后可设置回复方式、冷却时间和每日上限。</p>
              <Button size="sm" onClick={createGlobalSetting} disabled={savingAutoReply} className="mt-4 rounded-full shadow-none">
                {savingAutoReply ? "创建中..." : "创建默认配置"}
              </Button>
            </div>
          ) : autoReplySettings.map(s => (
            <div key={s.id} className="space-y-4 rounded-[--radius-lg] bg-[--color-bg-surface]/60 p-4">
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
                  <div key={log.id} className="rounded-[--radius-md] bg-[--color-bg-surface]/60 px-4 py-2.5">
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
