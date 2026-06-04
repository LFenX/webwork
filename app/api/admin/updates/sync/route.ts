import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdminPermission } from "@/lib/admin"
import { syncUpdateLogSnapshot } from "@/lib/update-log"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(req: NextRequest) {
  try {
    await requireAdminPermission("manageUpdateLogs")
    const body = await req.json().catch(() => null) as { limit?: number } | null
    const result = await syncUpdateLogSnapshot(body?.limit ?? 80)
    revalidatePath("/updates")
    return NextResponse.json(result, { status: result.ok ? 200 : 207, headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "无权同步更新日志" }, { status: 403, headers: NO_STORE })
  }
}
