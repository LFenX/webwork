import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: websiteId } = await params
  const session = await getSession()

  // Verify website exists and is public
  const website = await prisma.websiteResource.findFirst({
    where: { id: websiteId, visibility: "public" },
    select: { id: true },
  })
  if (!website) {
    return NextResponse.json({ error: "资源不存在" }, { status: 404, headers: NO_STORE })
  }

  // Simple dedup: same user/same website within 30s only counts once
  if (session) {
    const recent = await prisma.websiteVisitLog.findFirst({
      where: {
        websiteId,
        userId: session.userId,
        createdAt: { gte: new Date(Date.now() - 30000) },
      },
      select: { id: true },
    })
    if (recent) {
      return NextResponse.json({ deduped: true }, { headers: NO_STORE })
    }
  }

  await prisma.websiteVisitLog.create({
    data: {
      websiteId,
      userId: session?.userId ?? null,
    },
  })

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
