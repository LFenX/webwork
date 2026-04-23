import { readFile } from "node:fs/promises"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { safeStickerStoragePath } from "@/lib/stickers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 })
  const { id } = await params
  const sticker = await prisma.stickerAsset.findFirst({
    where: { id, OR: [{ scope: "public" }, { ownerId: session.userId }] },
  })
  if (!sticker) return NextResponse.json({ error: "表情包不存在" }, { status: 404 })
  const filePath = safeStickerStoragePath(sticker.storagePath)
  if (!filePath) return NextResponse.json({ error: "文件路径无效" }, { status: 404 })
  const bytes = await readFile(filePath).catch(() => null)
  if (!bytes) return NextResponse.json({ error: "文件不存在" }, { status: 404 })
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": sticker.mimeType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  })
}
