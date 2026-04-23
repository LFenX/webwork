import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { STICKER_MAX_SIZE, makeStickerFilename, serializeSticker, stickerStorageRoot } from "@/lib/stickers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const admin = await requireAdminPermission("manageStickers").catch(() => null)
  if (!admin) return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  const items = await prisma.stickerAsset.findMany({ where: { scope: "public" }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ items: items.map(serializeSticker) }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminPermission("manageStickers").catch(() => null)
  if (!admin) return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  const form = await req.formData()
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0)
  if (files.length === 0) return NextResponse.json({ error: "请选择表情包图片" }, { status: 400, headers: NO_STORE })
  const root = path.join(stickerStorageRoot(), "public")
  await mkdir(root, { recursive: true })
  const created = []
  for (const file of files) {
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "表情包只支持图片或 GIF" }, { status: 400, headers: NO_STORE })
    if (file.size > STICKER_MAX_SIZE) return NextResponse.json({ error: "单个表情包不能超过 5MB" }, { status: 413, headers: NO_STORE })
    const filename = makeStickerFilename(file.name || "sticker")
    const storagePath = path.join("public", filename)
    await writeFile(path.join(root, filename), Buffer.from(await file.arrayBuffer()))
    const sticker = await prisma.stickerAsset.create({
      data: {
        scope: "public",
        uploaderId: admin.id,
        name: file.name || "公用表情包",
        filename,
        originalName: file.name || "sticker",
        mimeType: file.type || "image/png",
        size: file.size,
        storagePath,
        isAnimated: file.type === "image/gif",
      },
    })
    created.push(serializeSticker(sticker))
  }
  return NextResponse.json({ items: created }, { status: 201, headers: NO_STORE })
}
