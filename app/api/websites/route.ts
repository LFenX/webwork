import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { createWebsiteResourceSchema, websiteListQuerySchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

const USER_SELECT = { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } as const
const FOLDER_SELECT = { id: true, name: true, userId: true } as const

export async function GET(req: NextRequest) {
  const parsed = websiteListQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  )
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400, headers: NO_STORE })
  }

  const { page, size, q, tag, folderId, sharedBy, sort } = parsed.data
  const skip = (page - 1) * size

  const where: Record<string, unknown> = { visibility: "public" }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { domain: { contains: q, mode: "insensitive" } },
    ]
  }
  if (tag) {
    where.tags = { contains: tag }
  }
  if (folderId) {
    where.folderId = folderId
  }
  if (sharedBy) {
    where.userId = sharedBy
  }

  const orderBy = sort === "latest" ? { createdAt: "desc" as const } : { createdAt: "desc" as const }

  const [items, total] = await Promise.all([
    prisma.websiteResource.findMany({
      where,
      orderBy,
      skip,
      take: size,
      include: {
        user: { select: USER_SELECT },
        folder: { select: FOLDER_SELECT },
      },
    }),
    prisma.websiteResource.count({ where }),
  ])

  const result = items.map((item) => ({
    ...item,
    tags: JSON.parse(item.tags || "[]") as string[],
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }))

  return NextResponse.json({ items: result, total, page, size }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = createWebsiteResourceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数错误", detail: parsed.error.flatten() },
      { status: 400, headers: NO_STORE }
    )
  }

  const { name, url, description, screenshotUrl, screenshotPositionX, screenshotPositionY, screenshotScale, screenshotFitMode, tags, folderId } = parsed.data

  if (folderId) {
    const folder = await prisma.websiteFolder.findFirst({
      where: { id: folderId, userId: session.userId },
      select: { id: true },
    })
    if (!folder) {
      return NextResponse.json({ error: "文件夹不存在" }, { status: 400, headers: NO_STORE })
    }
  }

  let domain = ""
  try {
    domain = new URL(url).hostname
  } catch { /* url already validated by Zod */ }

  const resource = await prisma.websiteResource.create({
    data: {
      userId: session.userId,
      name,
      url,
      domain,
      description,
      screenshotUrl: screenshotUrl ?? null,
      screenshotPositionX: screenshotPositionX ?? 50,
      screenshotPositionY: screenshotPositionY ?? 50,
      screenshotScale: screenshotScale ?? 100,
      screenshotFitMode: screenshotFitMode ?? "cover",
      tags: JSON.stringify(tags ?? []),
      folderId: folderId ?? null,
    },
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
    { status: 201, headers: NO_STORE }
  )
}
