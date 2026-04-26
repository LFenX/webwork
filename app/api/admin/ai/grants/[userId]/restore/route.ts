import { NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin"
import { updateAIGrantStatus } from "@/lib/ai/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const admin = await requireAdminPermission("manageAI")
    const { userId } = await params
    const grant = await updateAIGrantStatus(admin.id, userId, "active")
    return NextResponse.json({ userId: grant.userId, status: grant.status }, { headers: NO_STORE })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Forbidden" }, { status: 403, headers: NO_STORE })
  }
}
