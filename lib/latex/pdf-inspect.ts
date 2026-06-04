import "server-only"
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import type { LastBodySnapshot } from "@/lib/latex/body-snapshot"

// Lightweight reverse-inspection of a compiled PDF (page count + extracted text)
// via PyMuPDF, used to verify a restyle didn't drop content. BEST-EFFORT: returns
// null when Python/fitz is unavailable so callers fall back to source-level
// guarantees (we only ever compile a known, structured body).

function resolvePython(): { command: string; argsPrefix: string[] } {
  const configured = process.env.PDF_PARSER_PYTHON?.trim()
  if (configured) {
    const parts = configured.split(/\s+/)
    return { command: parts[0], argsPrefix: parts.slice(1) }
  }
  const venv = path.join(process.cwd(), ".venv-pdf", "Scripts", "python.exe")
  if (existsSync(venv)) return { command: venv, argsPrefix: [] }
  return { command: "py", argsPrefix: ["-3.12"] }
}

export type PdfInspection = { pageCount: number; text: string }

const FITZ_CODE =
  "import sys,json\n" +
  "try:\n" +
  " import fitz\n" +
  " d=fitz.open(sys.argv[1]); t=''.join(p.get_text() for p in d)\n" +
  " print(json.dumps({'pageCount':d.page_count,'text':t}))\n" +
  "except Exception:\n" +
  " print('null')\n"

export async function inspectPdf(pdfPath: string, timeoutMs = 20000): Promise<PdfInspection | null> {
  const { command, argsPrefix } = resolvePython()
  return new Promise((resolve) => {
    let out = ""
    let done = false
    const finish = (v: PdfInspection | null) => {
      if (!done) {
        done = true
        resolve(v)
      }
    }
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(command, [...argsPrefix, "-c", FITZ_CODE, pdfPath], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PYTHONUTF8: "1" },
      })
    } catch {
      return finish(null)
    }
    const timer = setTimeout(() => {
      child.kill()
      finish(null)
    }, timeoutMs)
    child.stdout?.on("data", (c) => {
      out += c.toString()
    })
    child.on("error", () => {
      clearTimeout(timer)
      finish(null)
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      if (code !== 0) return finish(null)
      try {
        const line = out.trim().split(/\r?\n/).pop() || "null"
        const j = JSON.parse(line)
        if (!j) return finish(null)
        finish({ pageCount: Number(j.pageCount) || 0, text: String(j.text ?? "") })
      } catch {
        finish(null)
      }
    })
  })
}

// Heuristic: did a restyled PDF lose the content of its source snapshot? Returns a
// reason string when content looks lost, else null. Compares the rendered text
// against the snapshot's section titles (restyle reuses the SAME body, so titles
// must survive) and guards the "cover/TOC only" case.
export function detectRestyleContentLoss(insp: PdfInspection, snap: LastBodySnapshot): string | null {
  const text = insp.text.replace(/\s+/g, "")
  // Cover/TOC-only: a structured doc collapsed to almost no body text.
  if (snap.sectionCount >= 1 && text.length < 120) return "rendered_text_empty"
  if (snap.sectionCount >= 3 && insp.pageCount <= 1) return "single_page_collapse"
  // Section titles from the reused body must mostly appear in the rendered text.
  if (snap.sectionTitles.length > 0) {
    const found = snap.sectionTitles.filter((t) => {
      const key = t.replace(/\s+/g, "")
      return key.length > 0 && text.includes(key)
    }).length
    if (found < Math.ceil(snap.sectionTitles.length * 0.6)) return "section_titles_missing"
  }
  return null
}
