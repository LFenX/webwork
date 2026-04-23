import { unlink } from "node:fs/promises"
import { NextRequest, NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { safeStickerStoragePath } from "@/lib/stickers"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminPermission("manageStickers").catch(() => null)
  if (!admin) return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  const { id } = await params
  const sticker = await prisma.stickerAsset.findFirst({ where: { id, scope: "public" } })
  if (!sticker) return NextResponse.json({ error: "表情包不存在" }, { status: 404, headers: NO_STORE })
  await prisma.stickerAsset.delete({ where: { id } })
  const filePath = safeStickerStoragePath(sticker.storagePath)
  if (filePath) await unlink(filePath).catch(() => null)
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
