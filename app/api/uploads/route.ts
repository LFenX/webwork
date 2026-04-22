import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { USER_QUOTA } from "@/lib/upload"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1"))
  const size = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("size") ?? "20")))
  const skip = (page - 1) * size

  const [items, total, agg] = await Promise.all([
    prisma.upload.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: size,
      select: { id: true, url: true, originalName: true, size: true, mimeType: true, createdAt: true },
    }),
    prisma.upload.count({ where: { userId: session.userId } }),
    prisma.upload.aggregate({ where: { userId: session.userId }, _sum: { size: true } }),
  ])

  return NextResponse.json({
    items,
    total,
    used: agg._sum.size ?? 0,
    quota: USER_QUOTA,
  })
}
