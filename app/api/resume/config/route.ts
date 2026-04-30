import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const fieldLabelMapSchema = z.object({
  sections: z.record(z.string(), z.string().max(64)).optional(),
  fields: z.record(z.string(), z.string().max(64)).optional(),
  ui: z.record(z.string(), z.string().max(64)).optional(),
}).optional()

const configSchema = z.object({
  locale: z.string().max(20).optional(),
  appearance: z.enum(["system", "light", "dark"]).optional(),
  config: z.object({
    sectionOrder: z.array(z.string()).optional(),
    hiddenSections: z.array(z.string()).optional(),
    fieldLabelMap: fieldLabelMapSchema,
    metaTheme: z.record(z.string(), z.string().max(64)).optional(),
  }).optional(),
}).strict()

const NO_STORE = { "Cache-Control": "no-store" }

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => ({}))
  const parsed = configSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", details: parsed.error.issues }, { status: 400, headers: NO_STORE })
  }

  const data = parsed.data

  // Validate hiddenSections doesn't include basics
  if (data.config?.hiddenSections?.includes("basics")) {
    return NextResponse.json({ error: "basics 为必填项，不可隐藏" }, { status: 400, headers: NO_STORE })
  }

  // Validate fieldLabelMap keys are safe (no HTML)
  if (data.config?.fieldLabelMap) {
    const allValues = [
      ...Object.values(data.config.fieldLabelMap.sections ?? {}),
      ...Object.values(data.config.fieldLabelMap.fields ?? {}),
      ...Object.values(data.config.fieldLabelMap.ui ?? {}),
    ]
    for (const v of allValues) {
      if (/<[^>]+>/.test(v)) {
        return NextResponse.json({ error: "字段映射值不能包含 HTML 标签" }, { status: 400, headers: NO_STORE })
      }
    }
  }

  try {
    const updateData: Record<string, unknown> = {}
    if (data.locale !== undefined) updateData.resumeLocale = data.locale || null
    if (data.appearance !== undefined) updateData.resumeAppearance = data.appearance || null
    if (data.config !== undefined) updateData.resumeConfig = data.config || null

    await prisma.resume.upsert({
      where: { userId: session.userId },
      update: updateData,
      create: { userId: session.userId, ...updateData },
    })

    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "保存失败", detail: message }, { status: 500, headers: NO_STORE })
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  try {
    const resume = await prisma.resume.findUnique({
      where: { userId: session.userId },
      select: {
        resumeLocale: true,
        resumeAppearance: true,
        resumeConfig: true,
      },
    })

    if (!resume) {
      return NextResponse.json({
        locale: null,
        appearance: null,
        config: null,
      }, { headers: NO_STORE })
    }

    return NextResponse.json({
      locale: resume.resumeLocale,
      appearance: resume.resumeAppearance,
      config: resume.resumeConfig,
    }, { headers: NO_STORE })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "读取失败", detail: message }, { status: 500, headers: NO_STORE })
  }
}
