import { z } from "zod"
import { unlink } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { prisma } from "../prisma.js"
import { getCurrentUser } from "../context.js"
import { fail, ok, parseTags, slugify, withRandomSuffix } from "../util.js"

function getPublicRoot(): string {
  if (process.env.UPLOADS_DIR) {
    // UPLOADS_DIR points at <root>/public/uploads — the parent is <root>/public.
    return path.dirname(process.env.UPLOADS_DIR)
  }
  // src/tools/posts.ts -> ../../../public
  return fileURLToPath(new URL("../../../public", import.meta.url))
}

const POST_TYPES = ["blog", "daily", "reflections", "notes"] as const
const VISIBILITY = ["private", "friends", "public"] as const

const postTypeSchema = z.enum(POST_TYPES)
const visibilitySchema = z.enum(VISIBILITY)

type SerializablePost = {
  id: string
  type: string
  slug: string
  title: string
  summary: string
  tags: string
  content: string
  visibility: string
  folderId: string | null
  date: Date | string
  createdAt: Date | string
  updatedAt: Date | string
}

/** Ensure (userId, type, slug) is unique; append random suffix on collision. */
async function ensureUniqueSlug(
  userId: string,
  type: (typeof POST_TYPES)[number],
  desired: string,
): Promise<string> {
  let slug = desired
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.post.findFirst({
      where: { userId, type, slug },
      select: { id: true },
    })
    if (!clash) return slug
    slug = withRandomSuffix(desired)
  }
  return withRandomSuffix(desired)
}

function serializePost(post: SerializablePost) {
  return {
    id: post.id,
    type: post.type,
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    tags: parseTags(post.tags),
    content: post.content,
    visibility: post.visibility,
    folderId: post.folderId,
    date: post.date instanceof Date ? post.date.toISOString() : post.date,
    createdAt: post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt,
    updatedAt: post.updatedAt instanceof Date ? post.updatedAt.toISOString() : post.updatedAt,
  }
}

