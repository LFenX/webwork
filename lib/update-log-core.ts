import { execFileSync } from "node:child_process"
import { prisma } from "@/lib/db"

export const UPDATE_CHANGE_TYPES = ["功能", "性能", "视觉", "修复", "内容"] as const

export type UpdateChangeType = (typeof UPDATE_CHANGE_TYPES)[number]

export type UpdateLogItem = {
  hash: string
  date: string
  message: string
  originalMessage: string
  customMessage?: string | null
  useOriginal?: boolean
  hidden?: boolean
}

export type UpdateLogFileDTO = {
  path: string
  oldPath?: string | null
  status: string
  additions: number
  deletions: number
  isBinary: boolean
  isHidden: boolean
  hiddenReason?: string | null
  isTruncated: boolean
}

export type UpdateDiffLineDTO = {
  type: "context" | "add" | "delete" | "meta"
  oldLine: number | null
  newLine: number | null
  content: string
}

export type UpdateDiffHunkDTO = {
  header: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: UpdateDiffLineDTO[]
}

export type UpdateDiffFileDTO = {
  path: string
  oldPath?: string | null
  status: string
  language: string
  additions: number
  deletions: number
  isHidden: boolean
  hiddenReason?: string | null
  isTruncated: boolean
  hunks: UpdateDiffHunkDTO[]
}

export type UpdateLogStatsDTO = {
  filesChanged: number
  additions: number
  deletions: number
  hiddenFiles: number
  truncatedFiles: number
}

export type UpdateSummaryDTO = {
  hash: string
  shortHash: string
  committedAt: string
  title: string
  originalMessage: string
  changeType: UpdateChangeType
  modules: string[]
  fileCount: number
  commentCount: number
  isDiffTruncated: boolean
  hiddenReason?: string | null
  stats: UpdateLogStatsDTO
}

export type UpdateDetailDTO = {
  summary: UpdateSummaryDTO
  description: string
  impact: string[]
  files: UpdateLogFileDTO[]
  diff: UpdateDiffFileDTO[]
  safetyNotes: string[]
}

export type UpdateCommentDTO = {
  id: string
  content: string
  parentId: string | null
  stickerId: string | null
  stickerEmoji: string | null
  sticker: {
    id: string
    url: string
    name?: string
    originalName?: string
    isAnimated?: boolean
  } | null
  createdAt: string
  author: {
    id: string
    displayName: string
    email: string
    avatarText?: string | null
    avatarUrl?: string | null
  }
}

export type UpdateListQuery = {
  limit?: number
  cursor?: string | null
  type?: string | null
  q?: string | null
  from?: string | null
  to?: string | null
}

export type UpdateListResult = {
  items: UpdateSummaryDTO[]
  nextCursor: string | null
}

export type UpdateLogSyncResult = {
  ok: boolean
  scanned: number
  synced: number
  failed: number
  skipped: number
  lastSyncedAt: string
  errors: string[]
}

type GitLogRow = {
  hash: string
  date: string
  message: string
}

type ParsedSnapshot = {
  hash: string
  committedAt: Date
  originalMessage: string
  changeType: UpdateChangeType
  modules: string[]
  files: UpdateLogFileDTO[]
  diff: UpdateDiffFileDTO[]
  stats: UpdateLogStatsDTO
  isDiffTruncated: boolean
  hiddenReason: string
}

type OverrideLike = {
  hash: string
  customMessage: string | null
  useOriginal: boolean
  hidden: boolean
}

const DEFAULT_LIMIT = 20
const MAX_LIST_LIMIT = 50
const MAX_SYNC_LIMIT = 160
const MAX_TOTAL_DIFF_CHARS = 520_000
const MAX_FILE_DIFF_CHARS = 140_000
const MAX_FILE_DIFF_LINES = 1_800
const GIT_MAX_BUFFER = 24 * 1024 * 1024

const BINARY_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".eot",
  ".gif",
  ".gz",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mov",
  ".mp3",
  ".mp4",
  ".otf",
  ".pdf",
  ".png",
  ".rar",
  ".tar",
  ".tgz",
  ".ttf",
  ".wasm",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
])

const LOCK_FILES = new Set([
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
])

function safeLimit(value: number | undefined, fallback = DEFAULT_LIMIT) {
  if (!Number.isFinite(value ?? NaN)) return fallback
  return Math.min(Math.max(Math.floor(value!), 1), MAX_LIST_LIMIT)
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\.\/+/, "").trim()
}

function fileExtension(path: string) {
  const clean = normalizePath(path).toLowerCase()
  const index = clean.lastIndexOf(".")
  return index >= 0 ? clean.slice(index) : ""
}

