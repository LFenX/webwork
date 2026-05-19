"use client"

import {
  ChangeEvent,
  KeyboardEvent,
  UIEvent,
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { AlertTriangle, Braces, CheckCircle2, FileCode, Loader2, MousePointer2, Moon, Redo2, SlidersHorizontal, Sun, Undo2 } from "lucide-react"
import { apiPost } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import type { SqlValidateResult } from "@/lib/sql-lab/types"

const KEYWORDS = /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|OFFSET|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|ON|AS|AND|OR|NOT|IN|IS|NULL|TRUE|FALSE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|RETURNING|WITH|UNION|ALL|DISTINCT|HAVING|CASE|WHEN|THEN|ELSE|END|EXISTS|BETWEEN|LIKE|ILIKE|ASC|DESC|EXPLAIN|ANALYZE|BEGIN|COMMIT|ROLLBACK)\b/gi
const FUNCS = /\b(count|sum|avg|min|max|coalesce|nullif|now|date_trunc|to_char|to_date|extract|lower|upper|length|substring|cast|round|floor|ceil|json_agg|array_agg|string_agg)\s*\(/gi
const STRING = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g
const NUMBER = /\b\d+(?:\.\d+)?\b/g
const COMMENT = /--[^\n]*|\/\*[\s\S]*?\*\//g
const PARAM = /:\w+/g
const OPERATOR = /[=<>!+\-*/%]+/g
const SQL_KEYWORD_FIXES = [
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP",
  "ORDER",
  "LIMIT",
  "OFFSET",
  "JOIN",
  "LEFT",
  "RIGHT",
  "INNER",
  "OUTER",
  "FULL",
  "ON",
  "AS",
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS",
  "NULL",
  "INSERT",
  "INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "RETURNING",
  "WITH",
  "UNION",
  "ALL",
  "DISTINCT",
  "HAVING",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "EXISTS",
  "BETWEEN",
  "LIKE",
  "ILIKE",
  "ASC",
  "DESC",
  "EXPLAIN",
] as const
const SQL_KEYWORD_FIX_SET = new Set<string>(SQL_KEYWORD_FIXES)

type Token = { kind: "k" | "f" | "s" | "n" | "c" | "p" | "o" | "t"; text: string }
type SqlDiagnostic = {
  id: string
  start: number
  end: number
  message: string
  severity: "error" | "warning"
  replacement?: string
}
type SqlLexemeKind = "word" | "string" | "quoted" | "number" | "param" | "punct" | "operator"
type SqlLexeme = {
  kind: SqlLexemeKind
  text: string
  upper: string
  start: number
  end: number
  depth: number
}
type SelectSpan = {
  select: SqlLexeme
  listStart: number
  listEnd: number
  expressionCount: number
}

function tokenize(src: string): Token[] {
  const marks: Array<{ start: number; end: number; kind: Token["kind"] }> = []
  const claim = (regex: RegExp, kind: Token["kind"], lengthOverride?: (m: RegExpExecArray) => number) => {
    regex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = regex.exec(src))) {
      const start = m.index
      const len = lengthOverride ? lengthOverride(m) : m[0].length
      const end = start + len
      if (marks.some((x) => start < x.end && end > x.start)) continue
      marks.push({ start, end, kind })
    }
  }
  claim(COMMENT, "c")
  claim(STRING, "s")
  claim(FUNCS, "f", (m) => m[0].length - 1)
  claim(KEYWORDS, "k")
  claim(NUMBER, "n")
  claim(PARAM, "p")
  claim(OPERATOR, "o")
  marks.sort((a, b) => a.start - b.start)
  const out: Token[] = []
  let i = 0
  for (const mk of marks) {
    if (mk.start > i) out.push({ kind: "t", text: src.slice(i, mk.start) })
    out.push({ kind: mk.kind, text: src.slice(mk.start, mk.end) })
    i = mk.end
  }
  if (i < src.length) out.push({ kind: "t", text: src.slice(i) })
  return out
}

const COLOR_DARK: Record<Token["kind"], string> = {
  k: "text-[#7DD3FC] font-medium",
  f: "text-[#C4B5FD]",
  s: "text-[#86EFAC]",
  n: "text-[#FCD34D]",
  c: "text-[#64748B] italic",
  p: "text-[#F0ABFC] font-medium",
  o: "text-[#FB7185]",
  t: "text-[#E2E8F0]",
}
const COLOR_LIGHT: Record<Token["kind"], string> = {
  k: "text-[#1D4ED8] font-semibold",
  f: "text-[#7C3AED]",
  s: "text-[#15803D]",
  n: "text-[#B45309]",
  c: "text-[#94A3B8] italic",
  p: "text-[#C026D3] font-medium",
  o: "text-[#BE123C]",
  t: "text-[#0F172A]",
}

export type SqlEditorTheme = "dark" | "light"

type CaretStyle = "beam" | "soft" | "block" | "underline"

type CaretConfig = {
  preset: string
  style: CaretStyle
  color: string
  glow: string
  width: number
  length: number
  dot: boolean
  pulse: boolean
}

const CARET_STORAGE_KEY = "sql-lab.caret.v1"
const HISTORY_LIMIT = 100

const CARET_PRESETS: Array<{ id: string; name: string; config: CaretConfig }> = [
  {
    id: "aurora",
    name: "Aurora",
    config: { preset: "aurora", style: "soft", color: "#38BDF8", glow: "#7DD3FC", width: 3, length: 0.96, dot: true, pulse: true },
  },
  {
    id: "matcha",
    name: "Matcha",
    config: { preset: "matcha", style: "beam", color: "#22C55E", glow: "#86EFAC", width: 2, length: 1, dot: true, pulse: true },
  },
  {
    id: "berry",
    name: "Berry",
    config: { preset: "berry", style: "soft", color: "#EC4899", glow: "#F9A8D4", width: 4, length: 0.9, dot: true, pulse: true },
  },
  {
    id: "terminal",
    name: "Terminal",
    config: { preset: "terminal", style: "block", color: "#A3E635", glow: "#D9F99D", width: 8, length: 0.86, dot: false, pulse: true },
  },
  {
    id: "ink",
    name: "Ink",
    config: { preset: "ink", style: "underline", color: "#2563EB", glow: "#93C5FD", width: 12, length: 0.72, dot: false, pulse: true },
  },
]

