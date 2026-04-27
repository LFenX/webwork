import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const [topVisitedRaw, topContributorsRaw] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{id: string, name: string, domain: string, "screenshotUrl": string | null, cnt: bigint}>>(
      `SELECT wr.id, wr.name, wr.domain, wr."screenshotUrl", COUNT(*)::bigint as cnt FROM "WebsiteVisitLog" vl JOIN "WebsiteResource" wr ON wr.id = vl."websiteId" WHERE wr.visibility = 'public' GROUP BY wr.id ORDER BY cnt DESC LIMIT 5`
    ),
    prisma.$queryRawUnsafe<Array<{id: string, "displayName": string, "avatarText": string, "avatarUrl": string | null, cnt: bigint}>>(
      `SELECT u.id, u."displayName", u."avatarText", u."avatarUrl", COUNT(*)::bigint as cnt FROM "WebsiteResource" wr JOIN "User" u ON u.id = wr."userId" WHERE wr.visibility = 'public' GROUP BY u.id ORDER BY cnt DESC LIMIT 5`
    ),
  ])

  const topVisited = topVisitedRaw.map(r => ({
    id: r.id,
    name: r.name,
    domain: r.domain,
    screenshotUrl: r.screenshotUrl,
    visitCount: Number(r.cnt),
  }))

  const topContributors = topContributorsRaw.map(r => ({
    user: {
      id: r.id,
      displayName: r.displayName,
      avatarText: r.avatarText,
      avatarUrl: r.avatarUrl,
    },
    websiteCount: Number(r.cnt),
  }))

  // Aggregate contributors for filter use
  const allContributors = await prisma.$queryRawUnsafe<Array<{id: string, "displayName": string, "avatarText": string, "avatarUrl": string | null, cnt: bigint}>>(
    `SELECT u.id, u."displayName", u."avatarText", u."avatarUrl", COUNT(*)::bigint as cnt FROM "WebsiteResource" wr JOIN "User" u ON u.id = wr."userId" WHERE wr.visibility = 'public' GROUP BY u.id ORDER BY cnt DESC LIMIT 50`
  )

  return NextResponse.json({
    topVisited,
    topContributors,
    contributors: allContributors.map(r => ({
      id: r.id,
      displayName: r.displayName,
      avatarText: r.avatarText,
      avatarUrl: r.avatarUrl,
      websiteCount: Number(r.cnt),
    })),
  }, { headers: NO_STORE })
}
