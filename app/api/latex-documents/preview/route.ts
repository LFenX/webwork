import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { compilePreviewPdf } from "@/lib/latex/service"
import { normalizeDocConfig } from "@/lib/latex/config-schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST { config } → compiles the template's built-in sample with that config and
// returns the PDF inline (for the live preview in the template modal). The body
// is a fixed sample and the config is validated/clamped, so there is no LaTeX
// injection surface here.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const config = normalizeDocConfig(body?.config ?? null)
  const result = await compilePreviewPdf(config)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })

  return new NextResponse(new Uint8Array(result.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=preview.pdf",
      "Cache-Control": "no-store",
    },
  })
}
