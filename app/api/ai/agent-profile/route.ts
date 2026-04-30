import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { getSession } from "@/lib/session"
import { updateAgentProfileSchema } from "@/lib/validators"
import { getOrCreateAgentProfile, updateAgentProfile } from "@/lib/ai/agent-profile-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

async function saveAgentAvatar(dataUrl?: string | null) {
  if (!dataUrl) return undefined
  const match = dataUrl.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i)
  if (!match) throw new Error("Unsupported avatar image format")
  const ext = match[1].toLowerCase().replace("jpeg", "jpg")
  const buffer = Buffer.from(match[2], "base64")
  if (buffer.length > 2 * 1024 * 1024) throw new Error("Avatar image must be under 2MB")

  const dir = path.join(process.cwd(), "public", "uploads", "avatars")
  await mkdir(dir, { recursive: true })
  const fileName = `${crypto.randomUUID()}.${ext}`
  await writeFile(path.join(dir, fileName), buffer)
  return `/uploads/avatars/${fileName}`
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const profile = await getOrCreateAgentProfile(session.userId)
  return NextResponse.json(profile, { headers: NO_STORE })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = updateAgentProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", detail: parsed.error.flatten() }, { status: 400, headers: NO_STORE })
  }

  const { avatarDataUrl, avatarUrl, ...rest } = parsed.data
  let resolvedAvatarUrl: string | null | undefined
  try {
    const saved = await saveAgentAvatar(avatarDataUrl ?? undefined)
    if (saved !== undefined) resolvedAvatarUrl = saved
    else if (avatarUrl !== undefined) resolvedAvatarUrl = avatarUrl
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "头像保存失败" }, { status: 400, headers: NO_STORE })
  }

  await updateAgentProfile(session.userId, {
    ...rest,
    ...(resolvedAvatarUrl !== undefined ? { avatarUrl: resolvedAvatarUrl } : {}),
  })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
