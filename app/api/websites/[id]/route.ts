import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { updateWebsiteResourceSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

const USER_SELECT = { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } as const
const FOLDER_SELECT = { id: true, name: true, userId: true } as const

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const resource = await prisma.websiteResource.findFirst({
    where: { id },
    include: {
      user: { select: USER_SELECT },
      folder: { select: FOLDER_SELECT },
    },
  })
  if (!resource) {
    return NextResponse.json({ error: "资源不存在" }, { status: 404, headers: NO_STORE })
  }

  return NextResponse.json(
    {
      ...resource,
      tags: JSON.parse(resource.tags || "[]"),
      createdAt: resource.createdAt.toISOString(),
      updatedAt: resource.updatedAt.toISOString(),
    },
    { headers: NO_STORE }
  )
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const existing = await prisma.websiteResource.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) {
    return NextResponse.json({ error: "资源不存在" }, { status: 404, headers: NO_STORE })
  }

  const body = await req.json().catch(() => null)
  const parsed = updateWebsiteResourceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数错误", detail: parsed.error.flatten() },
      { status: 400, headers: NO_STORE }
    )
  }

  const { tags, url, folderId, ...rest } = parsed.data
  const data: Record<string, unknown> = { ...rest }

  if (tags !== undefined) data.tags = JSON.stringify(tags)
  if (url !== undefined) {
    data.url = url
    try {
      data.domain = new URL(url).hostname
    } catch { /* url validated by Zod */ }
  }
  if (folderId !== undefined) {
    if (folderId) {
      const folder = await prisma.websiteFolder.findFirst({
        where: { id: folderId, userId: session.userId },
        select: { id: true },
      })
      if (!folder) {
        return NextResponse.json({ error: "文件夹不存在" }, { status: 400, headers: NO_STORE })
      }
    }
    data.folderId = folderId || null
  }

  const resource = await prisma.websiteResource.update({
    where: { id },
    data,
    include: {
      user: { select: USER_SELECT },
      folder: { select: FOLDER_SELECT },
    },
  })

  return NextResponse.json(
    {
      ...resource,
      tags: JSON.parse(resource.tags || "[]"),
      createdAt: resource.createdAt.toISOString(),
      updatedAt: resource.updatedAt.toISOString(),
    },
    { headers: NO_STORE }
  )
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const existing = await prisma.websiteResource.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) {
    return NextResponse.json({ error: "资源不存在" }, { status: 404, headers: NO_STORE })
  }

  await prisma.websiteResource.delete({ where: { id } })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
