import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  return NextResponse.json(
    { ok: false, code: "NOT_IMPLEMENTED", error: "PDF 导出即将支持" },
    { status: 501, headers: NO_STORE }
  )
}
