import { mkdir, writeFile, unlink } from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import {
  DEFAULT_STICKERS,
  STICKER_MAX_SIZE,
  makeStickerFilename,
  safeStickerStoragePath,
  serializeSticker,
  stickerStorageRoot,
} from "@/lib/stickers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })
  const assets = await prisma.stickerAsset.findMany({
    where: { OR: [{ scope: "public" }, { ownerId: session.userId }] },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({
    defaults: DEFAULT_STICKERS,
    custom: assets.filter((item) => item.scope === "custom").map(serializeSticker),
    public: assets.filter((item) => item.scope === "public").map(serializeSticker),
  }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })
  const form = await req.formData()
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0)
  if (files.length === 0) return NextResponse.json({ error: "请选择表情包图片" }, { status: 400, headers: NO_STORE })
  const created = []
  const root = stickerStorageRoot()
  await mkdir(root, { recursive: true })

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "表情包只支持图片或 GIF" }, { status: 400, headers: NO_STORE })
    }
    if (file.size > STICKER_MAX_SIZE) {
      return NextResponse.json({ error: "单个表情包不能超过 5MB" }, { status: 413, headers: NO_STORE })
    }
    const filename = makeStickerFilename(file.name || "sticker")
    const storagePath = path.join(session.userId, filename)
    const userDir = path.join(root, session.userId)
    await mkdir(userDir, { recursive: true })
    await writeFile(path.join(userDir, filename), Buffer.from(await file.arrayBuffer()))
    const sticker = await prisma.stickerAsset.create({
      data: {
        scope: "custom",
        ownerId: session.userId,
        uploaderId: session.userId,
        name: file.name || "表情包",
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

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "缺少表情包 id" }, { status: 400, headers: NO_STORE })
  const sticker = await prisma.stickerAsset.findFirst({ where: { id, ownerId: session.userId, scope: "custom" } })
  if (!sticker) return NextResponse.json({ error: "表情包不存在" }, { status: 404, headers: NO_STORE })
  await prisma.stickerAsset.delete({ where: { id } })
  const filePath = safeStickerStoragePath(sticker.storagePath)
  if (filePath) await unlink(filePath).catch(() => null)
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
