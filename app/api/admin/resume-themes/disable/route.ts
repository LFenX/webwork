import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { markThemeDisabled, invalidateCompatCache } from "@/lib/resume/theme-compat"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function requireOwner() {
  const session = await getSession()
  if (!session) return null
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  })
  if (user?.role !== "owner") return null
  return session
}

export async function POST(req: NextRequest) {
  const owner = await requireOwner()
  if (!owner) return NextResponse.json({ error: "仅站点所有者可访问" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const themeSlug = typeof body?.themeSlug === "string" ? body.themeSlug : null
  const reason = typeof body?.reason === "string" ? body.reason : "管理员手动禁用"

  if (!themeSlug) {
    return NextResponse.json({ error: "缺少 themeSlug" }, { status: 400 })
  }

  markThemeDisabled(themeSlug, { reason, checkedAt: new Date().toISOString() })
  invalidateCompatCache()

  return NextResponse.json({ ok: true, slug: themeSlug, reason })
}
