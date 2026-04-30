import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { getResumeContent } from "@/lib/mdx"
import { renderResumeHtml } from "@/lib/resume/renderer"
import { buildDefaultResumeJson } from "@/lib/resume/default-resume"
import { prisma } from "@/lib/db"
import type { ResumeJson } from "@/lib/resume/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const resume = await getResumeContent(session.userId)
  let resumeJson = (resume.resumeJson ?? null) as ResumeJson | null

  if (!resumeJson) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { displayName: true, email: true, bio: true, location: true },
    })
    resumeJson = buildDefaultResumeJson(user ?? {})
  }

  const result = await renderResumeHtml({
    resumeJson,
    selectedTheme: resume.selectedTheme ?? null,
  })

  return NextResponse.json(result, { headers: NO_STORE })
}