function readCaretConfig(): CaretConfig {
  const fallback = CARET_PRESETS[0].config
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(CARET_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<CaretConfig>
    return {
      preset: parsed.preset || "custom",
      style: ["beam", "soft", "block", "underline"].includes(String(parsed.style)) ? (parsed.style as CaretStyle) : fallback.style,
      color: typeof parsed.color === "string" ? parsed.color : fallback.color,
      glow: typeof parsed.glow === "string" ? parsed.glow : fallback.glow,
      width: typeof parsed.width === "number" ? parsed.width : fallback.width,
      length: typeof parsed.length === "number" ? parsed.length : fallback.length,
      dot: typeof parsed.dot === "boolean" ? parsed.dot : fallback.dot,
      pulse: typeof parsed.pulse === "boolean" ? parsed.pulse : fallback.pulse,
    }
  } catch {
    return fallback
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function lineColumn(src: string, index: number) {
  const before = src.slice(0, index)
  const lines = before.split("\n")
  return { line: lines.length, column: lines[lines.length - 1].length + 1 }
}

function applyDiagnosticFixes(src: string, diagnostics: SqlDiagnostic[]) {
  const appendRank = (item: SqlDiagnostic) => {
    if (item.start !== item.end || item.start !== src.length) return 0
    if (item.replacement === ";") return 0
    if (item.replacement?.startsWith(")")) return 1
    if (item.replacement === "'" || item.replacement === "\"") return 2
    return 0
  }
  const fixable = diagnostics
    .filter((item) => item.replacement !== undefined)
    .sort((a, b) => b.start - a.start || appendRank(a) - appendRank(b))

  return fixable.reduce(
    (next, item) => next.slice(0, item.start) + item.replacement + next.slice(item.end),
    src
  )
}

function scanSqlStructure(src: string) {
  const stack: number[] = []
  const unmatchedClose: number[] = []
  let singleQuoteStart = -1
  let doubleQuoteStart = -1
  let inSingle = false
  let inDouble = false
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    const next = src[i + 1]

    if (inLineComment) {
      if (ch === "\n") inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false
        i += 1
      }
      continue
    }
    if (inSingle) {
      if (ch === "'" && next === "'") {
        i += 1
        continue
      }
      if (ch === "'") inSingle = false
      continue
    }
    if (inDouble) {
      if (ch === '"' && next === '"') {
        i += 1
        continue
      }
      if (ch === '"') inDouble = false
      continue
    }

    if (ch === "-" && next === "-") {
      inLineComment = true
      i += 1
      continue
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true
      i += 1
      continue
    }
    if (ch === "'") {
      inSingle = true
      singleQuoteStart = i
      continue
    }
    if (ch === '"') {
      inDouble = true
      doubleQuoteStart = i
      continue
    }
    if (ch === "(") stack.push(i)
    if (ch === ")") {
      if (stack.length) stack.pop()
      else unmatchedClose.push(i)
    }
  }

  return { openParens: stack, closeParens: unmatchedClose, singleQuoteStart: inSingle ? singleQuoteStart : -1, doubleQuoteStart: inDouble ? doubleQuoteStart : -1 }
}

function scanSqlLexemes(src: string): SqlLexeme[] {
  const out: SqlLexeme[] = []
  let depth = 0
  let i = 0
  const push = (kind: SqlLexemeKind, start: number, end: number, tokenDepth = depth) => {
    const text = src.slice(start, end)
    out.push({ kind, text, upper: text.toUpperCase(), start, end, depth: tokenDepth })
  }

  while (i < src.length) {
    const ch = src[i]
    const next = src[i + 1]

    if (/\s/.test(ch)) {
      i += 1
      continue
    }

    if (ch === "-" && next === "-") {
      i += 2
      while (i < src.length && src[i] !== "\n") i += 1
      continue
    }

    if (ch === "/" && next === "*") {
      i += 2
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i += 1
      i = Math.min(src.length, i + 2)
      continue
    }

    if (ch === "'") {
      const start = i
      i += 1
      while (i < src.length) {
        if (src[i] === "'" && src[i + 1] === "'") {
          i += 2
          continue
        }
        if (src[i] === "'") {
          i += 1
          break
        }
        i += 1
      }
      push("string", start, i)
      continue
    }

    if (ch === "\"") {
      const start = i
      i += 1
      while (i < src.length) {
        if (src[i] === "\"" && src[i + 1] === "\"") {
          i += 2
          continue
        }
        if (src[i] === "\"") {
          i += 1
          break
        }
        i += 1
      }
      push("quoted", start, i)
      continue
    }

    if (/[A-Za-z_]/.test(ch)) {
      const start = i
      i += 1
      while (i < src.length && /[A-Za-z0-9_$]/.test(src[i])) i += 1
      push("word", start, i)
      continue
    }

    if (/\d/.test(ch)) {
      const start = i
      i += 1
      while (i < src.length && /[\d.]/.test(src[i])) i += 1
      push("number", start, i)
      continue
    }

    if (ch === ":" && /[A-Za-z_]/.test(next ?? "")) {
      const start = i
      i += 2
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i += 1
      push("param", start, i)
      continue
    }

    if (ch === "(") {
      push("punct", i, i + 1, depth)
      depth += 1
      i += 1
      continue
    }

    if (ch === ")") {
      depth = Math.max(0, depth - 1)
      push("punct", i, i + 1, depth)
      i += 1
      continue
    }

    if (",.;*".includes(ch)) {
      push("punct", i, i + 1)
      i += 1
      continue
    }

    const opStart = i
    i += 1
    while (i < src.length && /[=<>!+\-*/%|&]/.test(src[i])) i += 1
    push("operator", opStart, i)
  }

  return out
}

function isSelectBoundaryToken(token: SqlLexeme, depth: number) {
  return token.depth === depth && (
    token.upper === "FROM" ||
    token.upper === "WHERE" ||
    token.upper === "GROUP" ||
    token.upper === "ORDER" ||
    token.upper === "HAVING" ||
    token.upper === "LIMIT" ||
    token.upper === "OFFSET" ||
    token.upper === "UNION" ||
    token.text === ";"
  )
}

function isExpressionEndToken(token: SqlLexeme) {
  return token.kind === "string" ||
    token.kind === "quoted" ||
    token.kind === "number" ||
    token.kind === "param" ||
    token.kind === "word" ||
    token.text === ")"
}

function isFunctionStart(token: SqlLexeme | undefined, next: SqlLexeme | undefined) {
  return !!token && !!next && token.kind === "word" && next.text === "(" && next.depth === token.depth
}

