import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }
const PAGE_SIZE = 50

function readPage(req: NextRequest) {
  const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? PAGE_SIZE)
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : PAGE_SIZE, 1), PAGE_SIZE)
  const rawCursor = Number(req.nextUrl.searchParams.get("cursor") ?? 0)
  const offset = Math.max(Number.isFinite(rawCursor) ? rawCursor : 0, 0)
  return { limit, offset }
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { limit, offset } = readPage(req)
    const rows = await prisma.userActivity.findMany({
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit + 1,
      select: {
        id: true,
        action: true,
        detail: true,
        ipAddress: true,
        geoLocation: true,
        deviceInfo: true,
        createdAt: true,
        user: { select: { email: true, displayName: true } },
      },
    })
    const items = rows.slice(0, limit)
    return NextResponse.json({
      items,
      nextCursor: rows.length > limit ? String(offset + items.length) : null,
      hasMore: rows.length > limit,
    }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  }
}
