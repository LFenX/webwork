import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const orderSchema = z.array(
  z.object({
    slug: z.string(),
    category: z.enum(["zh", "en"]),
    sortOrder: z.number().int(),
  })
).min(1)

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

export async function PUT(req: NextRequest) {
  const owner = await requireOwner()
  if (!owner) return NextResponse.json({ error: "仅站点所有者可访问" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const parsed = orderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", details: parsed.error.issues }, { status: 400 })
  }

  const items = parsed.data

  try {
    await prisma.$transaction(
      items.map((item) =>
        prisma.resumeTemplateConfig.upsert({
          where: { slug: item.slug },
          create: {
            slug: item.slug,
            pkg: `jsonresume-theme-${item.slug}`,
            enabled: true,
            category: item.category,
            sortOrder: item.sortOrder,
            defaultAppearance: "system",
            defaultConfig: {},
            updatedById: owner.userId,
          },
          update: {
            category: item.category,
            sortOrder: item.sortOrder,
            updatedById: owner.userId,
          },
        })
      )
    )

    return NextResponse.json({ ok: true, count: items.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "排序更新失败", detail: message }, { status: 500 })
  }
}
