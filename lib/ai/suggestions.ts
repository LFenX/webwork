export const DEFAULT_AI_SUGGESTIONS = [
  "总结我最近一周的求职进展",
  "帮我看看最近和谁聊天最多",
  "帮我汇总最近三天的重要动态",
  "整理我本月新增的文章主题",
  "帮我找出最适合复盘的一篇文章",
  "把最近日常整理成周报",
  "检查我的简历还缺哪些亮点",
  "根据最近聊天生成待办清单",
  "帮我规划下一篇博客选题",
  "分析我的面试准备薄弱点",
  "找出最近被忽略的求职记录",
  "总结我和好友的互动变化",
  "帮我把零散想法整理成笔记",
  "给我的主页优化三个文案",
  "搜索我最近提到的关键问题",
] as const

const MIN_SUGGESTION_LENGTH = 4
const MAX_SUGGESTION_LENGTH = 80

function cleanSuggestion(value: unknown) {
  if (typeof value !== "string") return ""
  return value
    .replace(/^[\s"'`“”‘’\-[\]【】（(]*(?:\d+[.)、]\s*)?/, "")
    .replace(/[\s"'`“”‘’\]】）)]*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function normalizeAISuggestions(input: unknown, max = 20) {
  const rawItems = Array.isArray(input) ? input : []
  const seen = new Set<string>()
  const items: string[] = []

  for (const raw of rawItems) {
    const item = cleanSuggestion(raw)
    if (item.length < MIN_SUGGESTION_LENGTH || item.length > MAX_SUGGESTION_LENGTH) continue
    const key = item.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    items.push(item)
    if (items.length >= max) break
  }

  return items
}

export function withDefaultAISuggestions(input: unknown, min = 15, max = 20) {
  const items = normalizeAISuggestions(input, max)
  for (const fallback of DEFAULT_AI_SUGGESTIONS) {
    if (items.length >= min) break
    if (!items.some((item) => item === fallback)) items.push(fallback)
  }
  return items.slice(0, Math.max(min, Math.min(max, items.length)))
}
