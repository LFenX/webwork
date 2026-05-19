import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { prisma } from "../prisma.js"
import { getCurrentUser } from "../context.js"
import { fail, ok } from "../util.js"

export function registerCommentTools(server: McpServer) {
  server.registerTool(
    "list_comments",
    {
      title: "List comments on the current user's posts",
      description:
        "List comments. By default returns the 50 most recent across all of the current user's posts. Pass `postId` to scope to one post.",
      inputSchema: {
        postId: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(200).optional().default(50),
      },
    },
    async (args) => {
      const user = await getCurrentUser()

      if (args.postId) {
        const owns = await prisma.post.findFirst({
          where: { id: args.postId, userId: user.id },
          select: { id: true },
        })
        if (!owns) return fail(`Post not found or not yours: ${args.postId}`)
      }

      const comments = await prisma.comment.findMany({
        where: args.postId
          ? { postId: args.postId }
          : { post: { userId: user.id } },
        orderBy: { createdAt: "desc" },
        take: args.limit ?? 50,
        select: {
          id: true,
          postId: true,
          parentId: true,
          content: true,
          stickerEmoji: true,
          authorId: true,
          author: { select: { displayName: true, email: true } },
          createdAt: true,
        },
      })
      return ok(
        comments.map((c) => ({
          id: c.id,
          postId: c.postId,
          parentId: c.parentId,
          content: c.content,
          stickerEmoji: c.stickerEmoji,
          author: {
            id: c.authorId,
            displayName: c.author?.displayName ?? "",
            email: c.author?.email ?? "",
          },
          createdAt: c.createdAt.toISOString(),
        })),
      )
    },
  )

  server.registerTool(
    "delete_comment",
    {
      title: "Delete a comment",
      description:
        "Delete a comment. Allowed only when the comment is on one of your posts OR you authored it.",
      inputSchema: {
        commentId: z.string().min(1),
      },
    },
    async (args) => {
      const user = await getCurrentUser()
      const comment = await prisma.comment.findUnique({
        where: { id: args.commentId },
        select: { id: true, authorId: true, post: { select: { userId: true } } },
      })
      if (!comment) return fail(`Comment not found: ${args.commentId}`)
      if (comment.authorId !== user.id && comment.post.userId !== user.id) {
        return fail("Not allowed: this comment is not on your post and you didn't author it.")
      }
      await prisma.comment.delete({ where: { id: args.commentId } })
      return ok({ ok: true, deletedId: args.commentId })
    },
  )
}