function basename(path: string) {
  const clean = normalizePath(path)
  const parts = clean.split("/")
  return parts[parts.length - 1] ?? clean
}

function runGit(args: string[], maxBuffer = GIT_MAX_BUFFER) {
  try {
    return execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer,
      stdio: ["ignore", "pipe", "ignore"],
    })
  } catch {
    return null
  }
}

function parseGitLogOutput(output: string | null): GitLogRow[] {
  if (!output) return []
  return output
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, date, message] = entry.split("\x1f")
      return {
        hash,
        date,
        message: message || "更新",
      }
    })
    .filter((row) => Boolean(row.hash && row.date))
}

function getGitLogRows(limit: number): GitLogRow[] {
  return parseGitLogOutput(runGit([
    "log",
    `--max-count=${Math.min(Math.max(limit, 1), MAX_SYNC_LIMIT)}`,
    "--date=iso-strict",
    "--pretty=format:%H%x1f%ad%x1f%s%x1e",
  ]))
}

function resolveGitHash(hash: string) {
  const trimmed = hash.trim()
  if (!trimmed) return null
  return runGit(["rev-parse", "--verify", `${trimmed}^{commit}`])?.trim() || null
}

function normalizeStatus(status: string) {
  if (!status) return "?"
  const first = status[0]?.toUpperCase() ?? "?"
  return ["A", "M", "D", "R", "C", "T", "U"].includes(first) ? first : "?"
}

function parseNameStatus(hash: string): Array<{ path: string; oldPath?: string | null; status: string }> {
  const output = runGit(["show", "--format=", "--name-status", "--find-renames", "--find-copies", hash])
  if (!output) return []
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t")
      const status = normalizeStatus(parts[0] ?? "")
      if ((status === "R" || status === "C") && parts.length >= 3) {
        return { status, oldPath: normalizePath(parts[1] ?? ""), path: normalizePath(parts[2] ?? "") }
      }
      return { status, path: normalizePath(parts[1] ?? parts[0] ?? "") }
    })
    .filter((file) => Boolean(file.path))
}

function parseNumstatPath(value: string) {
  const clean = normalizePath(value)
  const brace = clean.match(/^(.*)\{(.+?) => (.+?)\}(.*)$/)
  if (brace) return normalizePath(`${brace[1] ?? ""}${brace[3] ?? ""}${brace[4] ?? ""}`)
  const arrow = clean.match(/^(.+?) => (.+)$/)
  if (arrow) return normalizePath(arrow[2] ?? clean)
  return clean
}

function parseNumstat(hash: string) {
  const output = runGit(["show", "--format=", "--numstat", "--find-renames", "--find-copies", hash])
  const stats = new Map<string, { additions: number; deletions: number; isBinary: boolean }>()
  if (!output) return stats
  output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [additionsRaw, deletionsRaw, ...pathParts] = line.split("\t")
      const path = parseNumstatPath(pathParts.join("\t"))
      if (!path) return
      const isBinary = additionsRaw === "-" || deletionsRaw === "-"
      stats.set(path, {
        additions: isBinary ? 0 : Math.max(0, Number(additionsRaw) || 0),
        deletions: isBinary ? 0 : Math.max(0, Number(deletionsRaw) || 0),
        isBinary,
      })
    })
  return stats
}

function getPathPolicy(path: string) {
  const clean = normalizePath(path)
  const lower = clean.toLowerCase()
  const name = basename(lower)
  const ext = fileExtension(lower)

  if (name === ".env" || name.startsWith(".env.")) return "环境变量文件已隐藏"
  if (
    lower.includes("secret") ||
    lower.includes("/secrets/") ||
    lower.includes("private-key") ||
    lower.includes("id_rsa") ||
    [".key", ".pem", ".p12", ".pfx", ".crt", ".cer"].includes(ext)
  ) {
    return "密钥、证书或敏感凭据已隐藏"
  }
  if (
    lower.startsWith(".next/") ||
    lower.startsWith("node_modules/") ||
    lower.startsWith("app/generated/") ||
    lower.startsWith(".vercel/")
  ) {
    return "构建产物或依赖目录不展示 diff"
  }
  if (
    lower.startsWith("uploads/") ||
    lower.startsWith("public/uploads/") ||
    lower.startsWith("storage/") ||
    lower.startsWith("logs/") ||
    lower.startsWith("tmp/") ||
    [".db", ".sqlite", ".sqlite3", ".log"].includes(ext)
  ) {
    return "运行数据、日志或上传文件不展示 diff"
  }
  if (LOCK_FILES.has(name)) return "锁文件体积较大，仅展示文件变更状态"
  if (BINARY_EXTENSIONS.has(ext)) return "二进制或媒体文件不展示 diff"
  if (lower.includes(".generated.") || lower.endsWith(".min.js") || lower.endsWith(".map")) {
    return "明显生成物不展示 diff"
  }
  return null
}

