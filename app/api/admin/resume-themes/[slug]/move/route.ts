import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { ensureResumeTemplateConfig } from "@/lib/resume/template-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const moveSchema = z.object({
  targetCategory: z.enum(["zh", "en"]),
}).strict()

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const owner = await requireOwner()
  if (!owner) return NextResponse.json({ error: "仅站点所有者可访问" }, { status: 403 })

  const { slug } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = moveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", details: parsed.error.issues }, { status: 400 })
  }

  const { targetCategory } = parsed.data

  try {
    await ensureResumeTemplateConfig(slug, owner.userId)

    // Find max sortOrder in target category to place at the end
    const siblings = await prisma.resumeTemplateConfig.findMany({
      where: { category: targetCategory },
      select: { sortOrder: true },
      orderBy: { sortOrder: "desc" },
      take: 1,
    })
    const maxSort = siblings[0]?.sortOrder ?? 0
    const newSortOrder = maxSort + 100

    const updated = await prisma.resumeTemplateConfig.update({
      where: { slug },
      data: {
        category: targetCategory,
        sortOrder: newSortOrder,
        updatedById: owner.userId,
      },
    })

    return NextResponse.json({ ok: true, config: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "移动失败", detail: message }, { status: 500 })
  }
}
