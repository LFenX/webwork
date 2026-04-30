import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { ensureResumeTemplateConfig } from "@/lib/resume/template-config"

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const owner = await requireOwner()
  if (!owner) return NextResponse.json({ error: "仅站点所有者可访问" }, { status: 403 })

  const { slug } = await params

  try {
    await ensureResumeTemplateConfig(slug, owner.userId)

    const updated = await prisma.resumeTemplateConfig.update({
      where: { slug },
      data: { enabled: true, updatedById: owner.userId },
    })

    return NextResponse.json({ ok: true, enabled: updated.enabled })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "启用失败", detail: message }, { status: 500 })
  }
}
