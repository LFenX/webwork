// Server-safe pure helpers for code-block rendering.
// Intentionally NOT marked "use client" so they can be invoked from RSC during SSR
// (markdown-content.tsx is a server component that calls these inside the `pre` renderer).

import type { ReactNode } from "react"

/** Detect language from a `code` element's className like "language-typescript". */
export function detectLanguage(className?: string): string | undefined {
  const match = /language-(\w+)/.exec(className ?? "")
  return match?.[1]
}

/** Pull a stable string identity from arbitrary code children — used to derive a localStorage suffix. */
export function codeFingerprint(children: ReactNode): string {
  function walk(node: ReactNode): string {
    if (typeof node === "string" || typeof node === "number") return String(node)
    if (Array.isArray(node)) return node.map(walk).join("")
    if (node && typeof node === "object" && "props" in (node as { props: unknown })) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (node as any).props
      if (p?.children) return walk(p.children)
    }
    return ""
  }
  const raw = walk(children)
  // tiny non-cryptographic hash for keying
  let hash = 0
  for (let i = 0; i < raw.length; i++) hash = (Math.imul(31, hash) + raw.charCodeAt(i)) | 0
  return Math.abs(hash).toString(36).slice(0, 8)
}
