import "server-only"
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { PDF_MAX_PAGES, PDF_PARSE_QUALITY, PDF_PARSE_TIMEOUT_MS, getPdfParserScriptPath } from "@/lib/pdf/config"

type RunPdfParserParams = {
  inputPath: string
  outputDir: string
  quality?: string
}

function splitCommand(value: string) {
  const parts = value.match(/"[^"]+"|'[^']+'|\S+/g) ?? []
  return parts.map((part) => part.replace(/^["']|["']$/g, ""))
}

function resolvePythonInvocation() {
  const configured = process.env.PDF_PARSER_PYTHON?.trim()
  if (configured) {
    const [command, ...argsPrefix] = splitCommand(configured)
    return { command, argsPrefix }
  }

  const localVenv = path.join(process.cwd(), ".venv-pdf", "Scripts", "python.exe")
  if (existsSync(localVenv)) return { command: localVenv, argsPrefix: [] as string[] }

  return { command: "py", argsPrefix: ["-3.12"] }
}

export async function runPdfParser(params: RunPdfParserParams) {
  const { command, argsPrefix } = resolvePythonInvocation()
  const scriptPath = getPdfParserScriptPath()
  const args = [
    ...argsPrefix,
    scriptPath,
    "--input",
    params.inputPath,
    "--output-dir",
    params.outputDir,
    "--quality",
    params.quality || PDF_PARSE_QUALITY,
    "--max-pages",
    String(PDF_MAX_PAGES),
  ]

  return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONUTF8: "1",
      },
    })

    let stdout = ""
    let stderr = ""
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error(`PDF parser timed out after ${PDF_PARSE_TIMEOUT_MS}ms`))
    }, PDF_PARSE_TIMEOUT_MS)

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("error", (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on("close", (code) => {
      clearTimeout(timeout)
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(new Error(`PDF parser exited with code ${code}: ${stderr || stdout}`))
    })
  })
}
