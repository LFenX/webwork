import { NextRequest, NextResponse } from "next/server"
import { readFile, unlink } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { deletePdfArtifactsForUpload } from "@/lib/pdf/service"
import { LATEX_PDF_KIND, LATEX_PDF_TTL_MS } from "@/lib/latex/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Friendly page shown when a generated (ephemeral) PDF has expired or been cleared.
function clearedResponse() {
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>资源已清除</title></head>` +
    `<body style="margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center">` +
    `<div style="max-width:420px;padding:32px;text-align:center;background:#fff;border-radius:18px;box-shadow:0 10px 30px rgba(15,23,42,.08)">` +
    `<div style="font-size:40px;line-height:1">🗂️</div>` +
    `<h1 style="font-size:18px;margin:14px 0 8px">该资源已被清除</h1>` +
    `<p style="font-size:14px;color:#64748b;margin:0">生成的 PDF 超过 1 天已自动删除，请让蝶灵重新生成一份。</p>` +
    `</div></body></html>`
  return new NextResponse(html, {
    status: 410,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  })
}

function resolveStoredPath(upload: { url: string, storagePath: string | null }) {
  if (upload.storagePath) {
    const storageRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), "storage")
    const relativePath = upload.storagePath.replace(/^storage[\\/]/i, "").split(/[\\/]+/).filter(Boolean)
    const diskPath = path.join(storageRoot, ...relativePath)
    if (!path.resolve(diskPath).startsWith(path.resolve(storageRoot))) throw new Error("INVALID_STORAGE_PATH")
    return diskPath
  }

  const normalizedUrl = upload.url.replace(/^\/+/, "").split("/").join(path.sep)
  const publicRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), "public")
  const diskPath = path.join(publicRoot, normalizedUrl)
  if (!path.resolve(diskPath).startsWith(path.resolve(publicRoot))) throw new Error("INVALID_PUBLIC_PATH")
  return diskPath
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await params
  const upload = await prisma.upload.findFirst({ where: { id, userId: session.userId } })
  if (!upload) return NextResponse.json({ error: "not_found" }, { status: 404 })
  if (upload.kind !== "pdf" && upload.kind !== LATEX_PDF_KIND) {
    return NextResponse.redirect(new URL(upload.url, _req.url))
  }

  // Generated PDFs are ephemeral: enforce the TTL and clear the file lazily.
  if (upload.kind === LATEX_PDF_KIND) {
    const expired = Date.now() - upload.createdAt.getTime() > LATEX_PDF_TTL_MS
    if (!upload.storagePath || expired) {
      if (upload.storagePath) {
        await unlink(resolveStoredPath(upload)).catch(() => { /* already gone */ })
        await prisma.upload.update({ where: { id: upload.id }, data: { storagePath: null, size: 0 } }).catch(() => undefined)
      }
      return clearedResponse()
    }
  }

  const diskPath = resolveStoredPath(upload)
  const data = await readFile(diskPath).catch(() => null)
  if (!data) {
    return upload.kind === LATEX_PDF_KIND
      ? clearedResponse()
      : NextResponse.json({ error: "file_missing" }, { status: 404 })
  }

  const encodedName = encodeURIComponent(upload.originalName)
  return new NextResponse(data, {
    headers: {
      "Content-Type": upload.mimeType || "application/pdf",
      "Content-Length": String(data.byteLength),
      "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await params
  const upload = await prisma.upload.findFirst({ where: { id, userId: session.userId } })
  if (!upload) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const diskPath = resolveStoredPath(upload)
  try {
    await unlink(diskPath)
  } catch {
    // file already gone, continue
  }

  // Remove parsed PDF outputs on disk before the row (and its chunk/embedding
  // cascade) is deleted; the cascade cannot reach the on-disk artifacts.
  if (upload.kind === "pdf") {
    await deletePdfArtifactsForUpload(session.userId, upload.id)
  }

  await prisma.upload.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