export function registerPostTools(server: McpServer) {
  server.registerTool(
    "list_posts",
    {
      title: "List posts",
      description:
        "List the current user's posts. Optionally filter by post type (blog/daily/reflections/notes), search term, folder, or visibility. Returns metadata only (no `content` field) to keep responses small; use `get_post` to read the full body.",
      inputSchema: {
        type: postTypeSchema.optional().describe("Restrict to one post type."),
        q: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe("Case-insensitive substring match on title and summary."),
        folderId: z
          .string()
          .nullable()
          .optional()
          .describe(
            "Pass a folder id to filter; pass null to only return posts without a folder.",
          ),
        visibility: visibilitySchema.optional(),
        limit: z.number().int().min(1).max(200).optional().default(50),
      },
    },
    async (args) => {
      const user = await getCurrentUser()
      const where: Record<string, unknown> = { userId: user.id }
      if (args.type) where.type = args.type
      if (args.visibility) where.visibility = args.visibility
      if (args.folderId === null) where.folderId = null
      else if (args.folderId !== undefined) where.folderId = args.folderId
      if (args.q) {
        where.OR = [
          { title: { contains: args.q, mode: "insensitive" } },
          { summary: { contains: args.q, mode: "insensitive" } },
        ]
      }

      const posts = await prisma.post.findMany({
        where,
        orderBy: { date: "desc" },
        take: args.limit ?? 50,
        select: {
          id: true,
          type: true,
          slug: true,
          title: true,
          summary: true,
          tags: true,
          date: true,
          visibility: true,
          folderId: true,
          updatedAt: true,
        },
      })

      return ok(
        posts.map((p) => ({
          ...p,
          tags: parseTags(p.tags),
          date: p.date.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        })),
      )
    },
  )

  server.registerTool(
    "get_post",
    {
      title: "Get a post",
      description:
        "Fetch a single post by id (must belong to the current user). Returns the full body including markdown `content`.",
      inputSchema: {
        id: z.string().min(1),
      },
    },
    async (args) => {
      const user = await getCurrentUser()
      const post = await prisma.post.findFirst({
        where: { id: args.id, userId: user.id },
      })
      if (!post) return fail(`Post not found: ${args.id}`)
      return ok(serializePost(post))
    },
  )

  server.registerTool(
    "create_post",
    {
      title: "Create a post",
      description:
        "Write a new article. `type` is one of blog/daily/reflections/notes. `slug` will be auto-generated from the title if omitted; collisions get a random suffix. `content` is markdown.",
      inputSchema: {
        type: postTypeSchema,
        title: z.string().min(1).max(200),
        slug: z.string().min(1).max(80).optional(),
        summary: z.string().max(500).optional().default(""),
        tags: z.array(z.string().max(40)).max(20).optional().default([]),
        content: z.string().optional().default(""),
        date: z
          .string()
          .optional()
          .describe("ISO date or datetime string. Defaults to now."),
        visibility: visibilitySchema.optional().default("private"),
        folderId: z.string().nullable().optional(),
      },
    },
    async (args) => {
      const user = await getCurrentUser()

      if (args.folderId) {
        const folder = await prisma.articleFolder.findFirst({
          where: { id: args.folderId, userId: user.id, type: args.type },
          select: { id: true },
        })
        if (!folder)
          return fail(
            `Folder ${args.folderId} does not exist or belongs to a different post type.`,
          )
      }

      const desiredSlug = args.slug?.trim() || slugify(args.title)
      const slug = await ensureUniqueSlug(user.id, args.type, desiredSlug)

      const post = await prisma.post.create({
        data: {
          userId: user.id,
          type: args.type,
          slug,
          title: args.title,
          summary: args.summary ?? "",
          tags: JSON.stringify(args.tags ?? []),
          content: args.content ?? "",
          date: args.date ? new Date(args.date) : new Date(),
          visibility: args.visibility ?? "private",
          folderId: args.folderId ?? null,
        },
      })
      return ok(serializePost(post))
    },
  )

  server.registerTool(
    "update_post",
    {
      title: "Update a post",
      description:
        "Patch fields on an existing post. Only fields you pass are updated. To clear the folder, pass `folderId: null`.",
      inputSchema: {
        id: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        summary: z.string().max(500).optional(),
        tags: z.array(z.string().max(40)).max(20).optional(),
        content: z.string().optional(),
        date: z.string().optional(),
        visibility: visibilitySchema.optional(),
        folderId: z.string().nullable().optional(),
      },
    },
    async (args) => {
      const user = await getCurrentUser()
      const existing = await prisma.post.findFirst({
        where: { id: args.id, userId: user.id },
      })
      if (!existing) return fail(`Post not found: ${args.id}`)

      if (args.folderId) {
        const folder = await prisma.articleFolder.findFirst({
          where: { id: args.folderId, userId: user.id, type: existing.type },
          select: { id: true },
        })
        if (!folder)
          return fail(
            `Folder ${args.folderId} does not exist or belongs to a different post type than this post (${existing.type}).`,
          )
      }

      const data: Record<string, unknown> = {}
      if (args.title !== undefined) data.title = args.title
      if (args.summary !== undefined) data.summary = args.summary
      if (args.content !== undefined) data.content = args.content
      if (args.tags !== undefined) data.tags = JSON.stringify(args.tags)
      if (args.date !== undefined) data.date = new Date(args.date)
      if (args.visibility !== undefined) data.visibility = args.visibility
      if (args.folderId !== undefined) data.folderId = args.folderId

      const post = await prisma.post.update({ where: { id: args.id }, data })
      return ok(serializePost(post))
    },
  )

  server.registerTool(
    "delete_post",
    {
      title: "Delete a post",
      description:
        "Delete a post (and its comments — cascade via FK) by id. Upload rows that referenced this post are kept (postId is just a soft tag), but the underlying files attached to this post are removed from disk to match the Next.js DELETE /api/posts/[id] behavior.",
      inputSchema: {
        id: z.string().min(1),
      },
    },
    async (args) => {
      const user = await getCurrentUser()
      const post = await prisma.post.findFirst({
        where: { id: args.id, userId: user.id },
        select: { id: true, type: true, slug: true },
      })
      if (!post) return fail(`Post not found: ${args.id}`)

      const uploads = await prisma.upload.findMany({
        where: { postId: args.id, userId: user.id },
        select: { id: true, url: true },
      })

      await prisma.post.delete({ where: { id: args.id } })

      const publicRoot = getPublicRoot()
      let filesRemoved = 0
      for (const up of uploads) {
        // up.url looks like "/uploads/<userId>/<filename>"; map to disk under public/.
        const rel = up.url.replace(/^\/+/, "")
        const abs = path.join(publicRoot, rel)
        try {
          await unlink(abs)
          filesRemoved += 1
        } catch {
          /* already gone — fine */
        }
      }

      return ok({ ok: true, deleted: post, uploadsScanned: uploads.length, filesRemoved })
    },
  )
}
