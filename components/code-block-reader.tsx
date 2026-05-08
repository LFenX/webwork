"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"

const THEMES = [
  { value: "default", label: "Default" },
  { value: "dark", label: "Dark" },
  { value: "github", label: "GitHub" },
  { value: "nord", label: "Nord" },
  { value: "monokai", label: "Monokai" },
] as const

type ThemeValue = (typeof THEMES)[number]["value"]

interface CodeBlockReaderProps {
  language?: string
  defaultTheme?: ThemeValue
  storageKey?: string
  children: React.ReactNode
}

export function CodeBlockReader({ language, defaultTheme = "default", storageKey, children }: CodeBlockReaderProps) {
  const [theme, setTheme] = useState<ThemeValue>(defaultTheme)
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (!storageKey) return
    try {
      const saved = window.localStorage.getItem(storageKey) as ThemeValue | null
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring persisted preference once at mount
      if (saved && THEMES.some((t) => t.value === saved)) setTheme(saved)
    } catch {
      /* ignore */
    }
  }, [storageKey])

  function applyTheme(next: ThemeValue) {
    setTheme(next)
    if (storageKey) {
      try { window.localStorage.setItem(storageKey, next) } catch { /* ignore */ }
    }
  }

  async function handleCopy() {
    const text = preRef.current?.innerText ?? ""
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="prose-code-block" data-theme={theme}>
      <div className="prose-code-block-toolbar" contentEditable={false}>
        {language ? <span className="prose-code-block-lang">{language}</span> : <span className="prose-code-block-lang prose-code-block-lang-empty">code</span>}
        <select
          value={theme}
          onChange={(e) => applyTheme(e.target.value as ThemeValue)}
          aria-label="代码主题"
          className="prose-code-block-select"
        >
          {THEMES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button type="button" onClick={handleCopy} className="prose-code-block-copy" aria-label="复制">
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
      <pre ref={preRef}>{children}</pre>
    </div>
  )
}

export function useArticleDefaultCodeTheme(postId?: string): ThemeValue {
  const [theme, setTheme] = useState<ThemeValue>("default")
  const key = useMemo(() => (postId ? `post-code-theme:${postId}` : null), [postId])
  useEffect(() => {
    if (!key) return
    try {
      const saved = window.localStorage.getItem(key) as ThemeValue | null
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring persisted preference once at mount
      if (saved && THEMES.some((t) => t.value === saved)) setTheme(saved)
    } catch { /* ignore */ }
  }, [key])
  return theme
}
