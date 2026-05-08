"use client"

import {
  ChangeEvent,
  KeyboardEvent,
  MouseEvent,
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
import { Braces, FileCode, MousePointer2, Moon, SlidersHorizontal, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

const KEYWORDS = /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|OFFSET|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|ON|AS|AND|OR|NOT|IN|IS|NULL|TRUE|FALSE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|RETURNING|WITH|UNION|ALL|DISTINCT|HAVING|CASE|WHEN|THEN|ELSE|END|EXISTS|BETWEEN|LIKE|ILIKE|ASC|DESC|EXPLAIN|ANALYZE|BEGIN|COMMIT|ROLLBACK)\b/gi
const FUNCS = /\b(count|sum|avg|min|max|coalesce|nullif|now|date_trunc|to_char|to_date|extract|lower|upper|length|substring|cast|round|floor|ceil|json_agg|array_agg|string_agg)\s*\(/gi
const STRING = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g
const NUMBER = /\b\d+(?:\.\d+)?\b/g
const COMMENT = /--[^\n]*|\/\*[\s\S]*?\*\//g
const PARAM = /:\w+/g
const OPERATOR = /[=<>!+\-*/%]+/g

type Token = { kind: "k" | "f" | "s" | "n" | "c" | "p" | "o" | "t"; text: string }

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
  const isDark = theme === "dark"

  useEffect(() => {
    window.localStorage.setItem(CARET_STORAGE_KEY, JSON.stringify(caretConfig))
  }, [caretConfig])

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    insertAtCursor: (text: string) => {
      const el = textareaRef.current
      if (!el) return
      const start = el.selectionStart
      const end = el.selectionEnd
      const next = value.slice(0, start) + text + value.slice(end)
      onChange(next)
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
      onChange(text)
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

  useLayoutEffect(() => {
    if (!focused) return
    const id = requestAnimationFrame(syncCustomCaret)
    return () => cancelAnimationFrame(id)
  }, [focused, syncCustomCaret, value])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
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
      onChange(next)
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

  function handlePointerSettled(_e: MouseEvent<HTMLTextAreaElement>) {
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
          "flex shrink-0 items-center gap-2 border-b px-3 py-1.5 text-[11px]",
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
        <span className={cn("font-mono", isDark ? "text-[#94A3B8]" : "text-[--color-text-secondary]")}>
          {caption ?? "query.sql"}
        </span>
        {dirty ? <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[#FB923C]" title="未保存" /> : null}
        <span className="ml-auto inline-flex items-center gap-1.5">
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
        <div ref={codePaneRef} className="relative flex-1">
          <pre
            ref={overlayRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre-wrap break-words p-3 font-mono text-[12.5px] leading-[1.65]"
            style={{ tabSize: 2 }}
          >
            {isEmpty ? (
              <span className={isDark ? "text-[#475569]" : "text-[#94A3B8]"}>{placeholder}</span>
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
              onChange(e.target.value)
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
  )
})