function languageForPath(path: string) {
  const ext = fileExtension(path)
  const name = basename(path).toLowerCase()
  if (name === "dockerfile") return "docker"
  if (name.endsWith(".module.css") || ext === ".css") return "css"
  if (ext === ".tsx" || ext === ".jsx") return "tsx"
  if (ext === ".ts") return "ts"
  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") return "js"
  if (ext === ".json") return "json"
  if (ext === ".md" || ext === ".mdx") return "md"
  if (ext === ".prisma") return "prisma"
  if (ext === ".sql") return "sql"
  if (ext === ".yml" || ext === ".yaml") return "yaml"
  return ext.replace(".", "") || "text"
}

function inferChangeType(message: string, files: Array<{ path: string }>): UpdateChangeType {
  const text = `${message} ${files.map((file) => file.path).join(" ")}`.toLowerCase()
  if (/perf|performance|speed|cache|loading|lazy|bundle|性能|加载|优化/.test(text)) return "性能"
  if (/fix|bug|patch|error|crash|修复|错误|问题/.test(text)) return "修复"
  if (/style|css|theme|visual|ui|ux|layout|responsive|视觉|界面|样式|移动端/.test(text)) return "视觉"
  if (/docs|copy|content|post|article|mdx|文案|内容|文章/.test(text)) return "内容"
  return "功能"
}

function moduleForPath(path: string) {
  const lower = normalizePath(path).toLowerCase()
  if (lower.startsWith("app/updates") || lower.startsWith("components/updates") || lower.includes("update-log")) return "更新日志"
  if (lower.startsWith("app/admin") || lower.startsWith("components/admin") || lower.startsWith("app/api/admin")) return "后台管理"
  if (lower.startsWith("components/landing") || lower.startsWith("app/welcome") || lower === "app/page.tsx") return "Landing Shell"
  if (lower.startsWith("app/api") || lower.startsWith("lib/")) return "数据与 API"
  if (lower.startsWith("prisma/")) return "数据库"
  if (lower.startsWith("components/")) return "组件"
  if (lower.startsWith("app/sql")) return "SQL 实验室"
  if (lower.startsWith("app/ai") || lower.startsWith("components/ai")) return "AI 模块"
  if (lower.startsWith("app/")) return "页面路由"
  return "工程配置"
}

function inferModules(files: Array<{ path: string }>) {
  const modules = Array.from(new Set(files.map((file) => moduleForPath(file.path))))
  return modules.slice(0, 6)
}

function cleanCommitTitle(message: string) {
  const text = message
    .replace(/^(feat|fix|perf|style|docs|refactor|chore|test)(\([^)]+\))?:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
  return text || "网站功能更新"
}

function humanizeTitle(message: string, changeType: UpdateChangeType, modules: string[]) {
  const cleaned = cleanCommitTitle(message)
  if (cleaned.length <= 3 || /^[a-f0-9]{7,}$/i.test(cleaned)) {
    return `${modules[0] ?? "网站"}${changeType}更新`
  }
  return cleaned.length > 80 ? `${cleaned.slice(0, 79)}...` : cleaned
}

function buildDescription(summary: UpdateSummaryDTO) {
  const modules = summary.modules.length > 0 ? summary.modules.join("、") : "网站基础能力"
  const stat = `+${summary.stats.additions} / -${summary.stats.deletions}`
  return `本次更新整理了 ${modules}，涉及 ${summary.fileCount} 个文件，代码变更 ${stat}。`
}

function buildSafetyNotes(files: UpdateLogFileDTO[], isDiffTruncated: boolean) {
  const notes: string[] = []
  const hiddenCount = files.filter((file) => file.isHidden).length
  const truncatedCount = files.filter((file) => file.isTruncated).length
  if (hiddenCount > 0) notes.push(`${hiddenCount} 个敏感、二进制或生成文件已按安全策略隐藏 diff。`)
  if (truncatedCount > 0 || isDiffTruncated) notes.push("部分大 diff 已截断，保留文件名、状态和统计信息。")
  if (notes.length === 0) notes.push("本次变更未触发敏感文件隐藏或大 diff 截断。")
  return notes
}

function parseHunkHeader(line: string) {
  const match = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?/)
  return {
    oldStart: Number(match?.[1] ?? 0),
    oldLines: Number(match?.[2] ?? 1),
    newStart: Number(match?.[3] ?? 0),
    newLines: Number(match?.[4] ?? 1),
  }
}

