// Server-safe pure helpers for heading slugs and TOC extraction.
// Intentionally NOT marked "use client" so they can be invoked from RSC during SSR
// (e.g. markdown-content.tsx renders <h2 id={slugHeading(...)}> on the server).

export type TocItem = {
  id: string
  text: string
  level: number
}

export function slugHeading(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 80)
}

export function extractToc(markdown: string): TocItem[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^(#{1,3})\s+(.+)$/)
      if (!match) return null
      const text = match[2].replace(/[*_`[\]()]/g, "").trim()
      return { id: slugHeading(text), text, level: match[1].length }
    })
    .filter(Boolean) as TocItem[]
}
