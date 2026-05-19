import { z } from "zod"
import { mkdir, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes } from "node:crypto"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { prisma } from "../prisma.js"
import { getCurrentUser } from "../context.js"
import { fail, ok } from "../util.js"

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024
const USER_QUOTA = 200 * 1024 * 1024
const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
}

/**
 * Resolve the public uploads directory.
 *
 * - In production, the Next.js app serves `/uploads/*` from `<repoRoot>/public/uploads`.
 * - We default to `<repoRoot>/public/uploads` by walking up from this file.
 * - Override with UPLOADS_DIR if the deployment writes elsewhere.
 */
function getUploadsRoot(): string {
  if (process.env.UPLOADS_DIR) return process.env.UPLOADS_DIR
  // src/tools/uploads.ts -> ../../../public/uploads (3 levels up: tools -> src -> mcp-server -> repo root)
  // Use fileURLToPath so Windows drive letters survive (.pathname gives `/D:/...` which breaks path.resolve).
  return fileURLToPath(new URL("../../../public/uploads", import.meta.url))
}

function generateFilename(ext: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  return `${date}-${randomBytes(4).toString("hex")}${ext}`
}

export function registerUploadTools(server: McpServer) {
  server.registerTool(
    "upload_image",
    {
      title: "Upload an image",
      description:
        "Upload a single image (PNG/JPEG/WebP/GIF, max 5 MB). Pass the file as base64. Returns the public URL (`/uploads/<userId>/<filename>`) you can paste into post markdown as `![alt](url)`. Optionally bind it to a post via `postId`.",
      inputSchema: {
        filename: z
          .string()
          .min(1)
          .max(255)
          .describe("Original filename, including extension. Used to derive mime type."),
        mimeType: z
          .enum(["image/png", "image/jpeg", "image/webp", "image/gif"])
          .describe("Must be one of PNG / JPEG / WebP / GIF."),
        dataBase64: z
          .string()
          .min(1)
          .describe("Raw file bytes encoded as base64 (no `data:` prefix)."),
        postId: z
          .string()
          .min(1)
          .optional()
          .describe("Optionally link the upload to a post. Must be your own post."),
      },
    },
    async (args) => {
      const user = await getCurrentUser()

      const ext = MIME_TO_EXT[args.mimeType]
      if (!ext) return fail(`Unsupported mime type: ${args.mimeType}`)

      let buf: Buffer
      try {
        buf = Buffer.from(args.dataBase64, "base64")
      } catch (err) {
        return fail("Invalid base64 payload", err instanceof Error ? err.message : err)
      }
      if (buf.length === 0) return fail("Empty file")
      if (buf.length > MAX_UPLOAD_SIZE)
        return fail(`File too large: ${buf.length} bytes (max ${MAX_UPLOAD_SIZE}).`)

      if (args.postId) {
        const owns = await prisma.post.findFirst({
          where: { id: args.postId, userId: user.id },
          select: { id: true },
        })
        if (!owns) return fail(`Post not found or not yours: ${args.postId}`)
      }

      const agg = await prisma.upload.aggregate({
        where: { userId: user.id },
        _sum: { size: true },
      })
      if ((agg._sum.size ?? 0) + buf.length > USER_QUOTA) {
        return fail(
          `Quota exceeded: ${(agg._sum.size ?? 0) + buf.length} > ${USER_QUOTA} (200 MB).`,
        )
      }

      const filename = generateFilename(ext)
      const userDir = path.join(getUploadsRoot(), user.id)
      await mkdir(userDir, { recursive: true })
      const diskPath = path.join(userDir, filename)
      await writeFile(diskPath, buf)

      const url = `/uploads/${user.id}/${filename}`
      let rec
      try {
        rec = await prisma.upload.create({
          data: {
            userId: user.id,
            filename,
            originalName: args.filename,
            mimeType: args.mimeType,
            size: buf.length,
            url,
            postId: args.postId ?? null,
          },
        })
      } catch (err) {
        // Roll back the on-disk file so we don't leak orphans when the DB write fails.
        await unlink(diskPath).catch(() => {})
        return fail(
          "Saved file to disk but failed to insert Upload row; rolled back.",
          err instanceof Error ? err.message : err,
        )
      }

      return ok({
        id: rec.id,
        url,
        markdown: `![${args.filename}](${url})`,
        originalName: rec.originalName,
        size: rec.size,
        mimeType: rec.mimeType,
        postId: rec.postId,
      })
    },
  )

  server.registerTool(
    "list_uploads",
    {
      title: "List your uploads",
      description:
        "List uploads owned by the current user. Optionally filter by `postId`. Useful for finding URLs of images you've already uploaded.",
      inputSchema: {
        postId: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(200).optional().default(50),
      },
    },
    async (args) => {
      const user = await getCurrentUser()
      const uploads = await prisma.upload.findMany({
        where: { userId: user.id, ...(args.postId ? { postId: args.postId } : {}) },
        orderBy: { createdAt: "desc" },
        take: args.limit ?? 50,
        select: {
          id: true,
          filename: true,
          originalName: true,
          mimeType: true,
          size: true,
          url: true,
          postId: true,
          createdAt: true,
        },
      })
      return ok(
        uploads.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
      )
    },
  )

  server.registerTool(
    "delete_upload",
    {
      title: "Delete an upload record",
      description:
        "Delete an upload row. NOTE: the underlying file on disk is NOT removed (mirrors the existing Next.js behavior). The image URL will 404 only after the file is removed manually.",
      inputSchema: {
        id: z.string().min(1),
      },
    },
    async (args) => {
      const user = await getCurrentUser()
      const upload = await prisma.upload.findFirst({
        where: { id: args.id, userId: user.id },
        select: { id: true, url: true },
      })
      if (!upload) return fail(`Upload not found: ${args.id}`)
      await prisma.upload.delete({ where: { id: args.id } })
      return ok({ ok: true, deletedId: upload.id, url: upload.url })
    },
  )
}
