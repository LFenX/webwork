import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { resumeSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"
import { publishUserPageChanged } from "@/lib/realtime-events"
import { getSession } from "@/lib/session"
import { parseResumeJson } from "@/lib/resume/schema"
import { getAvailableResumeThemes } from "@/lib/resume/themes"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const resume = await prisma.resume.upsert({
    where: { userId: session.userId },
    update: {},
    create: { userId: session.userId },
  })
  return NextResponse.json(resume, { headers: NO_STORE })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json()
  const parsed = resumeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误", details: parsed.error.issues }, { status: 400, headers: NO_STORE })

  // Validate resumeJson if provided
  if (parsed.data.resumeJson !== undefined && parsed.data.resumeJson !== null) {
    const validated = parseResumeJson(parsed.data.resumeJson)
    if (!validated.ok) {
      return NextResponse.json({ error: "resumeJson 校验失败", issues: validated.issues }, { status: 400, headers: NO_STORE })
    }
  }

  // Validate selectedTheme against available themes
  if (parsed.data.selectedTheme !== undefined && parsed.data.selectedTheme !== null) {
    const themes = getAvailableResumeThemes()
    const availableSlugs = new Set(themes.filter((t) => t.available).map((t) => t.slug))
    if (!availableSlugs.has(parsed.data.selectedTheme)) {
      return NextResponse.json({ error: "未知主题" }, { status: 400, headers: NO_STORE })
    }
  }

  if (parsed.data.mode === "pdf" && parsed.data.pdfPath) {
    const ownedVersion = await prisma.resumeVersion.findFirst({
      where: { userId: session.userId, pdfPath: parsed.data.pdfPath },
      select: { id: true },
    })
    if (!ownedVersion) {
      return NextResponse.json({ error: "PDF 版本不存在或不属于当前用户" }, { status: 400, headers: NO_STORE })
    }
  }

  // Build update data: strip undefined fields
  const updateData: Record<string, unknown> = {}
  if (parsed.data.mode !== undefined) updateData.mode = parsed.data.mode
  if (parsed.data.content !== undefined) updateData.content = parsed.data.content
  if (parsed.data.pdfPath !== undefined) updateData.pdfPath = parsed.data.pdfPath
  if (parsed.data.resumeJson !== undefined) updateData.resumeJson = parsed.data.resumeJson
  if (parsed.data.selectedTheme !== undefined) updateData.selectedTheme = parsed.data.selectedTheme

  const resume = await prisma.resume.upsert({
    where: { userId: session.userId },
    update: updateData,
    create: { userId: session.userId, ...updateData },
  })
  revalidatePath("/resume")
  revalidatePath("/resume/edit")
  await publishUserPageChanged(session.userId, "resume")
  return NextResponse.json(resume, { headers: NO_STORE })
}
