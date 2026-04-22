import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const versions = await prisma.resumeVersion.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(versions, { headers: NO_STORE })
}