function parseDiffGitLine(line: string) {
  const match = line.match(/^diff --git a\/(.+) b\/(.+)$/)
  if (!match) return null
  return {
    oldPath: normalizePath(match[1] ?? ""),
    path: normalizePath(match[2] ?? ""),
  }
}

function parseUnifiedDiff(
  patch: string,
  fileMap: Map<string, UpdateLogFileDTO>,
  commitTruncated: boolean
) {
  const parsed = new Map<string, UpdateDiffFileDTO>()
  let current: UpdateDiffFileDTO | null = null
  let currentHunk: UpdateDiffHunkDTO | null = null
  let oldLine = 0
  let newLine = 0
  let currentChars = 0
  let currentLines = 0
  let skippingCurrentFile = false

  function finishCurrent() {
    if (!current) return
    if (current.isTruncated && currentHunk) {
      currentHunk.lines.push({
        type: "meta",
        oldLine: null,
        newLine: null,
        content: "diff 已截断，剩余内容未公开展示",
      })
    }
    parsed.set(current.path, current)
  }

  for (const line of patch.split(/\r?\n/)) {
    const diffHeader = parseDiffGitLine(line)
    if (diffHeader) {
      finishCurrent()
      const fileInfo = fileMap.get(diffHeader.path) ?? fileMap.get(diffHeader.oldPath)
      const hiddenReason = fileInfo?.hiddenReason ?? null
      current = {
        path: fileInfo?.path ?? diffHeader.path,
        oldPath: fileInfo?.oldPath ?? diffHeader.oldPath,
        status: fileInfo?.status ?? "M",
        language: languageForPath(fileInfo?.path ?? diffHeader.path),
        additions: fileInfo?.additions ?? 0,
        deletions: fileInfo?.deletions ?? 0,
        isHidden: Boolean(fileInfo?.isHidden),
        hiddenReason,
        isTruncated: Boolean(fileInfo?.isTruncated),
        hunks: [],
      }
      currentHunk = null
      currentChars = 0
      currentLines = 0
      skippingCurrentFile = current.isHidden
      continue
    }

    if (!current || skippingCurrentFile) continue

    currentChars += line.length + 1
    currentLines += 1
    if (currentChars > MAX_FILE_DIFF_CHARS || currentLines > MAX_FILE_DIFF_LINES) {
      current.isTruncated = true
      skippingCurrentFile = true
      continue
    }

    if (line.startsWith("@@")) {
      const parsedHeader = parseHunkHeader(line)
      currentHunk = {
        header: line,
        ...parsedHeader,
        lines: [],
      }
      current.hunks.push(currentHunk)
      oldLine = parsedHeader.oldStart
      newLine = parsedHeader.newStart
      continue
    }

    if (!currentHunk) continue

    if (line.startsWith("+") && !line.startsWith("+++")) {
      currentHunk.lines.push({ type: "add", oldLine: null, newLine, content: line.slice(1) })
      newLine += 1
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      currentHunk.lines.push({ type: "delete", oldLine, newLine: null, content: line.slice(1) })
      oldLine += 1
    } else if (line.startsWith(" ")) {
      currentHunk.lines.push({ type: "context", oldLine, newLine, content: line.slice(1) })
      oldLine += 1
      newLine += 1
    } else if (line.startsWith("\\")) {
      currentHunk.lines.push({ type: "meta", oldLine: null, newLine: null, content: line })
    }
  }
  finishCurrent()

  if (commitTruncated && current) {
    const item = parsed.get(current.path)
    if (item) item.isTruncated = true
  }

  return parsed
}

function buildFiles(hash: string) {
  const files = parseNameStatus(hash)
  const statMap = parseNumstat(hash)
  return files.map((file): UpdateLogFileDTO => {
    const stats = statMap.get(file.path) ?? (file.oldPath ? statMap.get(file.oldPath) : undefined)
    const hiddenReason = getPathPolicy(file.path)
    return {
      path: file.path,
      oldPath: file.oldPath ?? null,
      status: file.status,
      additions: stats?.additions ?? 0,
      deletions: stats?.deletions ?? 0,
      isBinary: Boolean(stats?.isBinary),
      isHidden: Boolean(hiddenReason || stats?.isBinary),
      hiddenReason: hiddenReason ?? (stats?.isBinary ? "二进制文件不展示 diff" : null),
      isTruncated: false,
    }
  })
}

function buildStats(files: UpdateLogFileDTO[]): UpdateLogStatsDTO {
  return {
    filesChanged: files.length,
    additions: files.reduce((sum, file) => sum + file.additions, 0),
    deletions: files.reduce((sum, file) => sum + file.deletions, 0),
    hiddenFiles: files.filter((file) => file.isHidden).length,
    truncatedFiles: files.filter((file) => file.isTruncated).length,
  }
}

