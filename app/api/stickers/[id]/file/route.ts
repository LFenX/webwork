import { readFile } from "node:fs/promises"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { canAccessStickerAsset, safeStickerStoragePath } from "@/lib/stickers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const allowed = await canAccessStickerAsset(session.userId, id)
  if (!allowed) return NextResponse.json({ error: "Sticker not found" }, { status: 404 })

  const sticker = await prisma.stickerAsset.findUnique({ where: { id } })
  if (!sticker) return NextResponse.json({ error: "Sticker not found" }, { status: 404 })

  const filePath = safeStickerStoragePath(sticker.storagePath)
  if (!filePath) return NextResponse.json({ error: "Invalid file path" }, { status: 404 })

  const bytes = await readFile(filePath).catch(() => null)
  if (!bytes) return NextResponse.json({ error: "File not found" }, { status: 404 })

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": sticker.mimeType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  })
}
