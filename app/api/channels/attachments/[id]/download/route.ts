import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getChannelForUser, safeChannelStoragePath } from "@/lib/channel-chat"
import { getSession } from "@/lib/session"

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
  const attachment = await prisma.channelAttachment.findUnique({
    where: { id },
    include: { message: { select: { channelId: true } } },
  })
  if (!attachment) return NextResponse.json({ error: "文件不存在" }, { status: 404 })

  const channel = await getChannelForUser(session.userId, attachment.message.channelId)
  if (!channel) return NextResponse.json({ error: "无权限下载文件" }, { status: 403 })

  const filePath = safeChannelStoragePath(attachment.storagePath)
  if (!filePath) return NextResponse.json({ error: "文件路径无效" }, { status: 404 })

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