function countSelectExpressions(tokens: SqlLexeme[], start: number, end: number, depth: number) {
  let count = 0
  let hasExpression = false
  for (let i = start; i < end; i += 1) {
    const token = tokens[i]
    if (token.depth === depth && token.text === ",") {
      if (hasExpression) count += 1
      hasExpression = false
      continue
    }
    if (token.depth === depth && (token.upper === "DISTINCT" || token.upper === "ALL") && !hasExpression) {
      continue
    }
    hasExpression = true
  }
  return hasExpression ? count + 1 : count
}

function editDistance(a: string, b: string) {
  const rows = a.length + 1
  const cols = b.length + 1
  const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(0))
  for (let i = 0; i < rows; i += 1) dp[i][0] = i
  for (let j = 0; j < cols; j += 1) dp[0][j] = j
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }
  return dp[a.length][b.length]
}

function likelyKeywordReplacement(token: string) {
  const upper = token.toUpperCase()
  if (SQL_KEYWORD_FIX_SET.has(upper) || upper.length < 3) return null
  let best: { keyword: string; distance: number } | null = null
  for (const keyword of SQL_KEYWORD_FIXES) {
    const distance = editDistance(upper, keyword)
    if (!best || distance < best.distance) best = { keyword, distance }
  }
  if (!best) return null
  const threshold = upper.length >= 4 && upper[0] === best.keyword[0] ? 2 : 1
  return best.distance <= threshold ? best.keyword : null
}

function analyzeKeywordTypos(src: string, add: (item: Omit<SqlDiagnostic, "id">) => void) {
  for (const token of scanSqlLexemes(src)) {
    if (token.kind !== "word") continue
    const replacement = likelyKeywordReplacement(token.text)
    if (!replacement) continue
    add({
      start: token.start,
      end: token.end,
      severity: "error",
      message: `疑似关键字拼写错误：“${token.text}” 应为 “${replacement}”。`,
      replacement,
    })
  }
}

function analyzeSelectSyntax(src: string, add: (item: Omit<SqlDiagnostic, "id">) => void) {
  const tokens = scanSqlLexemes(src)
  const selectSpans: SelectSpan[] = []

  for (let i = 0; i < tokens.length; i += 1) {
    const select = tokens[i]
    if (select.upper !== "SELECT") continue
    const depth = select.depth
    let listStart = i + 1
    while (listStart < tokens.length && tokens[listStart].depth === depth && (tokens[listStart].upper === "DISTINCT" || tokens[listStart].upper === "ALL")) {
      listStart += 1
    }

    let listEnd = tokens.length
    for (let j = listStart; j < tokens.length; j += 1) {
      if (isSelectBoundaryToken(tokens[j], depth)) {
        listEnd = j
        break
      }
    }

    if (listStart >= listEnd) {
      add({
        start: select.start,
        end: select.end,
        severity: "error",
        message: "SELECT 后面缺少要查询的字段或表达式。",
      })
      continue
    }

    let expressionStart = listStart
    for (let j = listStart; j <= listEnd; j += 1) {
      const token = tokens[j]
      const isComma = token && token.depth === depth && token.text === ","
      const atEnd = j === listEnd
      if (!isComma && !atEnd) continue
      const exprTokens = tokens.slice(expressionStart, j).filter((item) => !(item.depth === depth && (item.upper === "DISTINCT" || item.upper === "ALL")))
      if (!exprTokens.length) {
        const marker = isComma ? token : tokens[Math.max(listStart, j - 1)]
        add({
          start: marker.start,
          end: marker.end,
          severity: "error",
          message: "SELECT 列表里出现了空表达式，通常是多写了逗号或少写了字段。",
        })
      }
      expressionStart = j + 1
    }

    for (let j = listStart; j < listEnd - 1; j += 1) {
      const prev = tokens[j]
      const curr = tokens[j + 1]
      const next = tokens[j + 2]
      if (
        prev.depth === depth &&
        curr.depth === depth &&
        isExpressionEndToken(prev) &&
        isFunctionStart(curr, next)
      ) {
        add({
          start: prev.end,
          end: curr.end,
          severity: "error",
          message: `“${prev.text}” 和函数 ${curr.text}(...) 之间缺少逗号。`,
          replacement: `, ${curr.text}`,
        })
      }
    }

    selectSpans.push({
      select,
      listStart,
      listEnd,
      expressionCount: countSelectExpressions(tokens, listStart, listEnd, depth),
    })
  }

  for (let i = 1; i < selectSpans.length; i += 1) {
    const previous = selectSpans[i - 1]
    const current = selectSpans[i]
    const hasUnionBetween = tokens.some((token) =>
      token.start > previous.select.start &&
      token.start < current.select.start &&
      token.depth === previous.select.depth &&
      token.upper === "UNION"
    )
    if (!hasUnionBetween || previous.expressionCount === current.expressionCount) continue
    add({
      start: current.select.start,
      end: current.select.end,
      severity: "error",
      message: `UNION 前后 SELECT 返回列数不一致：上一段是 ${previous.expressionCount} 列，这一段是 ${current.expressionCount} 列。`,
    })
  }
}

