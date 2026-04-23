import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { safeChatStoragePath } from "@/lib/chat"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function contentDisposition(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "")
  return `attachment; filename="${fallback || "download"}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 })

  const { id } = await params
  const attachment = await prisma.chatAttachment.findUnique({
    where: { id },
    include: { message: { select: { senderId: true, receiverId: true } } },
  })
  if (!attachment) return NextResponse.json({ error: "文件不存在" }, { status: 404 })

  const allowed = attachment.message.senderId === session.userId || attachment.message.receiverId === session.userId
  if (!allowed) return NextResponse.json({ error: "无权下载该文件" }, { status: 403 })

  const filePath = safeChatStoragePath(attachment.storagePath)
  if (!filePath) return NextResponse.json({ error: "文件不存在" }, { status: 404 })

  try {
    const info = await stat(/*turbopackIgnore: true*/ filePath)
    if (!info.isFile()) return NextResponse.json({ error: "文件不存在" }, { status: 404 })
    const body = await readFile(/*turbopackIgnore: true*/ filePath)
    return new NextResponse(body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(attachment.originalName),
        "Content-Length": String(info.size),
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    const name = path.basename(filePath)
    return NextResponse.json({ error: `${name} 不存在` }, { status: 404 })
  }
}
