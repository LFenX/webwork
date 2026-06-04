import "server-only"
import { spawn } from "node:child_process"
import { LATEX_COMPILE_TIMEOUT_MS, resolveXelatexCommand } from "@/lib/latex/config"

type XelatexResult = { code: number | null, stdout: string, stderr: string }

// Run a single XeLaTeX pass inside the isolated build directory. Shell escape is
// disabled (`-no-shell-escape`): no template or AI-authored body needs it — code
// blocks use `listings` (pure TeX), not `minted`. Disabling it removes the shell
// execution surface entirely, so a body can no longer run external commands even
// if it slips past the sanitizer. We still constrain the run with a build-dir
// cwd, a hard timeout, and -halt-on-error.
export function runXelatexPass(buildDir: string, texFile: string): Promise<XelatexResult> {
  const command = resolveXelatexCommand()
  const args = [
    "-interaction=nonstopmode",
    "-halt-on-error",
    "-no-shell-escape",
    texFile,
  ]

  return new Promise<XelatexResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: buildDir,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONUTF8: "1", max_print_line: "1000" },
    })

    let stdout = ""
    let stderr = ""
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error(`LaTeX compile timed out after ${LATEX_COMPILE_TIMEOUT_MS}ms`))
    }, LATEX_COMPILE_TIMEOUT_MS)

    child.stdout.on("data", (chunk) => { stdout += chunk.toString() })
    child.stderr.on("data", (chunk) => { stderr += chunk.toString() })
    child.on("error", (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on("close", (code) => {
      clearTimeout(timeout)
      resolve({ code, stdout, stderr })
    })
  })
}
