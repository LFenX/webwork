import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { getAvailableResumeThemes } from "@/lib/resume/themes"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const themes = getAvailableResumeThemes()
  return NextResponse.json({ themes }, { headers: NO_STORE })
}