function analyzeSqlSyntax(src: string): SqlDiagnostic[] {
  const diagnostics: SqlDiagnostic[] = []
  const trimmed = src.trim()
  const add = (item: Omit<SqlDiagnostic, "id">) => diagnostics.push({ ...item, id: `sql_diag_${diagnostics.length}` })

  if (!trimmed) return diagnostics

  for (const match of src.matchAll(/[，；（）]/g)) {
    const replacement = ({ "，": ",", "；": ";", "（": "(", "）": ")" } as Record<string, string>)[match[0]]
    add({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      severity: "warning",
      message: `这里使用了中文符号“${match[0]}”，SQL 中建议改为英文符号“${replacement}”。`,
      replacement,
    })
  }

  for (const match of src.matchAll(/,\s*(FROM|WHERE|GROUP\s+BY|ORDER\s+BY|LIMIT|HAVING)\b/gi)) {
    const start = match.index ?? 0
    add({
      start,
      end: start + 1,
      severity: "error",
      message: `在 ${match[1].toUpperCase()} 前多了一个逗号。`,
      replacement: "",
    })
  }

  const structure = scanSqlStructure(src)
  for (const index of structure.closeParens) {
    add({
      start: index,
      end: index + 1,
      severity: "error",
      message: "这里有多余的右括号，前面没有匹配的左括号。",
      replacement: "",
    })
  }
  for (const index of structure.openParens) {
    add({
      start: index,
      end: index + 1,
      severity: "error",
      message: "这里的左括号没有闭合。",
    })
  }
  if (structure.openParens.length) {
    add({
      start: src.length,
      end: src.length,
      severity: "error",
      message: `建议在 SQL 末尾补上 ${structure.openParens.length} 个右括号。`,
      replacement: ")".repeat(structure.openParens.length),
    })
  }

  if (structure.singleQuoteStart >= 0) {
    add({
      start: structure.singleQuoteStart,
      end: structure.singleQuoteStart + 1,
      severity: "error",
      message: "字符串单引号没有闭合。",
    })
    add({
      start: src.length,
      end: src.length,
      severity: "error",
      message: "建议在 SQL 末尾补上闭合单引号。",
      replacement: "'",
    })
  }
  if (structure.doubleQuoteStart >= 0) {
    add({
      start: structure.doubleQuoteStart,
      end: structure.doubleQuoteStart + 1,
      severity: "error",
      message: "标识符双引号没有闭合。",
    })
    add({
      start: src.length,
      end: src.length,
      severity: "error",
      message: "建议在 SQL 末尾补上闭合双引号。",
      replacement: "\"",
    })
  }

  const selectEmpty = /^\s*SELECT\s*(FROM|WHERE|;|$)/i.exec(src)
  if (selectEmpty) {
    const keywordStart = src.toUpperCase().indexOf("SELECT")
    add({
      start: keywordStart,
      end: keywordStart + "SELECT".length,
      severity: "error",
      message: "SELECT 后面缺少要查询的字段或表达式。",
    })
  }

  const upper = src.toUpperCase()
  const whereIndex = upper.search(/\bWHERE\b/)
  const fromIndex = upper.search(/\bFROM\b/)
  if (whereIndex >= 0 && (fromIndex < 0 || whereIndex < fromIndex) && /^\s*SELECT\b/i.test(src)) {
    add({
      start: whereIndex,
      end: whereIndex + "WHERE".length,
      severity: "error",
      message: "WHERE 应该放在 FROM 之后。",
    })
  }

  analyzeKeywordTypos(src, add)
  analyzeSelectSyntax(src, add)

  const dangling = /\b(WHERE|AND|OR|ON|JOIN|FROM|SELECT|GROUP\s+BY|ORDER\s+BY|LIMIT|HAVING)\s*;?\s*$/i.exec(src) ?? /(?:=|<>|!=|<=|>=|<|>)\s*;?\s*$/.exec(src)
  if (dangling?.index !== undefined) {
    add({
      start: dangling.index,
      end: dangling.index + dangling[0].trim().replace(/;$/, "").length,
      severity: "error",
      message: "语句结尾停在了关键字或运算符后面，还缺少后续条件/字段。",
    })
  }

  if (!/[;]\s*$/.test(src)) {
    add({
      start: src.length,
      end: src.length,
      severity: "warning",
      message: "建议在 SQL 末尾补上分号。",
      replacement: ";",
    })
  }

  return diagnostics
}

function renderTokenSpans(src: string, colorMap: Record<Token["kind"], string>, keyPrefix: string) {
  return tokenize(src).map((tok, index) => (
    <span key={`${keyPrefix}_${index}`} className={colorMap[tok.kind]}>
      {tok.text}
    </span>
  ))
}

function renderDiagnosticCode(
  src: string,
  diagnostics: SqlDiagnostic[],
  isDark: boolean,
  colorMap: Record<Token["kind"], string>
) {
  const ranges = diagnostics
    .filter((item) => item.start < item.end)
    .sort((a, b) => a.start - b.start)
  const parts: Array<{ text: string; diagnostic?: SqlDiagnostic }> = []
  let cursor = 0

  for (const item of ranges) {
    if (item.start < cursor) continue
    if (item.start > cursor) parts.push({ text: src.slice(cursor, item.start) })
    parts.push({ text: src.slice(item.start, item.end), diagnostic: item })
    cursor = item.end
  }
  if (cursor < src.length) parts.push({ text: src.slice(cursor) })

  return parts.map((part, index) => {
    if (!part.diagnostic) {
      return <span key={index}>{renderTokenSpans(part.text, colorMap, `diag_plain_${index}`)}</span>
    }
    return (
      <span
        key={index}
        className={cn(
          "rounded-sm px-0.5 underline decoration-wavy underline-offset-4",
          part.diagnostic.severity === "error"
            ? isDark
              ? "bg-red-500/20 decoration-red-300"
              : "bg-red-100 decoration-red-500"
            : isDark
              ? "bg-amber-400/20 decoration-amber-300"
              : "bg-amber-100 decoration-amber-500"
        )}
      >
        {renderTokenSpans(part.text, colorMap, `diag_mark_${index}`)}
      </span>
    )
  })
}

function wordEnd(src: string, index: number) {
  let end = Math.max(0, Math.min(src.length, index + 1))
  while (end < src.length && /[A-Za-z0-9_$]/.test(src[end])) end += 1
  return end
}

function backendDiagnosticFromResult(src: string, result: SqlValidateResult): SqlDiagnostic | null {
  if (result.ok || !result.error) return null
  const message = result.error.hint
    ? `数据库预检：${result.error.message}（${result.error.hint}）`
    : `数据库预检：${result.error.message}`
  const near = result.error.message.match(/at or near "([^"]+)"/i)?.[1]
  let start = typeof result.error.column === "number" ? result.error.column - 1 : -1
  let end = start >= 0 ? wordEnd(src, start) : -1

  if ((start < 0 || start >= src.length) && near) {
    const found = src.toLowerCase().indexOf(near.toLowerCase())
    if (found >= 0) {
      start = found
      end = found + near.length
    }
  }

  if ((start < 0 || start >= src.length) && result.error.code === "FORBIDDEN_STATEMENT") {
    const first = scanSqlLexemes(src)[0]
    if (first) {
      start = first.start
      end = first.end
    }
  }

  if (start < 0 || start >= src.length) {
    start = 0
    end = Math.min(src.length, 1)
  }

  return {
    id: "sql_diag_backend",
    start,
    end: Math.max(start + 1, end),
    severity: "error",
    message,
  }
}

export type SqlEditorHandle = {
  focus: () => void
  insertAtCursor: (text: string) => void
  replaceAll: (text: string) => void
  getValue: () => string
}

type Props = {
  value: string
  onChange: (value: string) => void
  onRun?: () => void
  onExplainSelection?: (selection: string) => void
  onRewriteSql?: (sql: string) => void
  caption?: string
  placeholder?: string
  readOnly?: boolean
  dirty?: boolean
  theme?: SqlEditorTheme
  onToggleTheme?: () => void
}

