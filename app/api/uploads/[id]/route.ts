import { NextRequest, NextResponse } from "next/server"
import { unlink } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await params
  const upload = await prisma.upload.findFirst({ where: { id, userId: session.userId } })
  if (!upload) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const diskPath = path.join(process.cwd(), "public", upload.url)
  try {
    await unlink(diskPath)
  } catch {
    // file already gone, continue
  }

  await prisma.upload.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
