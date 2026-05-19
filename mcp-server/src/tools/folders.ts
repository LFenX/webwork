import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { prisma } from "../prisma.js"
import { getCurrentUser } from "../context.js"
import { fail, ok } from "../util.js"

const POST_TYPES = ["blog", "daily", "reflections", "notes"] as const
const COVER_FIT = ["auto", "manual"] as const

const baseFolderShape = {
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).optional().default(""),
  coverImageUrl: z.string().trim().max(500).optional().default(""),
  coverPositionX: z.number().int().min(0).max(100).optional().default(50),
  coverPositionY: z.number().int().min(0).max(100).optional().default(50),
  coverOpacity: z.number().int().min(0).max(100).optional().default(100),
  coverFitMode: z.enum(COVER_FIT).optional().default("auto"),
  coverScale: z.number().int().min(40).max(240).optional().default(100),
}

export function registerFolderTools(server: McpServer) {
  server.registerTool(
    "list_folders",
    {
      title: "List article folders",
      description:
        "List the current user's folders for a given post type. Each item includes `postCount`.",
      inputSchema: {
        type: z.enum(POST_TYPES),
      },
    },
    async (args) => {
      const user = await getCurrentUser()
      const folders = await prisma.articleFolder.findMany({
        where: { userId: user.id, type: args.type },
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { posts: true } } },
      })
      return ok(
        folders.map((f) => ({
          id: f.id,
          type: f.type,
          name: f.name,
          description: f.description,
          coverImageUrl: f.coverImageUrl,
          coverPositionX: f.coverPositionX,
          coverPositionY: f.coverPositionY,
          coverOpacity: f.coverOpacity,
          coverFitMode: f.coverFitMode,
          coverScale: f.coverScale,
          postCount: f._count.posts,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
        })),
      )
    },
  )

  server.registerTool(
    "create_folder",
    {
      title: "Create an article folder",
      description: "Create a folder scoped to a single post type (blog/daily/reflections/notes).",
      inputSchema: {
        type: z.enum(POST_TYPES),
        ...baseFolderShape,
      },
    },
    async (args) => {
      const user = await getCurrentUser()
      const folder = await prisma.articleFolder.create({
        data: {
          userId: user.id,
          type: args.type,
          name: args.name,
          description: args.description ?? "",
          coverImageUrl: args.coverImageUrl ?? "",
          coverPositionX: args.coverPositionX ?? 50,
          coverPositionY: args.coverPositionY ?? 50,
          coverOpacity: args.coverOpacity ?? 100,
          coverFitMode: args.coverFitMode ?? "auto",
          coverScale: args.coverScale ?? 100,
        },
      })
      return ok(folder)
    },
  )

  server.registerTool(
    "update_folder",
    {
      title: "Update an article folder",
      description:
        "Patch a folder. You cannot change its `type` (delete and recreate if you need to move it across post types).",
      inputSchema: {
        id: z.string().min(1),
        name: z.string().trim().min(1).max(60).optional(),
        description: z.string().trim().max(200).optional(),
        coverImageUrl: z.string().trim().max(500).optional(),
        coverPositionX: z.number().int().min(0).max(100).optional(),
        coverPositionY: z.number().int().min(0).max(100).optional(),
        coverOpacity: z.number().int().min(0).max(100).optional(),
        coverFitMode: z.enum(COVER_FIT).optional(),
        coverScale: z.number().int().min(40).max(240).optional(),
      },
    },
    async (args) => {
      const user = await getCurrentUser()
      const existing = await prisma.articleFolder.findFirst({
        where: { id: args.id, userId: user.id },
      })
      if (!existing) return fail(`Folder not found: ${args.id}`)

      const { id, ...rest } = args
      const data: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) data[k] = v
      }
      const folder = await prisma.articleFolder.update({ where: { id }, data })
      return ok(folder)
    },
  )

  server.registerTool(
    "delete_folder",
    {
      title: "Delete an article folder",
      description:
        "Delete a folder. Posts inside are NOT deleted — they become folder-less (folderId set to null).",
      inputSchema: {
        id: z.string().min(1),
      },
    },
    async (args) => {
      const user = await getCurrentUser()
      const existing = await prisma.articleFolder.findFirst({
        where: { id: args.id, userId: user.id },
      })
      if (!existing) return fail(`Folder not found: ${args.id}`)

      await prisma.$transaction([
        prisma.post.updateMany({
          where: { folderId: args.id, userId: user.id },
          data: { folderId: null },
        }),
        prisma.articleFolder.delete({ where: { id: args.id } }),
      ])
      return ok({ ok: true, deleted: { id: existing.id, name: existing.name, type: existing.type } })
    },
  )
}
