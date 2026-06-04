"use client"

import Link from "next/link"
import { FormEvent, type Dispatch, type SetStateAction, useCallback, useMemo, useRef, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Filter,
  GitCommitHorizontal,
  Info,
  MessageSquare,
  Rss,
  Search,
  Send,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StickerPicker, type StickerPick } from "@/components/sticker-picker"
import { ThreadedDiscussion } from "@/components/threaded-discussion"
import { handleEnterToSubmit } from "@/lib/keyboard"
import { formatChinaDateTime } from "@/lib/time"
import styles from "./update-log.module.css"
import type {
  UpdateChangeType,
  UpdateCommentDTO,
  UpdateDetailDTO,
  UpdateDiffFileDTO,
  UpdateListResult,
  UpdateSummaryDTO,
} from "@/lib/update-log"

const TYPE_OPTIONS: Array<"全部" | UpdateChangeType> = ["全部", "功能", "性能", "视觉", "修复", "内容"]
const TABS = [
  { key: "summary", label: "说明" },
  { key: "impact", label: "影响范围" },
  { key: "files", label: "涉及文件" },
  { key: "diff", label: "代码 Diff" },
  { key: "comments", label: "用户反馈" },
] as const

type ActiveTab = (typeof TABS)[number]["key"]

type UpdatesModuleProps = {
  shell: "landing" | "app"
  initialSummaries: UpdateSummaryDTO[]
  initialNextCursor?: string | null
  initialDetail: UpdateDetailDTO | null
  initialComments: UpdateCommentDTO[]
  viewer: {
    isAuthenticated: boolean
    userId?: string | null
    canModerate?: boolean
  }
}

function compactDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { day: "--", time: "--:--" }
  return {
    day: new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date),
  }
}

function statusText(status: string) {
  const map: Record<string, string> = { A: "新增", M: "修改", D: "删除", R: "重命名", C: "复制", T: "类型", U: "冲突" }
  return map[status] ?? "变更"
}

function buildMonthRange(month: string) {
  if (!month) return {}
  const start = new Date(`${month}-01T00:00:00+08:00`)
  if (Number.isNaN(start.getTime())) return {}
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  return { from: start.toISOString(), to: end.toISOString() }
}

