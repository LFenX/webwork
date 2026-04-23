import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import crypto from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/db"
import { createSession, getSession } from "@/lib/session"
import { siteSettingsSchema } from "@/lib/validators"
import { recordActivity } from "@/lib/admin"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

async function saveAvatar(dataUrl?: string | null) {
  if (!dataUrl) return undefined
  const match = dataUrl.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i)
  if (!match) throw new Error("头像图片格式不支持")
  const ext = match[1].toLowerCase().replace("jpeg", "jpg")
  const buffer = Buffer.from(match[2], "base64")
  if (buffer.length > 2 * 1024 * 1024) throw new Error("头像图片不能超过 2MB")

  const dir = path.join(process.cwd(), "public", "uploads", "avatars")
  await mkdir(dir, { recursive: true })
  const fileName = `${crypto.randomUUID()}.${ext}`
  await writeFile(path.join(dir, fileName), buffer)
  return `/uploads/avatars/${fileName}`
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const [settings, user] = await Promise.all([
    prisma.siteSettings.upsert({
      where: { userId: session.userId },
      update: {},
      create: { userId: session.userId },
    }),
    prisma.$queryRaw<Array<{ email: string; displayName: string; bio: string; avatarText: string; avatarUrl: string | null; location: string }>>`
      SELECT email, "displayName", bio, "avatarText", "avatarUrl", location
      FROM "User"
      WHERE id = ${session.userId}
      LIMIT 1
    `.then((rows) => rows[0] ?? null),
  ])

  return NextResponse.json({ ...settings, user }, { headers: NO_STORE })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json()
  const parsed = siteSettingsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400, headers: NO_STORE })

  const { displayName, avatarText, avatarUrl, avatarDataUrl, location, bio, email, ownerName, heroTagline } = parsed.data
  if (email && email !== session.email) {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing && existing.id !== session.userId) {
      return NextResponse.json({ error: "邮箱已被使用" }, { status: 409, headers: NO_STORE })
    }
  }

  const settings = await prisma.siteSettings.upsert({
    where: { userId: session.userId },
    update: {
      ...(ownerName !== undefined ? { ownerName } : {}),
      ...(heroTagline !== undefined ? { heroTagline } : {}),
    },
    create: {
      userId: session.userId,
      ...(ownerName !== undefined ? { ownerName } : {}),
      ...(heroTagline !== undefined ? { heroTagline } : {}),
    },
  })
  const nextDisplayName = displayName ?? null
  const nextAvatarText = avatarText ?? null
  const savedAvatarUrl = await saveAvatar(avatarDataUrl)
  const nextAvatarUrl = savedAvatarUrl ?? avatarUrl ?? null
  const nextLocation = location ?? null
  const nextBio = bio ?? null
  const nextEmail = email ?? null
  await prisma.$executeRaw`
    UPDATE "User"
    SET
      "displayName" = COALESCE(${nextDisplayName}, "displayName"),
      "avatarText" = COALESCE(${nextAvatarText}, "avatarText"),
      "avatarUrl" = COALESCE(${nextAvatarUrl}, "avatarUrl"),
      location = COALESCE(${nextLocation}, location),
      bio = COALESCE(${nextBio}, bio),
      email = COALESCE(${nextEmail}, email)
    WHERE id = ${session.userId}
  `
  const user = { id: session.userId, email: email ?? session.email }

  if (email && email !== session.email) {
    await createSession({ userId: user.id, email: user.email, sessionId: session.sessionId })
  }

  await recordActivity(session.userId, "update_profile", "更新用户信息", req)
  revalidatePath("/")
  revalidatePath("/", "layout")
  return NextResponse.json(settings, { headers: NO_STORE })
}
