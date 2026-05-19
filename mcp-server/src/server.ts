#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { registerPostTools } from "./tools/posts.js"
import { registerFolderTools } from "./tools/folders.js"
import { registerCommentTools } from "./tools/comments.js"
import { registerUploadTools } from "./tools/uploads.js"
import { getCurrentUser } from "./context.js"
import { prisma } from "./prisma.js"

// All logging MUST go to stderr. Stdout is reserved for JSON-RPC framing.
function log(msg: string) {
  process.stderr.write(`[mcp-server] ${msg}\n`)
}

async function main() {
  const user = await getCurrentUser()
  log(`Bound to user ${user.email} (id=${user.id})`)

  const server = new McpServer({
    name: "blog",
    version: "0.1.0",
  })

  registerPostTools(server)
  registerFolderTools(server)
  registerCommentTools(server)
  registerUploadTools(server)

  const transport = new StdioServerTransport()
  await server.connect(transport)
  log("MCP server connected over stdio. Awaiting tool calls.")
}

async function shutdown(signal: string) {
  log(`Received ${signal}, shutting down.`)
  try {
    await prisma.$disconnect()
  } catch {
    /* ignore */
  }
  process.exit(0)
}

process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("SIGTERM", () => void shutdown("SIGTERM"))

main().catch((err) => {
  log(`Fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
  process.exit(1)
})
