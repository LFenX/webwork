import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { USER_QUOTA, generateFilename, getUploadKind, getUploadMaxSize, isAllowedUploadFile, isPdfFileLike } from "@/lib/upload"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const form = await req.formData()
  const file = form.get("file")
  const postId = form.get("postId") as string | null

  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 })
  if (!isAllowedUploadFile(file)) return NextResponse.json({ error: "invalid_mime" }, { status: 400 })
  if (file.size > getUploadMaxSize(file)) return NextResponse.json({ error: "too_large" }, { status: 413 })

  const agg = await prisma.upload.aggregate({
    where: { userId: session.userId },
    _sum: { size: true },
  })
  if ((agg._sum.size ?? 0) + file.size > USER_QUOTA) {
    return NextResponse.json({ error: "quota_exceeded" }, { status: 413 })
  }

  const filename = generateFilename(file.name)
  const buf = Buffer.from(await file.arrayBuffer())
  const sha256 = createHash("sha256").update(buf).digest("hex")
  const kind = getUploadKind(file)

  if (kind === "pdf" && !buf.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
    return NextResponse.json({ error: "invalid_pdf" }, { status: 400 })
  }

  if (!isPdfFileLike(file)) {
    const userDir = path.join(process.cwd(), "public", "uploads", session.userId)
    await mkdir(userDir, { recursive: true })
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
        sha256,
        kind,
        postId: postId || null,
      },
    })

    return NextResponse.json({ id: rec.id, uploadId: rec.id, url, originalName: rec.originalName, mimeType: rec.mimeType, size: rec.size })
  }

  const userDir = path.join(process.cwd(), "storage", "uploads", session.userId)
  await mkdir(userDir, { recursive: true })
  const storagePath = path.join("storage", "uploads", session.userId, filename)
  await writeFile(path.join(process.cwd(), storagePath), buf)

  const rec = await prisma.upload.create({
    data: {
      userId: session.userId,
      filename,
      originalName: file.name,
      mimeType: "application/pdf",
      size: file.size,
      url: "",
      storagePath,
      sha256,
      kind,
      postId: postId || null,
    },
  })
  const url = `/api/uploads/${rec.id}`
  const [updated, pdfDocument] = await prisma.$transaction([
    prisma.upload.update({
      where: { id: rec.id },
      data: { url },
    }),
    prisma.pdfDocument.create({
      data: {
        userId: session.userId,
        uploadId: rec.id,
        status: "queued",
        quality: "highest",
        title: file.name,
        sha256,
      },
    }),
  ])

  return NextResponse.json({
    id: updated.id,
    uploadId: updated.id,
    url: updated.url,
    originalName: updated.originalName,
    mimeType: updated.mimeType,
    size: updated.size,
    pdfDocumentId: pdfDocument.id,
    parseStatus: pdfDocument.status,
  })
}
