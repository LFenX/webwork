import { getPublicUpdateSummaries } from "@/lib/update-log"

export const dynamic = "force-dynamic"

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export async function GET() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")
  const { items } = await getPublicUpdateSummaries({ limit: 30 })
  const updated = items[0]?.committedAt ?? new Date().toISOString()
  const entries = items.map((item) => {
    const url = `${siteUrl}/updates?change=${encodeURIComponent(item.hash)}`
    return `
      <entry>
        <title>${xmlEscape(item.title)}</title>
        <id>${xmlEscape(url)}</id>
        <link href="${xmlEscape(url)}" />
        <updated>${item.committedAt}</updated>
        <summary>${xmlEscape(`类型：${item.changeType}；影响：${item.modules.join("、") || "网站"}；文件：${item.fileCount}`)}</summary>
      </entry>`
  }).join("")

  const body = `<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>网站建设日志</title>
      <id>${xmlEscape(`${siteUrl}/updates/feed.xml`)}</id>
      <link href="${xmlEscape(`${siteUrl}/updates`)}" />
      <link href="${xmlEscape(`${siteUrl}/updates/feed.xml`)}" rel="self" />
      <updated>${updated}</updated>
      ${entries}
    </feed>`

  return new Response(body.trim(), {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
