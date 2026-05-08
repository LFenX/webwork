"use client"

import { useMemo, useState } from "react"
import {
  Bot,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  Database,
  DatabaseZap,
  EyeOff,
  Folder,
  FolderOpen,
  Hash,
  Info,
  Key,
  KeyRound,
  Lock,
  MessageSquare,
  Plus,
  Search,
  Shield,
  Sparkles,
  Table2,
  UploadCloud,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { SqlSchema, SqlTableInfo } from "@/lib/sql-lab/types"
import { cn } from "@/lib/utils"
import { apiPost } from "@/lib/api-client"

type Props = {
  schema: SqlSchema | null
  onInsertTable?: (qualifiedName: string) => void
  onInsertColumn?: (qualifiedName: string) => void
  onSelectTable?: (qualifiedName: string) => void
  onSchemaChanged?: () => void
}

type ModuleIcon =
  | "content"
  | "ai"
  | "social"
  | "career"
  | "admin"
  | "community"
  | "sql"
  | "private"
  | "system"
  | "announcement"
  | "media"
  | "memory"

type SubmoduleDef = {
  id: string
  name: string
  description: string
  matches: (table: string) => boolean
}

type ModuleDef = {
  id: string
  name: string
  icon: ModuleIcon
  description: string
  submodules: SubmoduleDef[]
}

type TableWithMeta = {
  table: SqlTableInfo
  module: ModuleDef
  submodule: SubmoduleDef
}

type ModuleGroup = {
  module: ModuleDef
  submodules: Map<string, { submodule: SubmoduleDef; tables: TableWithMeta[] }>
}

const PUBLIC_MODULES: ModuleDef[] = [
  {
    id: "content",
    name: "内容与知识库",
    icon: "content",
    description: "文章、日记、笔记、评论、栏目可见性等内容生产数据。",
    submodules: [
      { id: "articles", name: "文章 / 笔记 / 日记", description: "站内主要内容条目与编辑工作区。", matches: (t) => ["Post", "ArticleFolder"].includes(t) },
      { id: "interaction", name: "评论与可见性", description: "评论、留言、模块可见性与阅读状态。", matches: (t) => ["Comment", "GuestbookMessage", "ModuleVisibility", "AnnouncementView", "WorldBroadcastView"].includes(t) },
      { id: "updates", name: "更新与活动", description: "用户活动、最近阅读、更新日志等行为记录。", matches: (t) => ["UserActivity", "RecentActivityRead", "UpdateLog"].includes(t) },
    ],
  },
  {
    id: "ai",
    name: "AI 助手",
    icon: "ai",
    description: "AI 会话、配置、运行、用量、记忆、自动回复和圆桌讨论。",
    submodules: [
      { id: "assistant", name: "会话与运行", description: "AI 对话、消息、附件、运行步骤和工具调用。", matches: (t) => /^AI(Conversation|Message|Run|ToolCallLog)/.test(t) },
      { id: "settings", name: "配置与授权", description: "模型配置、访问申请、用量授权和 Web Search 配置。", matches: (t) => /^AI(AccessRequest|UsageGrant|UsageLog|UserProviderConfig|WebSearch)/.test(t) },
      { id: "memory", name: "长期记忆", description: "记忆事实、记忆事件、记忆工具事件和用户记忆设置。", matches: (t) => /^Memory/.test(t) },
      { id: "agents", name: "角色与自动回复", description: "智能体画像、自动回复配置和日志。", matches: (t) => /^AgentProfile|^AutoReply/.test(t) },
      { id: "roundtable", name: "圆桌讨论", description: "SoulWing 圆桌设置、议题、参与者和消息。", matches: (t) => /^SoulWingRoundtable/.test(t) },
    ],
  },
  {
    id: "social",
    name: "社交与消息",
    icon: "social",
    description: "好友、私聊、群聊、频道、公告、广播与表情系统。",
    submodules: [
      { id: "friends", name: "好友关系", description: "好友申请和好友关系。", matches: (t) => ["FriendRequest", "Friendship"].includes(t) },
      { id: "private-chat", name: "私聊", description: "一对一聊天消息和附件。", matches: (t) => /^Chat(Message|Attachment)$/.test(t) },
      { id: "channels", name: "频道 / 群聊", description: "频道、成员、频道消息和附件。", matches: (t) => /^ChatChannel|^Channel/.test(t) },
      { id: "broadcast", name: "公告与广播", description: "站内公告、世界广播及阅读状态。", matches: (t) => /^Announcement|^WorldBroadcast/.test(t) },
      { id: "stickers", name: "表情资源", description: "表情素材、分组和分组条目。", matches: (t) => /^Sticker/.test(t) },
    ],
  },
  {
    id: "career",
    name: "简历与求职",
    icon: "career",
    description: "简历编辑、模板、版本、岗位申请和面试记录。",
    submodules: [
      { id: "resume", name: "简历", description: "简历主体、版本、渲染结果和模板配置。", matches: (t) => /^Resume/.test(t) },
      { id: "jobs", name: "岗位申请", description: "求职岗位、投递进度和面试记录。", matches: (t) => /^Job|^Interview/.test(t) },
    ],
  },
  {
    id: "admin",
    name: "账号与管理",
    icon: "admin",
    description: "用户、登录会话、注册审核、密码修改和管理员权限。",
    submodules: [
      { id: "users", name: "用户账号", description: "用户基础信息、会话和个人设置。", matches: (t) => ["User", "UserSession", "SiteSettings"].includes(t) },
      { id: "review", name: "审核流程", description: "注册申请和密码修改申请。", matches: (t) => ["RegistrationRequest", "PasswordChangeRequest"].includes(t) },
      { id: "permissions", name: "管理员权限", description: "管理员功能授权。", matches: (t) => ["AdminPermission"].includes(t) },
    ],
  },
  {
    id: "community",
    name: "社区与资源",
    icon: "community",
    description: "网址资源、首页布局、访问日志、文件上传等共享资源。",
    submodules: [
      { id: "websites", name: "网站资源", description: "社区网站收藏、文件夹和访问记录。", matches: (t) => /^Website/.test(t) },
      { id: "uploads", name: "上传文件", description: "用户上传文件和上传关联。", matches: (t) => /^Upload/.test(t) },
      { id: "layout", name: "首页布局", description: "用户自定义首页布局和访问记录。", matches: (t) => ["HomeLayout", "VisitLog"].includes(t) },
    ],
  },
  {
    id: "sql",
    name: "SQL 实验室",
    icon: "sql",
    description: "SQL Lab 的访问授权、收藏查询和执行审计。",
    submodules: [
      { id: "access", name: "访问授权", description: "用户级 SQL Lab 授权和表级授权。", matches: (t) => /^SqlAccess/.test(t) },
      { id: "queries", name: "查询与审计", description: "收藏 SQL 和执行审计日志。", matches: (t) => /^Sql(Saved|Audit)/.test(t) },
    ],
  },
  {
    id: "system",
    name: "其他系统表",
    icon: "system",
    description: "未归入业务模块的基础表或扩展表。",
    submodules: [{ id: "misc", name: "未分类", description: "暂未识别业务归属的表。", matches: () => true }],
  },
]

const PRIVATE_MODULE: ModuleDef = {
  id: "private",
  name: "Private",
  icon: "private",
  description: "当前用户独享的私人数据库空间。",
  submodules: [{ id: "uncategorized", name: "未分类", description: "未放入文件夹的私有表。", matches: () => false }],
}

const TABLE_DESCRIPTIONS: Record<string, string> = {
  User: "用户账号主表，保存登录邮箱、角色、展示名称、头像、个人简介等基础身份信息。",
  UserSession: "用户登录会话表，用于记录在线状态、设备信息、最近活跃时间和退出状态。",
  AdminPermission: "管理员细粒度权限表，用于控制普通管理员是否可以进入审核、AI、SQL Lab 等管理功能。",
  Post: "内容条目主表，通常承载博客、笔记、日记、反思等不同类型的文章内容。",
  ArticleFolder: "文章工作区文件夹表，用来组织内容模块里的栏目、目录或分组。",
  Comment: "评论表，保存用户对内容或资源的评论与回复关系。",
  UserActivity: "用户活动日志表，记录用户行为、设备、位置、会话和发生时间。",
  AIConversation: "AI 助手会话表，记录用户与 AI 的会话标题、归属用户和最近消息时间。",
  AIMessage: "AI 消息表，保存每轮用户/助手消息、运行状态、模型来源和工具轨迹摘要。",
  AIRun: "AI 运行表，记录一次 AI 生成任务的模式、模型、状态和完成时间。",
  MemoryFact: "长期记忆事实表，保存可被 AI 召回的用户偏好、资料和重要事实。",
  SqlAccessGrant: "SQL Lab 用户级授权表，控制用户是否启用 SQL Lab、默认 limit 和超时时间。",
  SqlAccessTableGrant: "SQL Lab 表级授权表，控制某个用户对具体表的读写权限、屏蔽列和行过滤规则。",
  SqlSavedQuery: "SQL Lab 收藏查询表，保存用户命名的 SQL、置顶状态和共享状态。",
  SqlAuditLog: "SQL Lab 执行审计表，记录每次查询的耗时、结果行数、涉及表、错误和请求来源。",
  Resume: "简历主体表，保存用户简历 JSON、渲染 HTML、模板和导出配置。",
  ResumeVersion: "简历版本表，用于保存历史版本和回滚/对比。",
  JobApplication: "岗位申请表，记录目标公司、岗位、阶段、状态和求职备注。",
  InterviewRecord: "面试记录表，记录面试安排、题目、反馈和结果。",
  FriendRequest: "好友申请表，保存申请人、接收人、备注和处理状态。",
  Friendship: "好友关系表，保存已经建立的双向好友关系。",
  ChatMessage: "私聊消息表，保存一对一聊天文本、表情、回复关系和已读状态。",
  ChatChannel: "频道/群聊主表，保存群聊名称、公告、创建者和类型。",
  ChannelMessage: "频道消息表，保存群聊消息内容、发送人、回复关系和表情。",
  Announcement: "站内公告表，保存管理员或频道同步产生的公告内容。",
  WebsiteResource: "社区网站资源表，保存用户分享的网站、说明、截图、标签和可见性。",
  WebsiteFolder: "网站资源文件夹表，用于对用户分享的网站进行分组。",
  Upload: "上传文件表，保存用户上传文件的原始名称、MIME、大小和访问地址。",
}

function moduleIcon(icon: ModuleIcon, className?: string) {
  const props = { size: 11, className }
  if (icon === "content") return <Folder {...props} />
  if (icon === "ai") return <Bot {...props} />
  if (icon === "social") return <MessageSquare {...props} />
  if (icon === "announcement") return <Info {...props} />
  if (icon === "media") return <UploadCloud {...props} />
  if (icon === "memory") return <Sparkles {...props} />
  if (icon === "career") return <BriefcaseBusiness {...props} />
  if (icon === "admin") return <Shield {...props} />
  if (icon === "community") return <Users {...props} />
  if (icon === "sql") return <Database {...props} />
  if (icon === "private") return <DatabaseZap {...props} />
  return <UploadCloud {...props} />
}

function moduleTone(icon: ModuleIcon) {
  if (icon === "content") return "bg-amber-50 text-amber-700 ring-amber-200"
  if (icon === "ai") return "bg-violet-50 text-violet-700 ring-violet-200"
  if (icon === "social") return "bg-sky-50 text-sky-700 ring-sky-200"
  if (icon === "announcement") return "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200"
  if (icon === "media") return "bg-lime-50 text-lime-700 ring-lime-200"
  if (icon === "memory") return "bg-teal-50 text-teal-700 ring-teal-200"
  if (icon === "career") return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  if (icon === "admin") return "bg-rose-50 text-rose-700 ring-rose-200"
  if (icon === "community") return "bg-orange-50 text-orange-700 ring-orange-200"
  if (icon === "sql") return "bg-indigo-50 text-indigo-700 ring-indigo-200"
  if (icon === "private") return "bg-cyan-50 text-cyan-700 ring-cyan-200"
  return "bg-slate-100 text-slate-700 ring-slate-200"
}

function tableTone(table: SqlTableInfo) {
  if (table.scope === "private") return "bg-cyan-50 text-cyan-700 ring-cyan-200"
  if (table.access === "write") return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  if (table.access === "read") return "bg-sky-50 text-sky-700 ring-sky-200"
  return "bg-slate-100 text-slate-500 ring-slate-200"
}

function accessChip(access: SqlTableInfo["access"]) {
  if (access === "write") return { dot: "bg-emerald-500", label: "RW", className: "text-emerald-700" }
  if (access === "read") return { dot: "bg-sky-500", label: "RO", className: "text-sky-700" }
  return { dot: "bg-zinc-300", label: "-", className: "text-zinc-400" }
}

function typeColor(type: string) {
  const t = type.toLowerCase()
  if (/(text|char|string|uuid)/.test(t)) return "text-sky-700 bg-sky-50"
  if (/(int|numeric|decimal|float|double|real|number)/.test(t)) return "text-violet-700 bg-violet-50"
  if (/(time|date)/.test(t)) return "text-emerald-700 bg-emerald-50"
  if (/(bool)/.test(t)) return "text-amber-700 bg-amber-50"
  if (/(json|jsonb|array)/.test(t)) return "text-rose-700 bg-rose-50"
  return "text-slate-600 bg-slate-100"
}

function shortType(type: string) {
  const t = type.toLowerCase()
  if (t === "character varying") return "varchar"
  if (t === "timestamp without time zone") return "timestamp"
  if (t === "timestamp with time zone") return "timestamptz"
  return t
}

function findPublicModule(tableName: string) {
  for (const mod of PUBLIC_MODULES) {
    for (const sub of mod.submodules) {
      if (sub.matches(tableName)) return { module: mod, submodule: sub }
    }
  }
  const fallback = PUBLIC_MODULES[PUBLIC_MODULES.length - 1]
  return { module: fallback, submodule: fallback.submodules[0] }
}

function catalogIcon(moduleId?: string): ModuleIcon {
  if (moduleId === "account") return "admin"
  if (moduleId === "content") return "content"
  if (moduleId === "social") return "social"
  if (moduleId === "announcement") return "announcement"
  if (moduleId === "media") return "media"
  if (moduleId === "career") return "career"
  if (moduleId === "ai") return "ai"
  if (moduleId === "memory") return "memory"
  if (moduleId === "roundtable") return "social"
  if (moduleId === "community") return "community"
  if (moduleId === "sql_lab") return "sql"
  if (moduleId === "private") return "private"
  return "system"
}

function moduleForTable(table: SqlTableInfo) {
  const catalog = table.catalog
  if (!catalog) return findPublicModule(table.name)
  const submodule: SubmoduleDef = {
    id: catalog.submoduleId,
    name: catalog.submoduleName,
    description: catalog.description,
    matches: () => false,
  }
  return {
    module: {
      id: catalog.moduleId,
      name: catalog.moduleName,
      icon: catalogIcon(catalog.moduleId),
      description: catalog.description,
      submodules: [submodule],
    } satisfies ModuleDef,
    submodule,
  }
}

const CATALOG_MODULE_ORDER = [
  "account",
  "content",
  "social",
  "announcement",
  "media",
  "career",
  "ai",
  "memory",
  "roundtable",
  "community",
  "sql_lab",
  "system",
]

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`
}

function insertTableName(table: SqlTableInfo) {
  if (table.scope === "private") return `${quoteIdentifier(table.schema)}.${quoteIdentifier(table.name)}`
  return quoteIdentifier(table.name)
}

function buildTableDescription(meta: TableWithMeta) {
  if (meta.table.catalog?.description) return meta.table.catalog.description
  if (meta.table.comment) return meta.table.comment
  const exact = TABLE_DESCRIPTIONS[meta.table.name]
  if (exact) return exact

  const hasUser = meta.table.columns.some((c) => /userId|ownerId|authorId/i.test(c.name))
  const hasStatus = meta.table.columns.some((c) => /status/i.test(c.name))
  const hasCreated = meta.table.columns.some((c) => /createdAt/i.test(c.name))
  const hints = [
    hasUser ? "包含用户归属字段" : null,
    hasStatus ? "包含状态流转字段" : null,
    hasCreated ? "包含创建时间字段" : null,
  ].filter(Boolean)

  return `${meta.table.name} 属于「${meta.module.name} / ${meta.submodule.name}」，主要用于${meta.submodule.description}${hints.length ? ` 表结构特征：${hints.join("、")}。` : ""}`
}

function groupPublicTables(tables: SqlTableInfo[]) {
  const groups = new Map<string, ModuleGroup>()
  for (const table of tables) {
    const { module, submodule } = moduleForTable(table)
    if (!groups.has(module.id)) groups.set(module.id, { module, submodules: new Map() })
    const moduleGroup = groups.get(module.id)!
    if (!moduleGroup.submodules.has(submodule.id)) {
      moduleGroup.submodules.set(submodule.id, { submodule, tables: [] })
    }
    moduleGroup.submodules.get(submodule.id)!.tables.push({ table, module, submodule })
  }
  return [...groups.values()].sort((a, b) => {
    const ai = CATALOG_MODULE_ORDER.indexOf(a.module.id)
    const bi = CATALOG_MODULE_ORDER.indexOf(b.module.id)
    if (ai !== bi) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi)
    return a.module.name.localeCompare(b.module.name, "zh-CN")
  })
}

function groupPrivateTables(tables: SqlTableInfo[]) {
  const groups = new Map<string, { submodule: SubmoduleDef; tables: TableWithMeta[] }>()
  for (const table of tables) {
    const folderId = table.folderId || "uncategorized"
    const submodule: SubmoduleDef = {
      id: table.catalog?.submoduleId || folderId,
      name: table.catalog?.submoduleName || table.folderName || "未分类",
      description: table.catalog?.description || (table.folderName ? `${table.folderName} 文件夹下的私有表。` : "未放入文件夹的私有表。"),
      matches: () => false,
    }
    if (!groups.has(folderId)) groups.set(folderId, { submodule, tables: [] })
    groups.get(folderId)!.tables.push({ table, module: PRIVATE_MODULE, submodule })
  }

  return [...groups.values()].sort((a, b) => {
    if (a.submodule.id === "uncategorized") return -1
    if (b.submodule.id === "uncategorized") return 1
    return a.submodule.name.localeCompare(b.submodule.name, "zh-CN")
  })
}

function matchesQuery(table: SqlTableInfo, query: string) {
  if (!query) return true
  const q = query.toLowerCase()
  const meta = table.scope === "private"
    ? { module: PRIVATE_MODULE, submodule: { name: table.folderName || "未分类" } }
    : moduleForTable(table)
  const catalogText = table.catalog
    ? [
        table.catalog.moduleName,
        table.catalog.submoduleName,
        table.catalog.description,
        table.catalog.aliases.join(" "),
        table.catalog.keywords.join(" "),
        table.catalog.keyFields.join(" "),
        table.catalog.useCases.join(" "),
      ].join(" ").toLowerCase()
    : ""

  return (
    table.name.toLowerCase().includes(q) ||
    table.schema.toLowerCase().includes(q) ||
    (table.folderName ?? "").toLowerCase().includes(q) ||
    meta.module.name.toLowerCase().includes(q) ||
    meta.submodule.name.toLowerCase().includes(q) ||
    catalogText.includes(q) ||
    table.columns.some((column) => column.name.toLowerCase().includes(q))
  )
}

export function SchemaTree({ schema, onInsertTable, onInsertColumn, onSelectTable, onSchemaChanged }: Props) {
  const [query, setQuery] = useState("")
  const [privateDialog, setPrivateDialog] = useState<"folder" | "table" | null>(null)
  const [folderName, setFolderName] = useState("")
  const [tableName, setTableName] = useState("")
  const [tableFolderId, setTableFolderId] = useState("")
  const [tableDescription, setTableDescription] = useState("")
  const [columnsDefinition, setColumnsDefinition] = useState("id TEXT PRIMARY KEY\ncreatedAt TIMESTAMP NOT NULL DEFAULT now()")
  const [openScopes, setOpenScopes] = useState<Record<"public" | "private", boolean>>({ public: true, private: true })
  const [openTables, setOpenTables] = useState<Record<string, boolean>>({})
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({
    content: true,
    ai: true,
    social: true,
    career: true,
    admin: true,
    community: true,
    sql: true,
    system: false,
  })
  const [openSubmodules, setOpenSubmodules] = useState<Record<string, boolean>>({})
  const [selectedTable, setSelectedTable] = useState<TableWithMeta | null>(null)

  const allTables = useMemo(() => schema?.schemas.flatMap((s) => s.tables) ?? [], [schema])
  const normalizedQuery = query.trim()

  const publicTables = useMemo(
    () => allTables.filter((table) => table.scope !== "private" && matchesQuery(table, normalizedQuery)),
    [allTables, normalizedQuery]
  )
  const privateTables = useMemo(
    () => allTables.filter((table) => table.scope === "private" && matchesQuery(table, normalizedQuery)),
    [allTables, normalizedQuery]
  )
  const publicModuleGroups = useMemo(() => groupPublicTables(publicTables), [publicTables])
  const privateFolderGroups = useMemo(() => groupPrivateTables(privateTables), [privateTables])

  const totalTables = allTables.length
  const grantedTables = allTables.filter((table) => table.access !== "none").length
  const publicTotal = allTables.filter((table) => table.scope !== "private").length
  const privateTotal = allTables.filter((table) => table.scope === "private").length
  const hasVisibleTables = publicTables.length + privateTables.length > 0

  const privateFolders = useMemo(() => {
    const map = new Map<string, string>()
    for (const table of allTables) {
      if (table.scope === "private" && table.folderId && table.folderName) map.set(table.folderId, table.folderName)
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [allTables])

  async function createFolder() {
    try {
      await apiPost("/api/sql/private/folders", { name: folderName })
      setFolderName("")
      setPrivateDialog(null)
      toast.success("文件夹已创建")
      onSchemaChanged?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建失败")
    }
  }

  async function createTable() {
    try {
      await apiPost("/api/sql/private/tables", {
        name: tableName,
        folderId: tableFolderId || undefined,
        description: tableDescription,
        columns: columnsDefinition,
      })
      setTableName("")
      setTableDescription("")
      setPrivateDialog(null)
      toast.success("私有表已创建")
      onSchemaChanged?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建失败")
    }
  }

  function renderTable(meta: TableWithMeta) {
    const table = meta.table
    const qualified = `${table.schema}.${table.name}`
    const isOpen = openTables[qualified]
    const chip = accessChip(table.access)
    const denied = table.access === "none"

    return (
      <div key={qualified} className="ml-3">
        <button
          type="button"
          onClick={() => {
            setOpenTables((current) => ({ ...current, [qualified]: !isOpen }))
            onSelectTable?.(qualified)
          }}
          onDoubleClick={() => onInsertTable?.(insertTableName(table))}
          title={qualified}
          className={cn(
            "group flex w-full items-center gap-1 rounded-sm px-1 py-[3px] text-left text-[12px] hover:bg-[--color-bg-hover]",
            denied && "opacity-60"
          )}
        >
          {isOpen ? <ChevronDown size={10} className="text-[--color-text-muted]" /> : <ChevronRight size={10} className="text-[--color-text-muted]" />}
          <span className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm ring-1", denied ? "bg-slate-100 text-slate-400 ring-slate-200" : tableTone(table))}>
            {denied ? <Lock size={10} /> : <Table2 size={10} />}
          </span>
          <span className="truncate">{table.name}</span>
          {typeof table.rowCountEstimate === "number" ? (
            <span className="ml-auto hidden font-mono text-[10px] tabular-nums text-[--color-text-muted] group-hover:inline">
              {table.rowCountEstimate.toLocaleString()}
            </span>
          ) : null}
          <span className={cn("ml-auto inline-flex items-center gap-1 group-hover:hidden", chip.className)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", chip.dot)} />
            <span className="text-[9px] font-semibold tracking-wide">{chip.label}</span>
          </span>
        </button>

        {isOpen ? (
          <div className="ml-3 border-l border-[--color-border] pb-1 pl-2">
            <button
              type="button"
              onClick={() => setSelectedTable(meta)}
              className="flex w-full items-center gap-1 rounded-sm px-1 py-[2px] text-left text-[11px] text-[--color-brand] hover:bg-[--color-brand-soft]"
            >
              <Info size={9} />
              <span className="truncate">介绍 / 表结构详情</span>
            </button>
            {table.rowFilterPreview ? (
              <div className="my-1 mr-1 flex items-start gap-1 rounded-sm bg-amber-50 px-1.5 py-1 text-[10px] text-amber-800">
                <Sparkles size={9} className="mt-px shrink-0" />
                <span className="font-mono">where {table.rowFilterPreview}</span>
              </div>
            ) : null}
            {table.columns.map((column) => (
              <button
                key={column.name}
                type="button"
                onDoubleClick={() => onInsertColumn?.(quoteIdentifier(column.name))}
                title={column.isMasked ? "受保护字段，无法读取" : column.comment}
                className="flex w-full items-center gap-1 rounded-sm px-1 py-[2px] text-left text-[11px] hover:bg-[--color-bg-hover]"
              >
                {column.isPrimaryKey ? (
                  <Key size={9} className="text-amber-500" />
                ) : column.isForeignKey ? (
                  <KeyRound size={9} className="text-violet-500" />
                ) : column.isMasked ? (
                  <EyeOff size={9} className="text-rose-500" />
                ) : (
                  <Hash size={9} className="text-[--color-text-muted]" />
                )}
                <span className={cn("truncate", column.isMasked ? "text-[--color-text-muted] line-through" : "text-[--color-text-primary]")}>
                  {column.name}
                </span>
                <span className={cn("ml-auto rounded px-1 text-[9px] uppercase tabular-nums", typeColor(column.dataType))}>
                  {shortType(column.dataType)}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[--color-bg-surface]">
      <div className="shrink-0 border-b border-[--color-border] bg-gradient-to-b from-[#F8FAFC] to-[--color-bg-surface] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
            <Database size={13} />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-[1.5px] border-white bg-emerald-500" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 truncate font-mono text-[12px] font-semibold text-[--color-text-primary]">
              {schema?.dataSource?.name ?? "primary"}
              <span className="text-[--color-text-muted]">/</span>
              <span className="text-[--color-text-muted]">{schema?.dataSource?.engine ?? "postgres"}</span>
            </div>
            <div className="font-mono text-[10px] text-[--color-text-muted]">
              {grantedTables}/{totalTables} tables / {schema?.viewer?.role ?? "-"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPrivateDialog("table")}
            title="创建私有表"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[--color-border] text-[--color-text-secondary] hover:bg-[--color-bg-hover] hover:text-[--color-brand]"
          >
            <DatabaseZap size={13} />
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-[--color-border] px-2.5 py-2">
        <label className="flex items-center gap-1.5 rounded-md border border-[--color-border] bg-[--color-bg-soft] px-2 py-1.5 focus-within:border-[--color-brand-border] focus-within:bg-white">
          <Search size={11} className="text-[--color-text-muted]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索分类 / 表 / 列"
            className="w-full bg-transparent font-mono text-[11px] outline-none placeholder:text-[--color-text-muted]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-[--color-text-muted] hover:text-[--color-text-primary]"
            >
              x
            </button>
          ) : null}
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5 font-mono text-[12px]">
        {!schema ? (
          <div className="px-3 py-6 text-[11px] text-[--color-text-muted]">正在加载结构...</div>
        ) : !hasVisibleTables ? (
          <div className="px-3 py-6 text-[11px] text-[--color-text-muted]">没有匹配的表</div>
        ) : (
          <>
            <div className="mb-1">
              <button
                type="button"
                onClick={() => setOpenScopes((current) => ({ ...current, public: !current.public }))}
                className="group flex w-full items-center gap-1 rounded-sm px-1.5 py-1.5 text-left text-[12px] text-[--color-text-primary] hover:bg-[--color-bg-hover]"
                title="公共数据库，由系统和管理员控制权限。"
              >
                {openScopes.public ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">
                  <Database size={12} />
                </span>
                <span className="truncate font-semibold">Public</span>
                <span className="ml-auto rounded bg-[--color-bg-soft] px-1.5 py-px text-[9px] tabular-nums text-[--color-text-muted]">
                  {publicTotal}
                </span>
              </button>

              {openScopes.public
                ? publicModuleGroups.map(({ module, submodules }) => {
                    const moduleTableCount = [...submodules.values()].reduce((sum, sub) => sum + sub.tables.length, 0)
                    const moduleOpen = openModules[module.id] !== false
                    return (
                      <div key={module.id} className="ml-3 border-l border-[--color-border] pl-1">
                        <button
                          type="button"
                          onClick={() => setOpenModules((current) => ({ ...current, [module.id]: !moduleOpen }))}
                          className="group flex w-full items-center gap-1 rounded-sm px-1 py-[3px] text-left text-[11px] text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
                          title={module.description}
                        >
                          {moduleOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                          <span className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm ring-1", moduleTone(module.icon))}>
                            {moduleIcon(module.icon)}
                          </span>
                          <span className="truncate font-semibold">{module.name}</span>
                          <span className="ml-auto rounded px-1 text-[9px] tabular-nums text-[--color-text-muted]">
                            {moduleTableCount}
                          </span>
                        </button>

                        {moduleOpen
                          ? [...submodules.values()].map(({ submodule, tables }) => {
                              const subKey = `${module.id}.${submodule.id}`
                              const subOpen = openSubmodules[subKey] !== false
                              return (
                                <div key={subKey} className="ml-3 border-l border-[--color-border] pl-1">
                                  <button
                                    type="button"
                                    onClick={() => setOpenSubmodules((current) => ({ ...current, [subKey]: !subOpen }))}
                                    className="group flex w-full items-center gap-1 rounded-sm px-1 py-[3px] text-left text-[11px] text-[--color-text-muted] hover:bg-[--color-bg-hover]"
                                    title={submodule.description}
                                  >
                                    {subOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                                      {subOpen ? <FolderOpen size={10} /> : <Folder size={10} />}
                                    </span>
                                    <span className="truncate">{submodule.name}</span>
                                    <span className="ml-auto rounded px-1 text-[9px] tabular-nums">{tables.length}</span>
                                  </button>
                                  {subOpen ? tables.map(renderTable) : null}
                                </div>
                              )
                            })
                          : null}
                      </div>
                    )
                  })
                : null}
            </div>

            <div className="mb-1">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setOpenScopes((current) => ({ ...current, private: !current.private }))}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return
                  event.preventDefault()
                  setOpenScopes((current) => ({ ...current, private: !current.private }))
                }}
                className="group flex w-full items-center gap-1 rounded-sm px-1.5 py-1.5 text-left text-[12px] text-[--color-text-primary] hover:bg-[--color-bg-hover]"
                title="当前用户独享的私人数据库，拥有完整建表、插入、查询和修改权限。"
              >
                {openScopes.private ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200">
                  <DatabaseZap size={12} />
                </span>
                <span className="truncate font-semibold">Private</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setPrivateDialog("folder")
                  }}
                  title="新建私有文件夹"
                  className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded border border-transparent text-[--color-text-muted] hover:border-[--color-border] hover:text-cyan-700"
                >
                  <Plus size={10} />
                </button>
                <span className="ml-auto rounded bg-[--color-bg-soft] px-1.5 py-px text-[9px] tabular-nums text-[--color-text-muted]">
                  {privateTotal}
                </span>
              </div>

              {openScopes.private ? (
                privateFolderGroups.length ? (
                  privateFolderGroups.map(({ submodule, tables }) => {
                    const subKey = `private.${submodule.id}`
                    const subOpen = openSubmodules[subKey] !== false
                    return (
                      <div key={subKey} className="ml-3 border-l border-[--color-border] pl-1">
                        <button
                          type="button"
                          onClick={() => setOpenSubmodules((current) => ({ ...current, [subKey]: !subOpen }))}
                          className="group flex w-full items-center gap-1 rounded-sm px-1 py-[3px] text-left text-[11px] text-[--color-text-muted] hover:bg-[--color-bg-hover]"
                          title={submodule.description}
                        >
                          {subOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200">
                            {subOpen ? <FolderOpen size={10} /> : <Folder size={10} />}
                          </span>
                          <span className="truncate">{submodule.name}</span>
                          <span className="ml-auto rounded px-1 text-[9px] tabular-nums">{tables.length}</span>
                        </button>
                        {subOpen ? tables.map(renderTable) : null}
                      </div>
                    )
                  })
                ) : (
                  <div className="ml-4 border-l border-[--color-border] px-3 py-2 text-[11px] text-[--color-text-muted]">
                    还没有私有表。点击右上角数据库按钮可以创建。
                  </div>
                )
              ) : null}
            </div>
          </>
        )}
      </div>

      <Dialog open={Boolean(selectedTable)} onOpenChange={(open) => !open && setSelectedTable(null)}>
        <DialogContent overlay className="sm:max-w-3xl">
          {selectedTable ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-base">{selectedTable.table.name}</DialogTitle>
                <DialogDescription>
                  {selectedTable.table.scope === "private" ? "Private" : "Public"} / {selectedTable.module.name} / {selectedTable.submodule.name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{selectedTable.table.schema}</Badge>
                  <Badge variant="outline">{selectedTable.table.access.toUpperCase()}</Badge>
                  {typeof selectedTable.table.rowCountEstimate === "number" ? (
                    <Badge variant="outline">{selectedTable.table.rowCountEstimate.toLocaleString()} rows</Badge>
                  ) : null}
                  <Badge variant="outline">{selectedTable.table.columns.length} columns</Badge>
                </div>
                <p className="text-sm leading-6 text-[--color-text-secondary]">
                  {buildTableDescription(selectedTable)}
                </p>
                {selectedTable.table.catalog ? (
                  <div className="grid gap-3 rounded-md border border-[--color-border] bg-[--color-bg-soft] p-3 text-xs">
                    {selectedTable.table.catalog.keyFields.length ? (
                      <div>
                        <div className="mb-1 font-semibold text-[--color-text-primary]">关键字段</div>
                        <div className="flex flex-wrap gap-1">
                          {selectedTable.table.catalog.keyFields.map((field) => (
                            <span key={field} className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-800">
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedTable.table.catalog.relations.length ? (
                      <div>
                        <div className="mb-1 font-semibold text-[--color-text-primary]">常见关联</div>
                        <div className="space-y-1">
                          {selectedTable.table.catalog.relations.map((relation, index) => (
                            <div key={`${relation.table}-${index}`} className="text-[--color-text-secondary]">
                              <span className="font-mono text-[--color-brand]">{relation.table}</span>
                              {relation.fields?.length ? <span className="font-mono text-[--color-text-muted]"> via {relation.fields.join(", ")}</span> : null}
                              <span>：{relation.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedTable.table.catalog.useCases.length ? (
                      <div>
                        <div className="mb-1 font-semibold text-[--color-text-primary]">适用查询场景</div>
                        <div className="flex flex-wrap gap-1">
                          {selectedTable.table.catalog.useCases.map((item) => (
                            <span key={item} className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-800">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[--color-text-primary]">字段结构</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-9 px-3">字段</TableHead>
                        <TableHead className="h-9 px-3">类型</TableHead>
                        <TableHead className="h-9 px-3">属性</TableHead>
                        <TableHead className="h-9 px-3">说明</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTable.table.columns.map((column) => (
                        <TableRow key={column.name}>
                          <TableCell className="px-3 py-2 font-mono text-xs">{column.name}</TableCell>
                          <TableCell className="px-3 py-2">
                            <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10px] uppercase", typeColor(column.dataType))}>
                              {shortType(column.dataType)}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-[--color-text-secondary]">
                            {[
                              column.nullable ? "nullable" : "required",
                              column.isPrimaryKey ? "primary key" : null,
                              column.isForeignKey ? "foreign key" : null,
                              column.isMasked ? "masked" : null,
                            ].filter(Boolean).join(" / ")}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-[--color-text-muted]">
                            {column.comment || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(privateDialog)} onOpenChange={(open) => !open && setPrivateDialog(null)}>
        <DialogContent overlay className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{privateDialog === "folder" ? "新建私有库文件夹" : "新建私有表"}</DialogTitle>
            <DialogDescription>
              私有库只属于当前用户。你可以通过表单建表，也可以直接在编辑器里执行 CREATE TABLE 语句。
            </DialogDescription>
          </DialogHeader>
          {privateDialog === "folder" ? (
            <div className="space-y-3">
              <label className="grid gap-1 text-sm">
                <span>文件夹名称</span>
                <input
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                  className="h-9 rounded-md border border-[--color-border] px-3 outline-none focus:border-[--color-brand-border]"
                  placeholder="例如：实验数据"
                />
              </label>
              <button
                type="button"
                onClick={createFolder}
                className="inline-flex h-9 items-center justify-center rounded-md bg-[--color-brand] px-4 text-sm font-medium text-white"
              >
                创建文件夹
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPrivateDialog("folder")}
                  className="h-8 rounded-md border border-[--color-border] px-3 text-xs hover:bg-[--color-bg-hover]"
                >
                  先建文件夹
                </button>
              </div>
              <label className="grid gap-1 text-sm">
                <span>表名</span>
                <input
                  value={tableName}
                  onChange={(event) => setTableName(event.target.value)}
                  className="h-9 rounded-md border border-[--color-border] px-3 font-mono outline-none focus:border-[--color-brand-border]"
                  placeholder="my_notes"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span>文件夹</span>
                <select
                  value={tableFolderId}
                  onChange={(event) => setTableFolderId(event.target.value)}
                  className="h-9 rounded-md border border-[--color-border] px-3 outline-none focus:border-[--color-brand-border]"
                >
                  <option value="">未分类</option>
                  {privateFolders.map((folder) => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span>说明</span>
                <input
                  value={tableDescription}
                  onChange={(event) => setTableDescription(event.target.value)}
                  className="h-9 rounded-md border border-[--color-border] px-3 outline-none focus:border-[--color-brand-border]"
                  placeholder="这张表用于..."
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span>字段定义</span>
                <textarea
                  value={columnsDefinition}
                  onChange={(event) => setColumnsDefinition(event.target.value)}
                  rows={5}
                  className="resize-none rounded-md border border-[--color-border] px-3 py-2 font-mono text-xs outline-none focus:border-[--color-brand-border]"
                  placeholder={"id TEXT PRIMARY KEY\nname TEXT NOT NULL\ncreatedAt TIMESTAMP NOT NULL DEFAULT now()"}
                />
              </label>
              <button
                type="button"
                onClick={createTable}
                className="inline-flex h-9 items-center justify-center rounded-md bg-[--color-brand] px-4 text-sm font-medium text-white"
              >
                创建私有表
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
