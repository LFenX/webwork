import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { ALLOWED_MIME, MAX_UPLOAD_SIZE, USER_QUOTA, generateFilename } from "@/lib/upload"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const form = await req.formData()
  const file = form.get("file")
  const postId = form.get("postId") as string | null

  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 })
  if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: "invalid_mime" }, { status: 400 })
  if (file.size > MAX_UPLOAD_SIZE) return NextResponse.json({ error: "too_large" }, { status: 413 })

  const agg = await prisma.upload.aggregate({
    where: { userId: session.userId },
    _sum: { size: true },
  })
  if ((agg._sum.size ?? 0) + file.size > USER_QUOTA) {
    return NextResponse.json({ error: "quota_exceeded" }, { status: 413 })
  }

  const filename = generateFilename(file.name)
  const userDir = path.join(process.cwd(), "public", "uploads", session.userId)
  await mkdir(userDir, { recursive: true })
  const buf = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(userDir, filename), buf)

  const url = `/uploads/${session.userId}/${filename}`
  const rec = await prisma.upload.create({
    data: {
      userId: session.userId,
      filename,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      url,
      postId: postId || null,
    },
  })

  return NextResponse.json({ id: rec.id, url, originalName: rec.originalName })
}