function emptyDiffForFile(file: UpdateLogFileDTO): UpdateDiffFileDTO {
  return {
    path: file.path,
    oldPath: file.oldPath ?? null,
    status: file.status,
    language: languageForPath(file.path),
    additions: file.additions,
    deletions: file.deletions,
    isHidden: file.isHidden,
    hiddenReason: file.hiddenReason ?? null,
    isTruncated: file.isTruncated,
    hunks: [],
  }
}

function parseSnapshot(row: GitLogRow): ParsedSnapshot | null {
  const hash = resolveGitHash(row.hash) ?? row.hash
  const files = buildFiles(hash)
  const fileMap = new Map(files.map((file) => [file.path, file]))
  const rawPatch = runGit(["show", "--format=", "--unified=3", "--no-color", "--no-ext-diff", "--find-renames", "--find-copies", hash])
  const commitTruncated = Boolean(rawPatch && rawPatch.length > MAX_TOTAL_DIFF_CHARS)
  const patch = rawPatch ? rawPatch.slice(0, MAX_TOTAL_DIFF_CHARS) : ""
  const parsedDiff = parseUnifiedDiff(patch, fileMap, commitTruncated)
  const diff = files.map((file) => {
    const parsed = parsedDiff.get(file.path)
    const next = parsed ?? emptyDiffForFile(file)
    if (commitTruncated && !next.isHidden) next.isTruncated = true
    file.isTruncated = next.isTruncated
    return next
  })
  const stats = buildStats(files)
  const modules = inferModules(files)
  const changeType = inferChangeType(row.message, files)

  return {
    hash,
    committedAt: new Date(row.date),
    originalMessage: row.message || "更新",
    changeType,
    modules,
    files,
    diff,
    stats,
    isDiffTruncated: commitTruncated || stats.truncatedFiles > 0,
    hiddenReason: rawPatch ? "" : "无法读取 git diff，已保留提交和文件状态",
  }
}

function parseSummarySnapshot(row: GitLogRow): ParsedSnapshot | null {
  const hash = resolveGitHash(row.hash) ?? row.hash
  const files = buildFiles(hash)
  const stats = buildStats(files)
  const modules = inferModules(files)
  const changeType = inferChangeType(row.message, files)
  return {
    hash,
    committedAt: new Date(row.date),
    originalMessage: row.message || "更新",
    changeType,
    modules,
    files,
    diff: files.map(emptyDiffForFile),
    stats,
    isDiffTruncated: stats.truncatedFiles > 0,
    hiddenReason: "",
  }
}

