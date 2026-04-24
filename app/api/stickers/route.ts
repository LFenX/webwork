import { copyFile, mkdir, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import {
  DEFAULT_STICKERS,
  STICKER_MAX_SIZE,
  canAccessStickerAsset,
  makeStickerFilename,
  safeStickerStoragePath,
  serializeSticker,
  stickerStorageRoot,
} from "@/lib/stickers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

type StickerRecord = {
  id: string
  scope: string
  ownerId: string | null
  uploaderId: string | null
  name: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  storagePath: string
  isAnimated: boolean
  createdAt: Date
  owner: {
    id: string
    email: string
    displayName: string
    avatarText: string
    avatarUrl: string | null
  } | null
  uploader: {
    id: string
    email: string
    displayName: string
    avatarText: string
    avatarUrl: string | null
  } | null
}

function serializeStickerWithContributor(sticker: StickerRecord) {
  const contributor = sticker.owner ?? sticker.uploader
  return {
    ...serializeSticker(sticker),
    contributor: contributor
      ? {
          id: contributor.id,
          email: contributor.email,
          displayName: contributor.displayName,
          avatarText: contributor.avatarText,
          avatarUrl: contributor.avatarUrl,
        }
      : null,
  }
}

function groupPublicStickers(stickers: StickerRecord[]) {
  const groups = new Map<string, ReturnType<typeof serializeStickerWithContributor>[]>()
  const contributors = new Map<string, NonNullable<ReturnType<typeof serializeStickerWithContributor>["contributor"]>>()

  for (const sticker of stickers) {
    const serialized = serializeStickerWithContributor(sticker)
    const contributor = serialized.contributor ?? {
      id: `community-${sticker.id}`,
      email: "",
      displayName: "社区表情",
      avatarText: "社区",
      avatarUrl: null,
    }
    const key = contributor.id
    contributors.set(key, contributor)
    groups.set(key, [...(groups.get(key) ?? []), serialized])
  }

  return [...groups.entries()].map(([key, items]) => ({
    contributor: contributors.get(key)!,
    stickers: items,
  }))
}

async function copyStickerAsCustom(sourceStickerId: string, userId: string) {
  const source = await prisma.stickerAsset.findUnique({
    where: { id: sourceStickerId },
    select: {
      id: true,
      scope: true,
      ownerId: true,
      uploaderId: true,
      name: true,
      filename: true,
      originalName: true,
      mimeType: true,
      size: true,
      storagePath: true,
      isAnimated: true,
    },
  })
  if (!source) {
    throw new Error("Sticker not found")
  }

  const allowed = source.scope === "public" || source.ownerId === userId
    ? true
    : await canAccessStickerAsset(userId, sourceStickerId)
  if (!allowed) {
    throw new Error("Sticker not found")
  }

  if (source.scope === "custom" && source.ownerId === userId) {
    return { added: false, deduped: true }
  }

  const existing = await prisma.stickerAsset.findFirst({
    where: {
      ownerId: userId,
      scope: "custom",
      originalName: source.originalName,
      mimeType: source.mimeType,
      size: source.size,
    },
    orderBy: { createdAt: "desc" },
  })
  if (existing) {
    return { added: false, deduped: true }
  }

  const sourceFilePath = safeStickerStoragePath(source.storagePath)
  if (!sourceFilePath) {
    throw new Error("Sticker file is unavailable")
  }

  const filename = makeStickerFilename(source.originalName || source.filename || "sticker")
  const storagePath = path.join(userId, filename)
  const root = stickerStorageRoot()
  const userDir = path.join(root, userId)
  await mkdir(userDir, { recursive: true })
  await copyFile(sourceFilePath, path.join(userDir, filename))

  await prisma.stickerAsset.create({
    data: {
      scope: "custom",
      ownerId: userId,
      uploaderId: userId,
      name: source.name || source.originalName || "表情",
      filename,
      originalName: source.originalName || "sticker",
      mimeType: source.mimeType || "image/png",
      size: source.size,
      storagePath,
      isAnimated: source.isAnimated,
    },
  })

  return { added: true, deduped: false }
}

async function copyStickerAsPublic(sourceStickerId: string, userId: string) {
  const source = await prisma.stickerAsset.findFirst({
    where: { id: sourceStickerId, ownerId: userId, scope: "custom" },
    select: {
      id: true,
      name: true,
      filename: true,
      originalName: true,
      mimeType: true,
      size: true,
      storagePath: true,
      isAnimated: true,
    },
  })
  if (!source) {
    throw new Error("Only your custom stickers can be contributed")
  }

  const existing = await prisma.stickerAsset.findFirst({
    where: {
      scope: "public",
      ownerId: userId,
      originalName: source.originalName,
      mimeType: source.mimeType,
      size: source.size,
    },
    orderBy: { createdAt: "desc" },
  })
  if (existing) {
    return { added: false, deduped: true }
  }

  const sourceFilePath = safeStickerStoragePath(source.storagePath)
  if (!sourceFilePath) {
    throw new Error("Sticker file is unavailable")
  }

  const filename = makeStickerFilename(source.originalName || source.filename || "sticker")
  const storagePath = path.join("public", userId, filename)
  const root = stickerStorageRoot()
  const publicDir = path.join(root, "public", userId)
  await mkdir(publicDir, { recursive: true })
  await copyFile(sourceFilePath, path.join(publicDir, filename))

  await prisma.stickerAsset.create({
    data: {
      scope: "public",
      ownerId: userId,
      uploaderId: userId,
      name: source.name || source.originalName || "表情",
      filename,
      originalName: source.originalName || "sticker",
      mimeType: source.mimeType || "image/png",
      size: source.size,
      storagePath,
      isAnimated: source.isAnimated,
    },
  })

  return { added: true, deduped: false }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const assets = await prisma.stickerAsset.findMany({
    where: { OR: [{ scope: "public" }, { ownerId: session.userId }] },
    include: {
      owner: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
      uploader: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  })

  const customAssets = assets.filter((item) => item.scope === "custom")
  const publicAssets = assets.filter((item) => item.scope === "public")

  return NextResponse.json({
    defaults: DEFAULT_STICKERS,
    custom: customAssets.map(serializeStickerWithContributor),
    public: publicAssets.map(serializeStickerWithContributor),
    publicGroups: groupPublicStickers(publicAssets),
  }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const form = await req.formData()
  const action = String(form.get("action") ?? "").trim()
  const sourceStickerId = String(form.get("sourceStickerId") ?? "").trim() || null
  const sourceStickerIds = [...new Set(form.getAll("sourceStickerIds").map((value) => String(value).trim()).filter(Boolean))]
  const contributeStickerIds = [...new Set(form.getAll("contributeStickerIds").map((value) => String(value).trim()).filter(Boolean))]
  const deleteStickerIds = [...new Set(form.getAll("deleteStickerIds").map((value) => String(value).trim()).filter(Boolean))]
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0)
  const root = stickerStorageRoot()
  await mkdir(root, { recursive: true })

  if (action === "save-to-custom" || sourceStickerIds.length > 0) {
    const ids = sourceStickerIds.length > 0 ? sourceStickerIds : sourceStickerId ? [sourceStickerId] : []
    if (ids.length === 0) {
      return NextResponse.json({ error: "请选择要添加的表情" }, { status: 400, headers: NO_STORE })
    }
    let addedCount = 0
    let dedupedCount = 0
    for (const id of ids) {
      const result = await copyStickerAsCustom(id, session.userId)
      if (result.added) addedCount += 1
      if (result.deduped) dedupedCount += 1
    }
    return NextResponse.json({ addedCount, dedupedCount }, { status: 201, headers: NO_STORE })
  }

  if (action === "contribute-to-public" || contributeStickerIds.length > 0) {
    if (contributeStickerIds.length === 0) {
      return NextResponse.json({ error: "请选择要贡献的表情" }, { status: 400, headers: NO_STORE })
    }
    let addedCount = 0
    let dedupedCount = 0
    for (const id of contributeStickerIds) {
      const result = await copyStickerAsPublic(id, session.userId)
      if (result.added) addedCount += 1
      if (result.deduped) dedupedCount += 1
    }
    return NextResponse.json({ addedCount, dedupedCount }, { status: 201, headers: NO_STORE })
  }

  if (action === "delete-custom" || deleteStickerIds.length > 0) {
    if (deleteStickerIds.length === 0) {
      return NextResponse.json({ error: "请选择要删除的表情" }, { status: 400, headers: NO_STORE })
    }
    const stickers = await prisma.stickerAsset.findMany({
      where: {
        id: { in: deleteStickerIds },
        ownerId: session.userId,
        scope: "custom",
      },
    })
    await prisma.stickerAsset.deleteMany({
      where: {
        id: { in: stickers.map((item) => item.id) },
        ownerId: session.userId,
        scope: "custom",
      },
    })
    await Promise.all(
      stickers.map(async (sticker) => {
        const filePath = safeStickerStoragePath(sticker.storagePath)
        if (filePath) await unlink(filePath).catch(() => null)
      })
    )
    return NextResponse.json({ deletedCount: stickers.length }, { headers: NO_STORE })
  }

  if (sourceStickerId) {
    const result = await copyStickerAsCustom(sourceStickerId, session.userId)
    return NextResponse.json({ addedCount: result.added ? 1 : 0, dedupedCount: result.deduped ? 1 : 0 }, { status: 201, headers: NO_STORE })
  }

  if (files.length === 0) return NextResponse.json({ error: "请选择表情图片" }, { status: 400, headers: NO_STORE })

  const created = []
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "表情只支持图片或 GIF" }, { status: 400, headers: NO_STORE })
    }
    if (file.size > STICKER_MAX_SIZE) {
      return NextResponse.json({ error: "单个表情不能超过 5MB" }, { status: 413, headers: NO_STORE })
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
        name: file.name || "表情",
        filename,
        originalName: file.name || "sticker",
        mimeType: file.type || "image/png",
        size: file.size,
        storagePath,
        isAnimated: file.type === "image/gif",
      },
      include: {
        owner: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
        uploader: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
      },
    })
    created.push(serializeStickerWithContributor(sticker))
  }

  return NextResponse.json({ items: created }, { status: 201, headers: NO_STORE })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "缺少表情 id" }, { status: 400, headers: NO_STORE })

  const sticker = await prisma.stickerAsset.findFirst({
    where: { id, ownerId: session.userId, scope: "custom" },
  })
  if (!sticker) return NextResponse.json({ error: "表情不存在" }, { status: 404, headers: NO_STORE })

  await prisma.stickerAsset.delete({ where: { id } })
  const filePath = safeStickerStoragePath(sticker.storagePath)
  if (filePath) await unlink(filePath).catch(() => null)

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
