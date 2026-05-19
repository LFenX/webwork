// Spawns the MCP server and exchanges a minimal handshake + tools/list
// over stdio. Prints the tool names so you can verify everything registered.
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const serverPath = path.join(here, "..", "src", "server.ts")

const child = spawn("npx", ["tsx", serverPath], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env },
  shell: process.platform === "win32",
})

let buf = ""
const pending = new Map()
let nextId = 1

function send(method, params) {
  const id = nextId++
  const msg = { jsonrpc: "2.0", id, method, params }
  child.stdin.write(JSON.stringify(msg) + "\n")
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`timeout waiting for ${method}`))
      }
    }, 8000)
  })
}

child.stdout.setEncoding("utf8")
child.stdout.on("data", (chunk) => {
  buf += chunk
  let nl
  while ((nl = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, nl).trim()
    buf = buf.slice(nl + 1)
    if (!line) continue
    try {
      const m = JSON.parse(line)
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id)
        pending.delete(m.id)
        if (m.error) p.reject(new Error(JSON.stringify(m.error)))
        else p.resolve(m.result)
      }
    } catch {
      /* ignore non-JSON */
    }
  }
})

try {
  const initResult = await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoketest", version: "0" },
  })
  console.log("initialize ok:", initResult.serverInfo)
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n")
  const list = await send("tools/list", {})
  console.log("tools/list ok. tool names:")
  for (const t of list.tools) console.log(" -", t.name)
} catch (err) {
  console.error("SMOKETEST FAILED:", err.message)
  child.kill()
  process.exit(1)
}

child.kill()
process.exit(0)