function statText(item: UpdateSummaryDTO) {
  return `+${item.stats.additions} / -${item.stats.deletions}`
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label}已复制`)
  } catch {
    toast.error("复制失败")
  }
}

export function UpdatesModule({
  shell,
  initialSummaries,
  initialNextCursor,
  initialDetail,
  initialComments,
  viewer,
}: UpdatesModuleProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [summaries, setSummaries] = useState(initialSummaries)
  const [detail, setDetail] = useState<UpdateDetailDTO | null>(initialDetail)
  const [comments, setComments] = useState(initialComments)
  const [selectedHash, setSelectedHash] = useState(initialDetail?.summary.hash ?? initialSummaries[0]?.hash ?? "")
  const [activeTab, setActiveTab] = useState<ActiveTab>("diff")
  const [activeFilePath, setActiveFilePath] = useState(initialDetail?.diff[0]?.path ?? "")
  const [changeType, setChangeType] = useState<"全部" | UpdateChangeType>("全部")
  const [month, setMonth] = useState("")
  const [query, setQuery] = useState("")
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor ?? null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [collapsedFiles, setCollapsedFiles] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  const selectedSummary = useMemo(
    () => summaries.find((item) => item.hash === selectedHash) ?? detail?.summary ?? summaries[0] ?? null,
    [detail?.summary, selectedHash, summaries]
  )

  const activeDiffFile = useMemo(
    () => detail?.diff.find((file) => file.path === activeFilePath) ?? detail?.diff[0] ?? null,
    [activeFilePath, detail]
  )

  const replaceUrlHash = useCallback((hash: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (hash) params.set("change", hash)
    else params.delete("change")
    const next = params.toString()
    startTransition(() => router.replace(next ? `/updates?${next}` : "/updates", { scroll: false }))
  }, [router, searchParams])

  const loadDetail = useCallback(async (hash: string, options?: { replaceUrl?: boolean }) => {
    if (!hash) return
    setSelectedHash(hash)
    if (options?.replaceUrl !== false) replaceUrlHash(hash)
    setLoadingDetail(true)
    try {
      const [detailRes, commentsRes] = await Promise.all([
        fetch(`/api/updates/${encodeURIComponent(hash)}`, { cache: "no-store" }),
        fetch(`/api/updates/${encodeURIComponent(hash)}/comments`, { cache: "no-store" }),
      ])
      if (!detailRes.ok) throw new Error("更新记录不存在")
      const nextDetail = await detailRes.json() as UpdateDetailDTO
      const nextComments = commentsRes.ok ? await commentsRes.json() as UpdateCommentDTO[] : []
      setDetail(nextDetail)
      setSelectedHash(nextDetail.summary.hash)
      setActiveFilePath(nextDetail.diff[0]?.path ?? "")
      setCollapsedFiles([])
      setComments(Array.isArray(nextComments) ? nextComments : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载更新详情失败")
    } finally {
      setLoadingDetail(false)
    }
  }, [replaceUrlHash])

  async function loadList(options?: {
    append?: boolean
    cursor?: string | null
    filters?: { changeType?: "全部" | UpdateChangeType; month?: string; query?: string }
  }) {
    setLoadingList(true)
    try {
      const nextType = options?.filters?.changeType ?? changeType
      const nextMonth = options?.filters?.month ?? month
      const nextQuery = options?.filters?.query ?? query
      const params = new URLSearchParams({ limit: "20" })
      if (nextType !== "全部") params.set("type", nextType)
      if (nextQuery.trim()) params.set("q", nextQuery.trim())
      const range = buildMonthRange(nextMonth)
      if (range.from) params.set("from", range.from)
      if (range.to) params.set("to", range.to)
      if (options?.cursor) params.set("cursor", options.cursor)
      const res = await fetch(`/api/updates?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) throw new Error("加载列表失败")
      const data = await res.json() as UpdateListResult
      const nextItems = Array.isArray(data.items) ? data.items : []
      setSummaries((prev) => options?.append ? [...prev, ...nextItems] : nextItems)
      setNextCursor(data.nextCursor)
      if (!options?.append) {
        const first = nextItems[0]
        if (first) await loadDetail(first.hash)
        else {
          setDetail(null)
          setComments([])
          setSelectedHash("")
          replaceUrlHash("")
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载更新列表失败")
    } finally {
      setLoadingList(false)
    }
  }

  function updateCommentCount(delta: number) {
    setSummaries((items) =>
      items.map((item) =>
        item.hash === selectedHash ? { ...item, commentCount: Math.max(0, item.commentCount + delta) } : item
      )
    )
    setDetail((current) =>
      current && current.summary.hash === selectedHash
        ? { ...current, summary: { ...current.summary, commentCount: Math.max(0, current.summary.commentCount + delta) } }
        : current
    )
  }

  const filterActive = changeType !== "全部" || Boolean(month) || Boolean(query.trim())

  return (
    <section className={styles.module} data-shell={shell} aria-busy={isPending || undefined}>
      <header className={styles.topbar}>
        <div className={styles.titleMark} aria-hidden="true">
          <Code2 size={28} />
        </div>
        <div className={styles.titleBlock}>
          <h1>网站建设日志</h1>
          <p>把每一次代码变化，整理成用户看得懂的建站记录</p>
          <div className={styles.chips}>
            <span>Git 记录生成</span>
            <span>公开只读</span>
            <span>可评论</span>
          </div>
        </div>
        <div className={styles.topActions}>
          <Button type="button" variant="outline" size="sm" onClick={() => setAboutOpen(true)}>
            <Info size={15} /> 关于本日志
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/updates/feed.xml" prefetch={false}>
              <Rss size={15} /> 订阅更新
            </Link>
          </Button>
        </div>
      </header>

      <div className={styles.filters}>
        <div className={styles.filterLead}>
          <Filter size={16} />
          <span>筛选</span>
        </div>
        <div className={styles.typeTabs} role="tablist" aria-label="变更类型">
          {TYPE_OPTIONS.map((item) => (
            <button
              key={item}
              type="button"
              className={item === changeType ? styles.typeActive : ""}
              onClick={() => setChangeType(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className={styles.monthInput}>
          <CalendarDays size={15} />
          <input value={month} onChange={(event) => setMonth(event.target.value)} type="month" aria-label="按月份筛选" />
        </label>
        <label className={styles.searchInput}>
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索说明、模块" />
        </label>
        <Button type="button" size="sm" onClick={() => loadList()} loading={loadingList} loadingText="筛选中">
          应用
        </Button>
        {filterActive ? (
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => {
              setChangeType("全部")
              setMonth("")
              setQuery("")
              void loadList({ filters: { changeType: "全部", month: "", query: "" } })
            }}
          >
            清除
          </button>
        ) : null}
      </div>

      <div className={styles.workspace}>
        <aside className={styles.timeline} aria-label="变更时间坐标">
          <div className={styles.timelineHeader}>
            <span>变更时间坐标</span>
            <strong>{summaries.length}</strong>
          </div>
          <div className={styles.timelineList}>
            {summaries.map((item) => {
              const date = compactDate(item.committedAt)
              const selected = selectedHash === item.hash
              return (
                <button
                  key={item.hash}
                  type="button"
                  className={`${styles.timelineItem} ${selected ? styles.timelineItemActive : ""}`}
                  onClick={() => loadDetail(item.hash)}
                >
                  <span className={styles.timelineDot} aria-hidden="true" />
                  <span className={styles.timelineDate}>
                    <strong>{date.day}</strong>
                    <span>{date.time}</span>
                  </span>
                  <span className={styles.timelineCard}>
                    <span className={styles.timelineTitle}>{item.title}</span>
                    <span className={styles.timelineMeta}>
                      <code>{item.shortHash}</code>
                      <span>{item.fileCount} 个文件</span>
                    </span>
                    <span className={styles.timelineTags}>
                      <em data-type={item.changeType}>{item.changeType}</em>
                      {item.modules.slice(0, 2).map((module) => <small key={module}>{module}</small>)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className={styles.loadMore}
            disabled={!nextCursor || loadingList}
            onClick={() => loadList({ append: true, cursor: nextCursor })}
          >
            {nextCursor ? loadingList ? "加载中..." : "加载更多" : "没有更多了"}
            <ChevronDown size={15} />
          </button>
        </aside>

        <article className={styles.detailPanel}>
          {!detail || !selectedSummary ? (
            <div className={styles.emptyState}>
              <GitCommitHorizontal size={28} />
              <p>还没有可公开展示的建设日志。</p>
            </div>
          ) : (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <h2>{detail.summary.title}</h2>
                  <div className={styles.detailMeta}>
                    <span>{formatChinaDateTime(detail.summary.committedAt)}</span>
                    <span>类型：<b data-type={detail.summary.changeType}>{detail.summary.changeType}</b></span>
                    <button type="button" onClick={() => copyText(detail.summary.hash, "提交 hash")}>
                      提交：<code>{detail.summary.shortHash}</code> <Copy size={13} />
                    </button>
                  </div>
                </div>
                <div className={styles.detailStats}>
                  <span>{detail.summary.fileCount} 文件</span>
                  <span>{statText(detail.summary)}</span>
                  <span>{detail.summary.commentCount} 评论</span>
                </div>
              </div>

              <div className={styles.tabs} role="tablist" aria-label="更新详情">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={activeTab === tab.key ? styles.tabActive : ""}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className={styles.detailBody} aria-live={loadingDetail ? "polite" : "off"}>
                {loadingDetail ? <div className={styles.loadingVeil}>加载变更详情...</div> : null}
                {activeTab === "summary" ? <SummaryPane detail={detail} /> : null}
                {activeTab === "impact" ? <ImpactPane detail={detail} /> : null}
                {activeTab === "files" ? <FilesPane detail={detail} /> : null}
                {activeTab === "diff" ? (
                  <DiffStoryPane
                    detail={detail}
                    activeFile={activeDiffFile}
                    activeFilePath={activeFilePath}
                    comments={comments}
                    setComments={setComments}
                    viewer={viewer}
                    collapsedFiles={collapsedFiles}
                    onSelectFile={setActiveFilePath}
                    onToggleFile={(path) => {
                      setCollapsedFiles((items) => items.includes(path) ? items.filter((item) => item !== path) : [...items, path])
                    }}
                    onShowFiles={() => setActiveTab("files")}
                    onCommentDelta={updateCommentCount}
                  />
                ) : null}
                {activeTab === "comments" ? (
                  <CommentsPane
                    hash={detail.summary.hash}
                    comments={comments}
                    setComments={setComments}
                    viewer={viewer}
                    onCommentDelta={updateCommentCount}
                  />
                ) : null}
              </div>
            </>
          )}
        </article>
      </div>

      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent overlay className={styles.aboutDialog}>
          <DialogHeader>
            <DialogTitle>关于网站建设日志</DialogTitle>
            <DialogDescription>
              这里展示的是网站代码提交同步后的公开快照，用来让用户了解功能建设过程，而不是代码编辑器。
            </DialogDescription>
          </DialogHeader>
          <div className={styles.aboutContent}>
            <p>数据来源于 Git 提交和后台人工说明。生产环境优先读取数据库快照，因此部署包没有 `.git` 目录时也能正常展示。</p>
            <p>diff 只读展示，不提供保存、合并、部署或在线修改能力。</p>
            <p>环境变量、密钥证书、上传数据、运行日志、构建产物、二进制文件和超大 diff 会被隐藏或截断。</p>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function SummaryPane({ detail }: { detail: UpdateDetailDTO }) {
  return (
    <div className={styles.summaryPane}>
      <p>{detail.description}</p>
      <div className={styles.safetyNotes}>
        {detail.safetyNotes.map((note) => (
          <span key={note}>{note}</span>
        ))}
      </div>
    </div>
  )
}

function ImpactPane({ detail }: { detail: UpdateDetailDTO }) {
  return (
    <div className={styles.impactGrid}>
      {detail.impact.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  )
}

function FilesPane({ detail }: { detail: UpdateDetailDTO }) {
  return (
    <div className={styles.fileTable}>
      {detail.files.map((file) => (
        <div key={`${file.status}:${file.path}`} className={styles.fileRow}>
          <span data-status={file.status}>{statusText(file.status)}</span>
          <code>{file.path}</code>
          <small>+{file.additions} / -{file.deletions}</small>
          {file.hiddenReason ? <em>{file.hiddenReason}</em> : null}
        </div>
      ))}
    </div>
  )
}

function DiffStoryPane({
  detail,
  activeFile,
  activeFilePath,
  comments,
  setComments,
  viewer,
  collapsedFiles,
  onSelectFile,
  onToggleFile,
  onShowFiles,
  onCommentDelta,
}: {
  detail: UpdateDetailDTO
  activeFile: UpdateDiffFileDTO | null
  activeFilePath: string
  comments: UpdateCommentDTO[]
  setComments: Dispatch<SetStateAction<UpdateCommentDTO[]>>
  viewer: UpdatesModuleProps["viewer"]
  collapsedFiles: string[]
  onSelectFile: (path: string) => void
  onToggleFile: (path: string) => void
  onShowFiles: () => void
  onCommentDelta: (delta: number) => void
}) {
  const collapsed = activeFile ? collapsedFiles.includes(activeFile.path) : false
  const previewFiles = detail.files.slice(0, 4)
  const diffPaths = new Set(detail.diff.map((file) => file.path))

  return (
    <div className={styles.diffStoryShell}>
      <div className={styles.diffStory}>
        <div className={styles.changeNarrative}>
          <p>{detail.description}</p>

          <section className={styles.storySection} aria-labelledby="update-impact-heading">
            <h3 id="update-impact-heading">影响范围</h3>
            <div className={styles.storyChips}>
              {detail.impact.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </section>

          <section className={styles.storySection} aria-labelledby="update-files-heading">
            <div className={styles.storySectionTitle}>
              <h3 id="update-files-heading">涉及文件</h3>
              <small>({detail.files.length})</small>
            </div>
            <div className={styles.storyFileList}>
              {previewFiles.map((file) => {
                const canShowDiff = diffPaths.has(file.path)
                return (
                  <button
                    key={`${file.status}:${file.path}`}
                    type="button"
                    className={activeFilePath === file.path ? styles.storyFileActive : ""}
                    disabled={!canShowDiff}
                    onClick={() => onSelectFile(file.path)}
                  >
                    <span data-status={file.status}>{file.status.slice(0, 1) || "M"}</span>
                    <code>{file.path}</code>
                    {file.hiddenReason ? <em>{file.hiddenReason}</em> : null}
                  </button>
                )
              })}
            </div>
            <button type="button" className={styles.storyMoreButton} onClick={onShowFiles}>
              查看全部变更文件 {detail.files.length} 个
              <ChevronRight size={15} />
            </button>
          </section>
        </div>

        <DiffCodePanel
          activeFile={activeFile}
          collapsed={collapsed}
          onToggleFile={onToggleFile}
        />
      </div>

      <section className={styles.inlineFeedback} aria-labelledby="inline-feedback-heading">
        <div className={styles.inlineFeedbackHeader}>
          <h3 id="inline-feedback-heading">用户反馈</h3>
          <span>({detail.summary.commentCount})</span>
        </div>
        <CommentsPane
          hash={detail.summary.hash}
          comments={comments}
          setComments={setComments}
          viewer={viewer}
          onCommentDelta={onCommentDelta}
          compact
        />
      </section>
    </div>
  )
}

function DiffCodePanel({
  activeFile,
  collapsed,
  onToggleFile,
}: {
  activeFile: UpdateDiffFileDTO | null
  collapsed: boolean
  onToggleFile: (path: string) => void
}) {
  return (
    <div className={styles.diffViewer}>
      {!activeFile ? (
        <div className={styles.emptyState}>没有可展示的 diff。</div>
      ) : (
        <>
          <div className={styles.diffHeader}>
            <div>
              <strong>{activeFile.path}</strong>
              <span>{activeFile.language} · +{activeFile.additions} / -{activeFile.deletions}</span>
            </div>
            <div>
              <button type="button" onClick={() => onToggleFile(activeFile.path)}>
                {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                {collapsed ? "展开" : "折叠"}
              </button>
              <button type="button" onClick={() => copyText(activeFile.path, "文件路径")}>
                <Copy size={14} /> 路径
              </button>
            </div>
          </div>
          {activeFile.isHidden ? (
            <div className={styles.diffNotice}>{activeFile.hiddenReason || "该文件 diff 已隐藏"}</div>
          ) : collapsed ? (
            <div className={styles.diffNotice}>当前文件已折叠，保留路径和变更统计。</div>
          ) : activeFile.hunks.length === 0 ? (
            <div className={styles.diffNotice}>该文件没有可展示的文本 diff。</div>
          ) : (
            <div className={styles.diffCode}>
              {activeFile.hunks.map((hunk) => (
                <div key={`${activeFile.path}:${hunk.header}`} className={styles.hunk}>
                  <div className={styles.hunkHeader}>{hunk.header}</div>
                  {hunk.lines.map((line, index) => (
                    <div key={`${hunk.header}:${index}`} className={styles.diffLine} data-line-type={line.type}>
                      <span>{line.oldLine ?? ""}</span>
                      <span>{line.newLine ?? ""}</span>
                      <code>{line.content || " "}</code>
                    </div>
                  ))}
                </div>
              ))}
              {activeFile.isTruncated ? <div className={styles.diffNotice}>该文件 diff 已截断。</div> : null}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CommentsPane({
  hash,
  comments,
  setComments,
  viewer,
  onCommentDelta,
  compact = false,
}: {
  hash: string
  comments: UpdateCommentDTO[]
  setComments: Dispatch<SetStateAction<UpdateCommentDTO[]>>
  viewer: UpdatesModuleProps["viewer"]
  onCommentDelta: (delta: number) => void
  compact?: boolean
}) {
  const [content, setContent] = useState("")
  const [sticker, setSticker] = useState<StickerPick | null>(null)
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!content.trim() && !sticker) return
    setSaving(true)
    try {
      const res = await fetch(`/api/updates/${encodeURIComponent(hash)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          stickerId: sticker?.type === "asset" ? sticker.id : null,
          stickerEmoji: sticker?.type === "emoji" ? sticker.emoji : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "评论失败")
      }
      const saved = await res.json() as UpdateCommentDTO
      setComments((items) => [...items, saved])
      setContent("")
      setSticker(null)
      onCommentDelta(1)
      toast.success("评论已发布")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "评论失败")
    } finally {
      setSaving(false)
    }
  }

  const reply = useCallback(async (parentId: string, replyContent: string, replySticker?: StickerPick | null) => {
    const res = await fetch(`/api/updates/${encodeURIComponent(hash)}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: replyContent.trim(),
        parentId,
        stickerId: replySticker?.type === "asset" ? replySticker.id : null,
        stickerEmoji: replySticker?.type === "emoji" ? replySticker.emoji : null,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? "回复失败")
    }
    const saved = await res.json() as UpdateCommentDTO
    setComments((items) => [...items, saved])
    onCommentDelta(1)
  }, [hash, onCommentDelta, setComments])

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/updates/comments/${encodeURIComponent(id)}`, { method: "DELETE", cache: "no-store" })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? "删除失败")
    }
    setComments((items) => items.filter((item) => item.id !== id))
    onCommentDelta(-1)
    toast.success("评论已删除")
  }, [onCommentDelta, setComments])

  return (
    <div className={`${styles.commentsPane} ${compact ? styles.commentsPaneCompact : ""}`}>
      {viewer.isAuthenticated ? (
        <form ref={formRef} onSubmit={submitComment} className={styles.commentForm}>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => handleEnterToSubmit(event, () => formRef.current?.requestSubmit(), { disabled: saving || (!content.trim() && !sticker) })}
            rows={compact ? 1 : 3}
            placeholder="留下你的想法..."
          />
          <div>
            <div className={styles.commentTools}>
              <StickerPicker onPick={setSticker} />
              {sticker ? (
                <span className={styles.stickerPreview}>
                  {sticker.type === "emoji" ? sticker.emoji : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sticker.url} alt={sticker.name} />
                  )}
                  <button type="button" onClick={() => setSticker(null)}>×</button>
                </span>
              ) : null}
            </div>
            <Button type="submit" size="sm" loading={saving} loadingText="发送中" disabled={!content.trim() && !sticker}>
              <Send size={15} /> 评论
            </Button>
          </div>
        </form>
      ) : (
        <div className={styles.loginPrompt}>
          <MessageSquare size={18} />
          <span>登录后可以参与这次更新的讨论。</span>
          <Link href="/login" prefetch={false}>去登录</Link>
        </div>
      )}

      {comments.length === 0 ? (
        <div className={styles.noComments}>还没有反馈，第一条建议会很有价值。</div>
      ) : (
        <ThreadedDiscussion
          items={comments}
          canReply={viewer.isAuthenticated}
          canDelete={(item) => Boolean(viewer.canModerate || item.author.id === viewer.userId)}
          onReply={reply}
          onDelete={(id) => {
            void remove(id).catch((error) => toast.error(error instanceof Error ? error.message : "删除失败"))
          }}
          formatTime={formatChinaDateTime}
          newestFirst
        />
      )}
    </div>
  )
}
