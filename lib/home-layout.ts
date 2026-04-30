export type HomeWidgetId =
  | "recentActivity"
  | "writingStats"
  | "recentPosts"
  | "writingHeatmap"
  | "chatActivity"
  | "jobFunnel"
  | "recentJobs"
  | "jobHeatmap"
  | "visitStats"
  | "guestbook"

export type HomeWidgetLayout = {
  id: HomeWidgetId
  x: number
  y: number
  w: number
  h: number
  hidden?: boolean
}

export const HOME_WIDGET_LABELS: Record<HomeWidgetId, string> = {
  recentActivity: "最近动态",
  writingStats: "写作统计",
  recentPosts: "最近内容",
  writingHeatmap: "写作热力图",
  chatActivity: "聊天活跃度",
  jobFunnel: "求职漏斗",
  recentJobs: "最近求职动态",
  jobHeatmap: "求职热力图",
  visitStats: "访问统计",
  guestbook: "留言板",
}

export const DEFAULT_HOME_LAYOUT: HomeWidgetLayout[] = [
  { id: "recentActivity", x: 0, y: 0, w: 12, h: 3 },
  { id: "writingStats", x: 0, y: 3, w: 12, h: 2 },
  { id: "recentPosts", x: 0, y: 5, w: 12, h: 3 },
  { id: "writingHeatmap", x: 0, y: 8, w: 12, h: 2 },
  { id: "chatActivity", x: 0, y: 10, w: 12, h: 3 },
  { id: "jobFunnel", x: 0, y: 13, w: 12, h: 3 },
  { id: "recentJobs", x: 0, y: 16, w: 12, h: 2 },
  { id: "jobHeatmap", x: 0, y: 18, w: 12, h: 2 },
  { id: "visitStats", x: 0, y: 20, w: 12, h: 3 },
  { id: "guestbook", x: 0, y: 23, w: 12, h: 3 },
]

export function normalizeHomeLayout(value: unknown): HomeWidgetLayout[] {
  if (!Array.isArray(value)) return DEFAULT_HOME_LAYOUT
  const byId = new Map<string, HomeWidgetLayout>()
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as Partial<HomeWidgetLayout>
    if (!row.id || !(row.id in HOME_WIDGET_LABELS)) continue
    byId.set(row.id, {
      id: row.id,
      x: Math.min(11, Math.max(0, Number(row.x) || 0)),
      y: Math.max(0, Number(row.y) || 0),
      w: Math.min(12, Math.max(3, Number(row.w) || 12)),
      h: Math.min(8, Math.max(1, Number(row.h) || 2)),
      hidden: Boolean(row.hidden),
    })
  }
  return DEFAULT_HOME_LAYOUT.map((item) => byId.get(item.id) ?? item)
}
