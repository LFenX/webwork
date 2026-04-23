import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { unlink } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/db"
import { publishUserPageChanged } from "@/lib/realtime-events"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

type Params = { params: Promise<{ id: string }> }

async function getOwnedVersion(id: string, userId: string) {
  return prisma.resumeVersion.findFirst({ where: { id, userId } })
}

export async function PATCH(_: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const version = await getOwnedVersion(id, session.userId)
  if (!version) return NextResponse.json({ error: "版本不存在" }, { status: 404, headers: NO_STORE })

  const resume = await prisma.resume.upsert({
    where: { userId: session.userId },
    update: { mode: "pdf", pdfPath: version.pdfPath },
    create: { userId: session.userId, mode: "pdf", pdfPath: version.pdfPath },
  })
  revalidatePath("/resume")
  revalidatePath("/resume/edit")
  await publishUserPageChanged(session.userId, "resume")
  return NextResponse.json({ ok: true, version, resume }, { headers: NO_STORE })
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const version = await getOwnedVersion(id, session.userId)
  if (!version) return NextResponse.json({ error: "版本不存在" }, { status: 404, headers: NO_STORE })

  const resume = await prisma.resume.findUnique({ where: { userId: session.userId } })
  if (resume?.mode === "pdf" && resume.pdfPath === version.pdfPath) {
    return NextResponse.json({ error: "当前展示版本不能删除，请先切换到其他版本或 Markdown" }, { status: 400, headers: NO_STORE })
  }

  await prisma.resumeVersion.delete({ where: { id: version.id } })
  try {
    const relativePath = version.pdfPath.replace(/^\/+/, "")
    if (relativePath.startsWith("uploads/resumes/")) {
      await unlink(path.join(process.cwd(), "public", relativePath))
    }
  } catch {
    // The database is the source of truth; a missing stale file should not block deletion.
  }
  revalidatePath("/resume")
  revalidatePath("/resume/edit")
  await publishUserPageChanged(session.userId, "resume")
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
