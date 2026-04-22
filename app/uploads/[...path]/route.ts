import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MIME_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".webp": "image/webp",
}

function safeUploadPath(segments: string[]) {
  if (
    segments.length === 0 ||
    segments.some((segment) => !segment || segment === "." || segment === ".." || /[\\/]/.test(segment))
  ) {
    return null
  }

  const uploadRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads")
  const filePath = path.join(uploadRoot, ...segments)
  const relative = path.relative(uploadRoot, filePath)
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null
  return filePath
}

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params
  const filePath = safeUploadPath(segments)
  if (!filePath) return NextResponse.json({ error: "not_found" }, { status: 404 })

  try {
    const info = await stat(/*turbopackIgnore: true*/ filePath)
    if (!info.isFile()) return NextResponse.json({ error: "not_found" }, { status: 404 })

    const body = await readFile(/*turbopackIgnore: true*/ filePath)
    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream"
    return new NextResponse(body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(info.size),
        "Content-Type": contentType,
      },
    })
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
}