export const SqlEditor = forwardRef<SqlEditorHandle, Props>(function SqlEditor(
  {
    value,
    onChange,
    onRun,
    onExplainSelection,
    onRewriteSql,
    caption,
    placeholder = "-- 写 SQL,Cmd / Ctrl + Enter 执行\n-- :viewerId 等命名参数会自动绑定为当前会话\nSELECT id, title FROM \"Post\" LIMIT 10;",
    readOnly,
    dirty,
    theme = "dark",
    onToggleTheme,
  },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLPreElement>(null)
  const codePaneRef = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)
  const [caretPanelOpen, setCaretPanelOpen] = useState(false)
  const [caretConfig, setCaretConfig] = useState<CaretConfig>(() => readCaretConfig())
  const [customCaret, setCustomCaret] = useState({ x: 12, y: 12, height: 20, visible: false })
  const [historyState, setHistoryState] = useState<{ past: string[]; future: string[] }>({ past: [], future: [] })
  const [syntaxCheck, setSyntaxCheck] = useState<{ checked: boolean; diagnostics: SqlDiagnostic[] }>({ checked: false, diagnostics: [] })
  const [syntaxChecking, setSyntaxChecking] = useState(false)
  const lastValueRef = useRef(value)
  const isDark = theme === "dark"

  useEffect(() => {
    window.localStorage.setItem(CARET_STORAGE_KEY, JSON.stringify(caretConfig))
  }, [caretConfig])

  useEffect(() => {
    if (value === lastValueRef.current) return
    lastValueRef.current = value
    setSyntaxCheck({ checked: false, diagnostics: [] })
    setSyntaxChecking(false)
    setHistoryState({ past: [], future: [] })
  }, [value])

  const commitValue = useCallback((next: string) => {
    const current = lastValueRef.current
    if (next === current) return
    lastValueRef.current = next
    setSyntaxCheck({ checked: false, diagnostics: [] })
    setSyntaxChecking(false)
    setHistoryState((prev) => ({
      past: [...prev.past.slice(-(HISTORY_LIMIT - 1)), current],
      future: [],
    }))
    onChange(next)
  }, [onChange])

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    insertAtCursor: (text: string) => {
      const el = textareaRef.current
      if (!el) return
      const start = el.selectionStart
      const end = el.selectionEnd
      const next = value.slice(0, start) + text + value.slice(end)
      commitValue(next)
      requestAnimationFrame(() => {
        el.focus()
        const pos = start + text.length
        el.setSelectionRange(pos, pos)
      })
    },
    replaceAll: (text: string) => {
      const el = textareaRef.current
      if (el) {
        el.value = text
        el.setSelectionRange(text.length, text.length)
      }
      commitValue(text)
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
        syncCustomCaret()
      })
    },
    getValue: () => textareaRef.current?.value ?? value,
  }))

  const tokens = useMemo(() => tokenize(value || placeholder), [value, placeholder])
  const isEmpty = !value
  const lineCount = Math.max((value.match(/\n/g)?.length ?? 0) + 1, 1)
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1)
  const COLOR = isDark ? COLOR_DARK : COLOR_LIGHT

  const syncCustomCaret = useCallback(() => {
    const el = textareaRef.current
    const pane = codePaneRef.current
    if (!el || !pane || document.activeElement !== el) {
      setCustomCaret((prev) => (prev.visible ? { ...prev, visible: false } : prev))
      return
    }

    const style = window.getComputedStyle(el)
    const mirror = document.createElement("div")
    mirror.style.position = "fixed"
    mirror.style.left = "-10000px"
    mirror.style.top = "0"
    mirror.style.visibility = "hidden"
    mirror.style.pointerEvents = "none"
    mirror.style.boxSizing = style.boxSizing
    mirror.style.width = `${el.clientWidth}px`
    mirror.style.minHeight = `${el.clientHeight}px`
    mirror.style.padding = style.padding
    mirror.style.border = style.border
    mirror.style.font = style.font
    mirror.style.fontFamily = style.fontFamily
    mirror.style.fontSize = style.fontSize
    mirror.style.fontWeight = style.fontWeight
    mirror.style.letterSpacing = style.letterSpacing
    mirror.style.lineHeight = style.lineHeight
    mirror.style.whiteSpace = "pre-wrap"
    mirror.style.overflowWrap = "break-word"
    mirror.style.wordBreak = "break-word"
    mirror.style.tabSize = "2"

    const before = el.value.slice(0, el.selectionStart)
    const marker = document.createElement("span")
    marker.textContent = "\u200b"
    marker.style.display = "inline-block"
    marker.style.width = "0"
    const lineHeight = Number.parseFloat(style.lineHeight) || 20
    marker.style.height = `${lineHeight}px`
    marker.style.verticalAlign = "top"
    mirror.append(document.createTextNode(before))
    mirror.append(marker)
    document.body.append(mirror)

    const x = marker.offsetLeft - el.scrollLeft
    const y = marker.offsetTop - el.scrollTop
    document.body.removeChild(mirror)

    setCustomCaret({
      x: Math.max(8, x),
      y: Math.max(8, y),
      height: lineHeight,
      visible: focused,
    })
  }, [focused])

  const restoreValue = useCallback((next: string) => {
    const el = textareaRef.current
    if (el) {
      el.value = next
      el.setSelectionRange(next.length, next.length)
    }
    setSyntaxCheck({ checked: false, diagnostics: [] })
    setSyntaxChecking(false)
    onChange(next)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      syncCustomCaret()
    })
  }, [onChange, syncCustomCaret])

  const undo = useCallback(() => {
    if (readOnly) return
    setHistoryState((prev) => {
      const previous = prev.past[prev.past.length - 1]
      if (previous === undefined) return prev
      const current = lastValueRef.current
      lastValueRef.current = previous
      restoreValue(previous)
      return {
        past: prev.past.slice(0, -1),
        future: [current, ...prev.future].slice(0, HISTORY_LIMIT),
      }
    })
  }, [readOnly, restoreValue])

  const redo = useCallback(() => {
    if (readOnly) return
    setHistoryState((prev) => {
      const next = prev.future[0]
      if (next === undefined) return prev
      const current = lastValueRef.current
      lastValueRef.current = next
      restoreValue(next)
      return {
        past: [...prev.past.slice(-(HISTORY_LIMIT - 1)), current],
        future: prev.future.slice(1),
      }
    })
  }, [readOnly, restoreValue])

  const syntaxDiagnostics = syntaxCheck.diagnostics
  const proposedSql = useMemo(() => applyDiagnosticFixes(value, syntaxDiagnostics), [syntaxDiagnostics, value])
  const fixableSyntaxCount = syntaxDiagnostics.filter((item) => item.replacement !== undefined).length
  const hasSyntaxFixes = proposedSql !== value
  const syntaxErrorCount = syntaxDiagnostics.filter((item) => item.severity === "error").length

  const runSyntaxCheck = useCallback(async () => {
    const checkedSql = value
    const localDiagnostics = analyzeSqlSyntax(checkedSql)
    setSyntaxChecking(true)
    setSyntaxCheck({ checked: true, diagnostics: localDiagnostics })
    requestAnimationFrame(syncCustomCaret)
    try {
      const result = await apiPost<SqlValidateResult>("/api/sql/validate", { sql: checkedSql })
      if (lastValueRef.current !== checkedSql) return
      const backendDiagnostic = backendDiagnosticFromResult(checkedSql, result)
      setSyntaxCheck({
        checked: true,
        diagnostics: backendDiagnostic ? [...localDiagnostics, backendDiagnostic] : localDiagnostics,
      })
    } catch (error) {
      if (lastValueRef.current !== checkedSql) return
      setSyntaxCheck({
        checked: true,
        diagnostics: [
          ...localDiagnostics,
          {
            id: "sql_diag_backend_unavailable",
            start: 0,
            end: Math.min(1, checkedSql.length),
            severity: "warning",
            message: error instanceof Error ? `数据库预检失败：${error.message}` : "数据库预检失败。",
          },
        ],
      })
    } finally {
      if (lastValueRef.current === checkedSql) {
        setSyntaxChecking(false)
        requestAnimationFrame(syncCustomCaret)
      }
    }
  }, [syncCustomCaret, value])

  const applySyntaxFixes = useCallback(() => {
    if (!hasSyntaxFixes || readOnly) return
    commitValue(proposedSql)
    setSyntaxCheck({ checked: true, diagnostics: analyzeSqlSyntax(proposedSql) })
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      syncCustomCaret()
    })
  }, [commitValue, hasSyntaxFixes, proposedSql, readOnly, syncCustomCaret])

  useLayoutEffect(() => {
    if (!focused) return
    const id = requestAnimationFrame(syncCustomCaret)
    return () => cancelAnimationFrame(id)
  }, [focused, syncCustomCaret, value])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "e") {
      const el = e.currentTarget
      const selection = el.value.slice(el.selectionStart, el.selectionEnd).trim()
      if (selection) {
        e.preventDefault()
        onExplainSelection?.(selection)
        return
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault()
      onRewriteSql?.(value)
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      onRun?.()
      return
    }
    if (e.key === "Tab") {
      e.preventDefault()
      const el = e.currentTarget
      const start = el.selectionStart
      const end = el.selectionEnd
      const indent = "  "
      const next = value.slice(0, start) + indent + value.slice(end)
      commitValue(next)
      requestAnimationFrame(() => {
        el.setSelectionRange(start + indent.length, start + indent.length)
        syncCustomCaret()
      })
    }
  }

  function handleScroll(e: UIEvent<HTMLTextAreaElement>) {
    if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop
    if (overlayRef.current) {
      overlayRef.current.scrollTop = e.currentTarget.scrollTop
      overlayRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
    requestAnimationFrame(syncCustomCaret)
  }

  function handlePointerSettled() {
    requestAnimationFrame(syncCustomCaret)
  }

  const caretWidth = caretConfig.style === "underline" ? Math.max(10, caretConfig.width) : caretConfig.width
  const caretHeight =
    caretConfig.style === "underline"
      ? Math.max(2, Math.round(caretConfig.width / 3))
      : Math.max(8, Math.round(customCaret.height * clamp(caretConfig.length, 0.35, 1.6)))
  const caretTop =
    caretConfig.style === "underline"
      ? customCaret.y + customCaret.height / 2 + Math.max(4, customCaret.height * 0.28)
      : customCaret.y + customCaret.height / 2 - caretHeight / 2
  const caretRadius = caretConfig.style === "block" ? 3 : 999

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden rounded-md border shadow-[0_4px_18px_rgba(15,23,42,0.05)]",
        isDark
          ? "border-[#1E293B] bg-[#0B1220] focus-within:border-[#3B82F6]/60 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.18)]"
          : "border-[--color-border] bg-white focus-within:border-[--color-brand-border] focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.08)]"
      )}
    >
      {/* IDE-style title bar */}
      <div
        className={cn(
          "flex min-w-0 shrink-0 items-center gap-2 overflow-x-auto border-b px-3 py-1.5 text-[11px] scrollbar-none",
          isDark
            ? "border-[#1E293B] bg-[#0F172A]/70 text-[#64748B]"
            : "border-[--color-border] bg-[#FAFBFC] text-[--color-text-muted]"
        )}
      >
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#FB7185]/80" />
          <span className="h-2 w-2 rounded-full bg-[#FCD34D]/80" />
          <span className="h-2 w-2 rounded-full bg-[#86EFAC]/80" />
        </span>
        <FileCode size={11} className={cn("ml-1", isDark ? "text-[#475569]" : "text-[--color-text-muted]")} />
        <span className={cn("min-w-0 truncate font-mono", isDark ? "text-[#94A3B8]" : "text-[--color-text-secondary]")}>
          {caption ?? "query.sql"}
        </span>
        {dirty ? <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[#FB923C]" title="未保存" /> : null}
        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={runSyntaxCheck}
            disabled={!value.trim() || syntaxChecking}
            title="检查当前 SQL 语法"
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded px-2 font-mono text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
              syntaxChecking
                ? isDark
                  ? "bg-sky-400/15 text-sky-100"
                  : "bg-sky-50 text-sky-700"
                : syntaxCheck.checked && syntaxDiagnostics.length === 0
                ? isDark
                  ? "bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : syntaxErrorCount > 0
                  ? isDark
                    ? "bg-red-500/20 text-red-100 hover:bg-red-500/30"
                    : "bg-red-50 text-red-700 hover:bg-red-100"
                  : isDark
                    ? "bg-amber-400/20 text-amber-100 hover:bg-amber-400/30"
                    : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            )}
          >
            {syntaxChecking ? (
              <Loader2 size={12} className="animate-spin" />
            ) : syntaxCheck.checked && syntaxDiagnostics.length === 0 ? (
              <CheckCircle2 size={12} />
            ) : (
              <AlertTriangle size={12} />
            )}
            {syntaxChecking ? "预检中" : "检查语法"}
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={readOnly || historyState.past.length === 0}
            title="撤回上一步"
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-35",
              isDark
                ? "text-[#94A3B8] hover:bg-[#1E293B] hover:text-white"
                : "text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
            )}
          >
            <Undo2 size={11} />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={readOnly || historyState.future.length === 0}
            title="下一步"
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-35",
              isDark
                ? "text-[#94A3B8] hover:bg-[#1E293B] hover:text-white"
                : "text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
            )}
          >
            <Redo2 size={11} />
          </button>
          <span className={cn("mx-0.5 h-4 w-px", isDark ? "bg-[#1E293B]" : "bg-[--color-border]")} />
          <Braces size={10} />
          <span className="font-mono">postgres</span>
          <span
            className={cn(
              "rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
              isDark ? "bg-[#1E293B]" : "bg-[--color-bg-hover] text-[--color-text-secondary]"
            )}
          >
            {readOnly ? "readonly" : "rw"}
          </span>
          {onToggleTheme ? (
            <button
              type="button"
              onClick={onToggleTheme}
              title={isDark ? "切换到浅色主题" : "切换到深色主题"}
              className={cn(
                "ml-1 inline-flex h-5 w-5 items-center justify-center rounded transition-colors",
                isDark
                  ? "text-[#94A3B8] hover:bg-[#1E293B] hover:text-white"
                  : "text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
              )}
            >
              {isDark ? <Sun size={11} /> : <Moon size={11} />}
            </button>
          ) : null}
          <div className="relative">
            <button
              type="button"
              onClick={() => setCaretPanelOpen((open) => !open)}
              title="光标样式"
              className={cn(
                "ml-1 inline-flex h-5 w-5 items-center justify-center rounded transition-colors",
                isDark
                  ? "text-[#94A3B8] hover:bg-[#1E293B] hover:text-white"
                  : "text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]",
                caretPanelOpen && (isDark ? "bg-[#1E293B] text-white" : "bg-[--color-bg-hover] text-[--color-text-primary]")
              )}
            >
              <MousePointer2 size={11} />
            </button>
            {caretPanelOpen ? (
              <div
                className={cn(
                  "absolute right-0 top-7 z-40 w-[290px] rounded-md border p-3 shadow-[0_18px_44px_rgba(15,23,42,0.18)]",
                  isDark ? "border-[#1E293B] bg-[#0F172A] text-[#CBD5E1]" : "border-[--color-border] bg-white text-[--color-text-primary]"
                )}
              >
                <div className="mb-2 flex items-center gap-2 font-mono text-[11px] font-semibold">
                  <SlidersHorizontal size={12} />
                  Cursor
                  <span
                    className="ml-auto inline-block h-4 rounded-full"
                    style={{
                      width: 4,
                      background: caretConfig.color,
                      boxShadow: `0 0 10px ${caretConfig.glow}`,
                    }}
                  />
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {CARET_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setCaretConfig(preset.config)}
                      className={cn(
                        "flex h-8 items-center justify-center rounded border text-[9px] transition-colors",
                        caretConfig.preset === preset.id
                          ? isDark
                            ? "border-sky-400 bg-sky-400/15 text-sky-100"
                            : "border-blue-400 bg-blue-50 text-blue-700"
                          : isDark
                            ? "border-[#1E293B] hover:bg-[#1E293B]"
                            : "border-[--color-border] hover:bg-[--color-bg-hover]"
                      )}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-[10px]">
                    <span className="text-[--color-text-muted]">Color</span>
                    <input
                      type="color"
                      value={caretConfig.color}
                      onChange={(e) => setCaretConfig((c) => ({ ...c, preset: "custom", color: e.target.value }))}
                      className="h-8 w-full rounded border border-[--color-border] bg-transparent p-1"
                    />
                  </label>
                  <label className="grid gap-1 text-[10px]">
                    <span className="text-[--color-text-muted]">Glow</span>
                    <input
                      type="color"
                      value={caretConfig.glow}
                      onChange={(e) => setCaretConfig((c) => ({ ...c, preset: "custom", glow: e.target.value }))}
                      className="h-8 w-full rounded border border-[--color-border] bg-transparent p-1"
                    />
                  </label>
                </div>
                <label className="mt-3 grid gap-1 text-[10px]">
                  <span className="flex justify-between text-[--color-text-muted]">
                    <span>Width</span>
                    <span>{caretConfig.width}px</span>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={14}
                    value={caretConfig.width}
                    onChange={(e) => setCaretConfig((c) => ({ ...c, preset: "custom", width: Number(e.target.value) }))}
                  />
                </label>
                <label className="mt-2 grid gap-1 text-[10px]">
                  <span className="flex justify-between text-[--color-text-muted]">
                    <span>Length</span>
                    <span>{Math.round(caretConfig.length * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={35}
                    max={160}
                    value={Math.round(caretConfig.length * 100)}
                    onChange={(e) => setCaretConfig((c) => ({ ...c, preset: "custom", length: Number(e.target.value) / 100 }))}
                  />
                </label>
                <div className="mt-3 grid grid-cols-4 gap-1">
                  {(["beam", "soft", "block", "underline"] as CaretStyle[]).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setCaretConfig((c) => ({ ...c, preset: "custom", style }))}
                      className={cn(
                        "h-7 rounded border px-1 text-[9px] capitalize",
                        caretConfig.style === style
                          ? isDark
                            ? "border-sky-400 bg-sky-400/15 text-sky-100"
                            : "border-blue-400 bg-blue-50 text-blue-700"
                          : isDark
                            ? "border-[#1E293B] hover:bg-[#1E293B]"
                            : "border-[--color-border] hover:bg-[--color-bg-hover]"
                      )}
                    >
                      {style}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2 text-[10px]">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={caretConfig.dot}
                      onChange={(e) => setCaretConfig((c) => ({ ...c, preset: "custom", dot: e.target.checked }))}
                      className="h-3 w-3"
                    />
                    Dot
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={caretConfig.pulse}
                      onChange={(e) => setCaretConfig((c) => ({ ...c, preset: "custom", pulse: e.target.checked }))}
                      className="h-3 w-3"
                    />
                    Pulse
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        </span>
      </div>

      {/* code area */}
      <div className="flex min-h-0 flex-1 flex-col">
        {syntaxCheck.checked ? (
          <div
            className={cn(
              "shrink-0 border-b px-3 py-2 font-mono text-[11px]",
              syntaxChecking
                ? isDark
                  ? "border-sky-300/20 bg-sky-400/10 text-sky-100"
                  : "border-sky-100 bg-sky-50 text-sky-800"
                : syntaxDiagnostics.length === 0
                ? isDark
                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                  : "border-emerald-100 bg-emerald-50 text-emerald-800"
                : isDark
                  ? "border-amber-300/20 bg-[#101826] text-slate-100"
                  : "border-amber-100 bg-[#FFFBEB] text-[--color-text-primary]"
            )}
          >
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold",
                  syntaxChecking
                    ? isDark
                      ? "border-sky-300/30 bg-sky-400/10 text-sky-100"
                      : "border-sky-200 bg-white text-sky-700"
                    : syntaxDiagnostics.length === 0
                    ? isDark
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                      : "border-emerald-200 bg-white text-emerald-700"
                    : syntaxErrorCount > 0
                      ? isDark
                        ? "border-red-400/30 bg-red-500/10 text-red-200"
                        : "border-red-200 bg-white text-red-700"
                      : isDark
                        ? "border-amber-300/30 bg-amber-400/10 text-amber-100"
                        : "border-amber-200 bg-white text-amber-800"
                )}
              >
                {syntaxChecking ? "~" : syntaxDiagnostics.length === 0 ? "+" : "!"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                  {syntaxChecking ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-sky-500" />
                      <span>数据库预检中</span>
                    </>
                  ) : syntaxDiagnostics.length === 0 ? (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      <span>未发现明显语法问题</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={13} className={syntaxErrorCount > 0 ? "text-red-500" : "text-amber-500"} />
                      <span>发现 {syntaxDiagnostics.length} 个问题</span>
                      {fixableSyntaxCount ? <span className="opacity-70">可应用 {fixableSyntaxCount} 处建议</span> : null}
                    </>
                  )}
                </div>
                {syntaxDiagnostics.length ? (
                  <div className="mt-1 grid max-h-24 gap-1 overflow-auto pr-1">
                    {syntaxDiagnostics.slice(0, 4).map((item) => {
                      const pos = lineColumn(value, item.start)
                      const fixable = item.replacement !== undefined
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "flex min-w-0 items-start gap-2 rounded px-2 py-1",
                            item.severity === "error"
                              ? isDark
                                ? "bg-red-500/10 text-red-100"
                                : "bg-red-50 text-red-700"
                              : isDark
                                ? "bg-amber-400/10 text-amber-100"
                                : "bg-white/70 text-amber-800"
                          )}
                        >
                          <span className={cn("w-3 shrink-0 font-bold", fixable ? "text-emerald-500" : "text-red-500")}>
                            {fixable ? "+" : "!"}
                          </span>
                          <span className="shrink-0 opacity-75">L{pos.line}:C{pos.column}</span>
                          <span className="min-w-0">{item.message}</span>
                        </div>
                      )
                    })}
                    {syntaxDiagnostics.length > 4 ? (
                      <div className="px-2 text-[10px] opacity-70">还有 {syntaxDiagnostics.length - 4} 个问题...</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {syntaxDiagnostics.length ? (
                <button
                  type="button"
                  onClick={applySyntaxFixes}
                  disabled={!hasSyntaxFixes || readOnly}
                  title={hasSyntaxFixes ? "应用可自动修复的语法建议" : "当前问题需要手动处理"}
                  className={cn(
                    "inline-flex h-7 shrink-0 items-center gap-1 rounded border px-2 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                    isDark
                      ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/25"
                      : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                  )}
                >
                  <span className="font-bold">+</span>
                  应用更改
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1">
          <div
            ref={gutterRef}
            aria-hidden
            className={cn(
              "select-none overflow-hidden border-r py-3 pl-3 pr-3 font-mono text-[11px] leading-[1.65]",
              isDark
                ? "border-[#1E293B] bg-[#0B1220] text-[#475569]"
                : "border-[--color-border] bg-[#F8FAFC] text-[#94A3B8]"
            )}
            style={{ minWidth: 48 }}
          >
            {lineNumbers.map((n) => (
              <div key={n} className="text-right tabular-nums">{n}</div>
            ))}
          </div>
          <div ref={codePaneRef} className="relative min-w-0 flex-1">
          <pre
            ref={overlayRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre-wrap break-words p-3 font-mono text-[12.5px] leading-[1.65]"
            style={{ tabSize: 2 }}
          >
            {isEmpty ? (
              <span className={isDark ? "text-[#475569]" : "text-[#94A3B8]"}>{placeholder}</span>
            ) : syntaxCheck.checked && syntaxDiagnostics.length ? (
              renderDiagnosticCode(value, syntaxDiagnostics, isDark, COLOR)
            ) : (
              tokens.map((tok, i) => (
                <span key={i} className={COLOR[tok.kind]}>
                  {tok.text}
                </span>
              ))
            )}
            <span>{"\n"}</span>
          </pre>
          <textarea
            ref={textareaRef}
            value={value}
            placeholder={placeholder}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            readOnly={readOnly}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              commitValue(e.target.value)
              requestAnimationFrame(syncCustomCaret)
            }}
            onFocus={() => {
              setFocused(true)
              requestAnimationFrame(syncCustomCaret)
            }}
            onBlur={() => {
              setFocused(false)
              setCustomCaret((prev) => ({ ...prev, visible: false }))
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={syncCustomCaret}
            onMouseUp={handlePointerSettled}
            onSelect={syncCustomCaret}
            onScroll={handleScroll}
            className={cn(
              "relative h-full w-full resize-none whitespace-pre-wrap break-words bg-transparent p-3 font-mono text-[12.5px] leading-[1.65] outline-none",
              isDark
                ? "caret-transparent text-transparent selection:bg-[#3B82F6]/30 placeholder:text-transparent"
                : "caret-transparent text-transparent selection:bg-[--color-brand-soft] placeholder:text-transparent"
            )}
            style={{
              tabSize: 2,
            }}
          />
          {customCaret.visible ? (
            <span
              aria-hidden
              className="pointer-events-none absolute z-20"
              style={{
                left: customCaret.x,
                top: caretTop,
                width: caretWidth,
                height: caretHeight,
                borderRadius: caretRadius,
                background:
                  caretConfig.style === "block"
                    ? `${caretConfig.color}33`
                    : `linear-gradient(180deg, ${caretConfig.glow}, ${caretConfig.color})`,
                border: caretConfig.style === "block" ? `1px solid ${caretConfig.color}` : undefined,
                boxShadow: `0 0 12px ${caretConfig.glow}, 0 0 2px ${caretConfig.color}`,
                animation: caretConfig.pulse ? "sql-cute-caret 1.05s ease-in-out infinite" : undefined,
              }}
            >
              {caretConfig.dot && caretConfig.style !== "block" ? (
                <span
                  className="absolute rounded-full"
                  style={{
                    right: -4,
                    top: -4,
                    width: 6,
                    height: 6,
                    background: caretConfig.glow,
                    boxShadow: `0 0 10px ${caretConfig.glow}`,
                  }}
                />
              ) : null}
            </span>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  )
})