async function loadOverrides(hashes: string[]) {
  if (hashes.length === 0) return new Map<string, OverrideLike>()
  const rows = await prisma.updateLogOverride.findMany({
    where: { hash: { in: hashes } },
    select: { hash: true, customMessage: true, useOriginal: true, hidden: true },
  })
  return new Map(rows.map((row) => [row.hash, row]))
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function asFiles(value: unknown): UpdateLogFileDTO[] {
  return Array.isArray(value) ? value as UpdateLogFileDTO[] : []
}

function asDiff(value: unknown): UpdateDiffFileDTO[] {
  return Array.isArray(value) ? value as UpdateDiffFileDTO[] : []
}

function asStats(value: unknown): UpdateLogStatsDTO {
  const fallback = { filesChanged: 0, additions: 0, deletions: 0, hiddenFiles: 0, truncatedFiles: 0 }
  if (!value || typeof value !== "object") return fallback
  const stats = value as Partial<UpdateLogStatsDTO>
  return {
    filesChanged: Number(stats.filesChanged) || 0,
    additions: Number(stats.additions) || 0,
    deletions: Number(stats.deletions) || 0,
    hiddenFiles: Number(stats.hiddenFiles) || 0,
    truncatedFiles: Number(stats.truncatedFiles) || 0,
  }
}

function normalizeChangeType(value: string): UpdateChangeType {
  return UPDATE_CHANGE_TYPES.includes(value as UpdateChangeType) ? value as UpdateChangeType : "功能"
}

function summaryFromEntry(
  entry: {
    hash: string
    committedAt: Date
    originalMessage: string
    changeType: string
    modulesJson: unknown
    filesJson: unknown
    statsJson: unknown
    isDiffTruncated: boolean
    hiddenReason: string
    _count?: { comments?: number }
  },
  override?: OverrideLike
): UpdateSummaryDTO {
  const changeType = normalizeChangeType(entry.changeType)
  const modules = asStringArray(entry.modulesJson)
  const stats = asStats(entry.statsJson)
  const files = asFiles(entry.filesJson)
  const titleSource = override && !override.useOriginal && override.customMessage ? override.customMessage : entry.originalMessage
  const title = override && !override.useOriginal && override.customMessage
    ? override.customMessage
    : humanizeTitle(titleSource, changeType, modules)
  return {
    hash: entry.hash,
    shortHash: entry.hash.slice(0, 12),
    committedAt: entry.committedAt.toISOString(),
    title,
    originalMessage: entry.originalMessage,
    changeType,
    modules,
    fileCount: stats.filesChanged || files.length,
    commentCount: entry._count?.comments ?? 0,
    isDiffTruncated: entry.isDiffTruncated,
    hiddenReason: entry.hiddenReason || null,
    stats,
  }
}

function detailFromEntry(
  entry: {
    hash: string
    committedAt: Date
    originalMessage: string
    changeType: string
    modulesJson: unknown
    filesJson: unknown
    diffJson: unknown
    statsJson: unknown
    isDiffTruncated: boolean
    hiddenReason: string
    _count?: { comments?: number }
  },
  override?: OverrideLike
): UpdateDetailDTO {
  const summary = summaryFromEntry(entry, override)
  const files = asFiles(entry.filesJson)
  const diff = asDiff(entry.diffJson)
  return {
    summary,
    description: buildDescription(summary),
    impact: summary.modules.length > 0 ? summary.modules : ["网站基础能力"],
    files,
    diff,
    safetyNotes: buildSafetyNotes(files, summary.isDiffTruncated),
  }
}

async function upsertSnapshot(snapshot: ParsedSnapshot) {
  await prisma.updateLogEntry.upsert({
    where: { hash: snapshot.hash },
    update: {
      committedAt: snapshot.committedAt,
      originalMessage: snapshot.originalMessage,
      changeType: snapshot.changeType,
      modulesJson: snapshot.modules,
      filesJson: snapshot.files,
      diffJson: snapshot.diff,
      statsJson: snapshot.stats,
      isDiffTruncated: snapshot.isDiffTruncated,
      hiddenReason: snapshot.hiddenReason,
      syncedAt: new Date(),
    },
    create: {
      hash: snapshot.hash,
      committedAt: snapshot.committedAt,
      originalMessage: snapshot.originalMessage,
      changeType: snapshot.changeType,
      modulesJson: snapshot.modules,
      filesJson: snapshot.files,
      diffJson: snapshot.diff,
      statsJson: snapshot.stats,
      isDiffTruncated: snapshot.isDiffTruncated,
      hiddenReason: snapshot.hiddenReason,
      syncedAt: new Date(),
    },
  })
}

function legacyItemFromSummary(summary: UpdateSummaryDTO, override?: OverrideLike): UpdateLogItem {
  const useOriginal = override?.useOriginal ?? true
  return {
    hash: summary.hash,
    date: summary.committedAt,
    originalMessage: summary.originalMessage,
    customMessage: override?.customMessage ?? null,
    useOriginal,
    hidden: override?.hidden ?? false,
    message: useOriginal ? summary.originalMessage : (override?.customMessage || summary.originalMessage),
  }
}

export function getUpdateLog(limit = 80): UpdateLogItem[] {
  return getGitLogRows(limit).map((row) => ({
    hash: row.hash,
    date: row.date,
    message: row.message || "更新",
    originalMessage: row.message || "更新",
  }))
}

export async function getEditableUpdateLog(limit = 80): Promise<UpdateLogItem[]> {
  const entries = await prisma.updateLogEntry.findMany({
    orderBy: { committedAt: "desc" },
    take: Math.min(Math.max(limit, 1), MAX_SYNC_LIMIT),
    select: {
      hash: true,
      committedAt: true,
      originalMessage: true,
      changeType: true,
      modulesJson: true,
      filesJson: true,
      statsJson: true,
      isDiffTruncated: true,
      hiddenReason: true,
      _count: { select: { comments: true } },
    },
  }).catch(() => [])

  if (entries.length > 0) {
    const overrideMap = await loadOverrides(entries.map((entry) => entry.hash))
    return entries.map((entry) => {
      const override = overrideMap.get(entry.hash)
      return legacyItemFromSummary(summaryFromEntry(entry, override), override)
    })
  }

  const original = getUpdateLog(limit)
  if (original.length === 0) return []
  const overrideMap = await loadOverrides(original.map((item) => item.hash))
  return original.map((item) => {
    const override = overrideMap.get(item.hash)
    const useOriginal = override?.useOriginal ?? true
    return {
      ...item,
      customMessage: override?.customMessage ?? null,
      useOriginal,
      hidden: override?.hidden ?? false,
      message: useOriginal ? item.originalMessage : (override?.customMessage || item.originalMessage),
    }
  })
}

export async function getPublicUpdateLog(limit = 80): Promise<UpdateLogItem[]> {
  const items = await getEditableUpdateLog(limit)
  return items.filter((item) => !item.hidden)
}

export async function getPublicUpdateSummaries(query: UpdateListQuery = {}): Promise<UpdateListResult> {
  const limit = safeLimit(query.limit)
  const cursor = query.cursor?.trim() || null
  const q = query.q?.trim().toLowerCase() || ""
  const type = query.type && UPDATE_CHANGE_TYPES.includes(query.type as UpdateChangeType) ? query.type : null
  const committedAt: { lt?: Date; gte?: Date; lte?: Date } = {}
  if (query.from) {
    const from = new Date(query.from)
    if (!Number.isNaN(from.getTime())) committedAt.gte = from
  }
  if (query.to) {
    const to = new Date(query.to)
    if (!Number.isNaN(to.getTime())) committedAt.lte = to
  }
  if (cursor) {
    const cursorEntry = await prisma.updateLogEntry.findUnique({
      where: { hash: cursor },
      select: { committedAt: true },
    }).catch(() => null)
    if (cursorEntry) committedAt.lt = cursorEntry.committedAt
  }
  const rows = await prisma.updateLogEntry.findMany({
    where: {
      ...(type ? { changeType: type } : {}),
      ...(Object.keys(committedAt).length > 0 ? { committedAt } : {}),
    },
    orderBy: { committedAt: "desc" },
    take: q ? Math.min(limit * 4, MAX_SYNC_LIMIT) : limit + 1,
    select: {
      hash: true,
      committedAt: true,
      originalMessage: true,
      changeType: true,
      modulesJson: true,
      filesJson: true,
      statsJson: true,
      isDiffTruncated: true,
      hiddenReason: true,
      _count: { select: { comments: true } },
    },
  }).catch(() => [])

  if (rows.length === 0) {
    const fallbackRows = getGitLogRows(limit)
    const overrideMap = await loadOverrides(fallbackRows.map((item) => item.hash))
    const fallback = fallbackRows
      .map((row) => parseSummarySnapshot(row))
      .filter((snapshot): snapshot is ParsedSnapshot => Boolean(snapshot))
      .filter((snapshot) => !overrideMap.get(snapshot.hash)?.hidden)
      .map((snapshot) => {
        const entryLike = {
          hash: snapshot.hash,
          committedAt: snapshot.committedAt,
          originalMessage: snapshot.originalMessage,
          changeType: snapshot.changeType,
          modulesJson: snapshot.modules,
          filesJson: snapshot.files,
          statsJson: snapshot.stats,
          isDiffTruncated: snapshot.isDiffTruncated,
          hiddenReason: snapshot.hiddenReason,
          _count: { comments: 0 },
        }
        return summaryFromEntry(entryLike, overrideMap.get(snapshot.hash))
      })
      .filter((item) => {
        if (!q) return true
        const haystack = `${item.title} ${item.originalMessage} ${item.modules.join(" ")}`.toLowerCase()
        return haystack.includes(q)
      })
      .filter((item) => !type || item.changeType === type)
    return {
      items: fallback.slice(0, limit),
      nextCursor: null,
    }
  }

  const overrideMap = await loadOverrides(rows.map((row) => row.hash))
  const filtered = rows
    .filter((row) => !overrideMap.get(row.hash)?.hidden)
    .map((row) => summaryFromEntry(row, overrideMap.get(row.hash)))
    .filter((item) => {
      if (!q) return true
      const haystack = `${item.title} ${item.originalMessage} ${item.modules.join(" ")}`.toLowerCase()
      return haystack.includes(q)
    })

  const items = filtered.slice(0, limit)
  const nextCursor = filtered.length > limit ? filtered[limit]?.hash ?? null : (!q && rows.length > limit ? rows[limit]?.hash ?? null : null)
  return { items, nextCursor }
}

async function findEntryByHashInput(hash: string) {
  const clean = hash.trim()
  if (!clean) return null
  const exact = await prisma.updateLogEntry.findUnique({
    where: { hash: clean },
    include: { _count: { select: { comments: true } } },
  }).catch(() => null)
  if (exact) return exact
  return prisma.updateLogEntry.findFirst({
    where: { hash: { startsWith: clean } },
    orderBy: { committedAt: "desc" },
    include: { _count: { select: { comments: true } } },
  }).catch(() => null)
}

export async function getPublicUpdateDetail(hash: string): Promise<UpdateDetailDTO | null> {
  const entry = await findEntryByHashInput(hash)
  if (entry) {
    const override = (await loadOverrides([entry.hash])).get(entry.hash)
    if (override?.hidden) return null
    return detailFromEntry(entry, override)
  }

  const fullHash = resolveGitHash(hash)
  if (!fullHash) return null
  const rowOutput = runGit(["show", "-s", "--date=iso-strict", "--pretty=format:%H%x1f%ad%x1f%s", fullHash])
  const [resolvedHash, date, message] = rowOutput?.split("\x1f") ?? []
  if (!resolvedHash || !date) return null
  const override = (await loadOverrides([resolvedHash])).get(resolvedHash)
  if (override?.hidden) return null
  const snapshot = parseSnapshot({ hash: resolvedHash, date, message: message || "更新" })
  if (!snapshot) return null
  const entryLike = {
    hash: snapshot.hash,
    committedAt: snapshot.committedAt,
    originalMessage: snapshot.originalMessage,
    changeType: snapshot.changeType,
    modulesJson: snapshot.modules,
    filesJson: snapshot.files,
    diffJson: snapshot.diff,
    statsJson: snapshot.stats,
    isDiffTruncated: snapshot.isDiffTruncated,
    hiddenReason: snapshot.hiddenReason,
    _count: { comments: 0 },
  }
  return detailFromEntry(entryLike, override)
}

export async function ensureUpdateLogEntry(hash: string) {
  const existing = await findEntryByHashInput(hash)
  if (existing) return existing.hash
  const fullHash = resolveGitHash(hash)
  if (!fullHash) return null
  const rowOutput = runGit(["show", "-s", "--date=iso-strict", "--pretty=format:%H%x1f%ad%x1f%s", fullHash])
  const [resolvedHash, date, message] = rowOutput?.split("\x1f") ?? []
  if (!resolvedHash || !date) return null
  const snapshot = parseSnapshot({ hash: resolvedHash, date, message: message || "更新" })
  if (!snapshot) return null
  await upsertSnapshot(snapshot)
  return snapshot.hash
}

export async function syncUpdateLogSnapshot(limit = 80): Promise<UpdateLogSyncResult> {
  const rows = getGitLogRows(Math.min(Math.max(limit, 1), MAX_SYNC_LIMIT))
  if (rows.length === 0) {
    return {
      ok: false,
      scanned: 0,
      synced: 0,
      skipped: 0,
      failed: 0,
      lastSyncedAt: new Date().toISOString(),
      errors: ["无法读取 Git 提交记录，请确认当前环境包含 .git 目录。"],
    }
  }

  let synced = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []
  for (const row of rows) {
    try {
      const snapshot = parseSnapshot(row)
      if (!snapshot) {
        skipped += 1
        continue
      }
      await upsertSnapshot(snapshot)
      synced += 1
    } catch (error) {
      failed += 1
      errors.push(`${row.hash.slice(0, 12)}: ${error instanceof Error ? error.message : "同步失败"}`)
    }
  }

  return {
    ok: failed === 0,
    scanned: rows.length,
    synced,
    skipped,
    failed,
    lastSyncedAt: new Date().toISOString(),
    errors,
  }
}

export function updateCommentToDTO(comment: {
  id: string
  content: string
  parentId: string | null
  stickerId: string | null
  stickerEmoji: string | null
  createdAt: Date
  author: { id: string; displayName: string; email: string; avatarText?: string | null; avatarUrl?: string | null }
  sticker?: { id: string; name: string; originalName: string; isAnimated: boolean } | null
}): UpdateCommentDTO {
  return {
    id: comment.id,
    content: comment.content,
    parentId: comment.parentId,
    stickerId: comment.stickerId,
    stickerEmoji: comment.stickerEmoji,
    sticker: comment.sticker ? {
      id: comment.sticker.id,
      url: `/api/stickers/${comment.sticker.id}/file`,
      name: comment.sticker.name,
      originalName: comment.sticker.originalName,
      isAnimated: comment.sticker.isAnimated,
    } : null,
    createdAt: comment.createdAt.toISOString(),
    author: {
      id: comment.author.id,
      displayName: comment.author.displayName || "用户",
      email: "",
      avatarText: comment.author.avatarText,
      avatarUrl: comment.author.avatarUrl,
    },
  }
}

export async function getUpdateComments(hash: string): Promise<UpdateCommentDTO[]> {
  const entry = await findEntryByHashInput(hash)
  if (!entry) return []
  const override = (await loadOverrides([entry.hash])).get(entry.hash)
  if (override?.hidden) return []
  const comments = await prisma.updateLogComment.findMany({
    where: { hash: entry.hash },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
      sticker: { select: { id: true, name: true, originalName: true, isAnimated: true } },
    },
  })
  return comments.map(updateCommentToDTO)
}
