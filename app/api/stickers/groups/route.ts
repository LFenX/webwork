import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { serializeSticker } from "@/lib/stickers"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const groups = await prisma.stickerGroup.findMany({
    where: { ownerId: session.userId },
    include: {
      entries: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          sortOrder: true,
          sticker: {
            include: {
              owner: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
              uploader: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
            },
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      scope: g.scope,
      sortOrder: g.sortOrder,
      stickers: g.entries.map((e) => ({
        ...serializeSticker(e.sticker),
        contributor: (e.sticker.owner ?? e.sticker.uploader)
          ? {
              id: (e.sticker.owner ?? e.sticker.uploader)!.id,
              email: (e.sticker.owner ?? e.sticker.uploader)!.email,
              displayName: (e.sticker.owner ?? e.sticker.uploader)!.displayName,
              avatarText: (e.sticker.owner ?? e.sticker.uploader)!.avatarText,
              avatarUrl: (e.sticker.owner ?? e.sticker.uploader)!.avatarUrl,
            }
          : null,
      })),
    })),
  }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const form = await req.formData()
  const action = String(form.get("action") ?? "").trim()

  // ── Create group ──
  if (action === "create") {
    const name = String(form.get("name") ?? "").trim()
    const scope = String(form.get("scope") ?? "custom").trim()
    if (!name || name.length > 20) {
      return NextResponse.json({ error: "分组名称需要1-20个字符" }, { status: 400, headers: NO_STORE })
    }
    if (scope !== "custom" && scope !== "public") {
      return NextResponse.json({ error: "无效的分组范围" }, { status: 400, headers: NO_STORE })
    }
    const existing = await prisma.stickerGroup.findFirst({
      where: { ownerId: session.userId, name, scope },
    })
    if (existing) {
      return NextResponse.json({ error: "已存在同名分组" }, { status: 409, headers: NO_STORE })
    }
    const count = await prisma.stickerGroup.count({ where: { ownerId: session.userId, scope } })
    const group = await prisma.stickerGroup.create({
      data: { ownerId: session.userId, name, scope, sortOrder: count },
    })
    return NextResponse.json({ group }, { status: 201, headers: NO_STORE })
  }

  // ── Rename group ──
  if (action === "rename") {
    const groupId = String(form.get("groupId") ?? "").trim()
    const name = String(form.get("name") ?? "").trim()
    if (!name || name.length > 20) {
      return NextResponse.json({ error: "分组名称需要1-20个字符" }, { status: 400, headers: NO_STORE })
    }
    const group = await prisma.stickerGroup.findFirst({
      where: { id: groupId, ownerId: session.userId },
    })
    if (!group) return NextResponse.json({ error: "分组不存在" }, { status: 404, headers: NO_STORE })
    const dup = await prisma.stickerGroup.findFirst({
      where: { ownerId: session.userId, name, scope: group.scope, id: { not: groupId } },
    })
    if (dup) return NextResponse.json({ error: "已存在同名分组" }, { status: 409, headers: NO_STORE })
    const updated = await prisma.stickerGroup.update({ where: { id: groupId }, data: { name } })
    return NextResponse.json({ group: updated }, { headers: NO_STORE })
  }

  // ── Delete group ──
  if (action === "delete") {
    const groupId = String(form.get("groupId") ?? "").trim()
    const group = await prisma.stickerGroup.findFirst({
      where: { id: groupId, ownerId: session.userId },
    })
    if (!group) return NextResponse.json({ error: "分组不存在" }, { status: 404, headers: NO_STORE })
    await prisma.stickerGroup.delete({ where: { id: groupId } })
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  }

  // ── Add stickers to group ──
  if (action === "add-stickers") {
    const groupId = String(form.get("groupId") ?? "").trim()
    const stickerIds = [...new Set(form.getAll("stickerIds").map((v) => String(v).trim()).filter(Boolean))]
    if (stickerIds.length === 0) {
      return NextResponse.json({ error: "请选择要添加的表情" }, { status: 400, headers: NO_STORE })
    }
    const group = await prisma.stickerGroup.findFirst({
      where: { id: groupId, ownerId: session.userId },
    })
    if (!group) return NextResponse.json({ error: "分组不存在" }, { status: 404, headers: NO_STORE })

    const stickers = await prisma.stickerAsset.findMany({
      where: { id: { in: stickerIds }, ownerId: session.userId, scope: group.scope },
      select: { id: true },
    })
    if (stickers.length === 0) {
      return NextResponse.json({ error: "没有符合条件的表情" }, { status: 400, headers: NO_STORE })
    }

    const maxEntry = await prisma.stickerGroupEntry.findFirst({
      where: { groupId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    })
    let nextSort = (maxEntry?.sortOrder ?? -1) + 1

    let added = 0
    for (const s of stickers) {
      try {
        await prisma.stickerGroupEntry.create({
          data: { groupId, stickerId: s.id, sortOrder: nextSort++ },
        })
        added++
      } catch {
        // duplicate, skip
      }
    }
    return NextResponse.json({ addedCount: added }, { status: 201, headers: NO_STORE })
  }

  // ── Remove stickers from group ──
  if (action === "remove-stickers") {
    const groupId = String(form.get("groupId") ?? "").trim()
    const stickerIds = [...new Set(form.getAll("stickerIds").map((v) => String(v).trim()).filter(Boolean))]
    if (stickerIds.length === 0) {
      return NextResponse.json({ error: "请选择要移出的表情" }, { status: 400, headers: NO_STORE })
    }
    const group = await prisma.stickerGroup.findFirst({
      where: { id: groupId, ownerId: session.userId },
    })
    if (!group) return NextResponse.json({ error: "分组不存在" }, { status: 404, headers: NO_STORE })
    await prisma.stickerGroupEntry.deleteMany({
      where: { groupId, stickerId: { in: stickerIds } },
    })
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400, headers: NO_STORE })
}
