import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { Prisma } from "@/app/generated/prisma/client"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const patchConfigSchema = z.object({
  displayName: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
  category: z.enum(["zh", "en"]).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  defaultLocale: z.string().trim().max(20).optional(),
  defaultAppearance: z.enum(["system", "light", "dark"]).optional(),
  defaultConfig: z.record(z.string(), z.unknown()).optional(),
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const owner = await requireOwner()
  if (!owner) return NextResponse.json({ error: "仅站点所有者可访问" }, { status: 403 })

  const { slug } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = patchConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", details: parsed.error.issues }, { status: 400 })
  }

  const data = parsed.data

  try {
    const updateData: Record<string, unknown> = {}
    if (data.displayName !== undefined) updateData.displayName = data.displayName || null
    if (data.description !== undefined) updateData.description = data.description || null
    if (data.category !== undefined) updateData.category = data.category
    if (data.enabled !== undefined) updateData.enabled = data.enabled
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
    if (data.defaultLocale !== undefined) updateData.defaultLocale = data.defaultLocale || null
    if (data.defaultAppearance !== undefined) updateData.defaultAppearance = data.defaultAppearance || null
    if (data.defaultConfig !== undefined) updateData.defaultConfig = data.defaultConfig as Prisma.InputJsonValue
    updateData.updatedById = owner.userId

    const pkg = `jsonresume-theme-${slug}`

    const updated = await prisma.resumeTemplateConfig.upsert({
      where: { slug },
      create: {
        slug,
        pkg,
        enabled: data.enabled ?? true,
        category: data.category ?? "en",
        sortOrder: data.sortOrder ?? 9999,
        displayName: data.displayName ?? null,
        description: data.description ?? null,
        defaultLocale: data.defaultLocale ?? null,
        defaultAppearance: data.defaultAppearance ?? "system",
        defaultConfig: (data.defaultConfig ?? {}) as Prisma.InputJsonValue,
        updatedById: owner.userId,
      },
      update: updateData,
    })

    return NextResponse.json({ ok: true, config: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "更新失败", detail: message }, { status: 500 })
  }
}
