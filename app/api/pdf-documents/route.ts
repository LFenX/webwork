import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { listPdfDocumentsForUser } from "@/lib/pdf/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const limit = Number(req.nextUrl.searchParams.get("limit") || 50)
  const conversationId = req.nextUrl.searchParams.get("conversationId") || undefined
  const documents = await listPdfDocumentsForUser(session.userId, { limit, conversationId })
  return NextResponse.json({ documents })
}
