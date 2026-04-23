import { NextRequest, NextResponse } from "next/server"
import { recordActivity, requireAdmin, transferOwnership } from "@/lib/admin"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (admin.role !== "owner") {
      return NextResponse.json({ error: "只有终极管理员可以转让身份" }, { status: 403, headers: NO_STORE })
    }

    const { id } = await params
    const result = await transferOwnership(admin.id, id)
    await recordActivity(
      admin.id,
      "transfer_owner",
      `将终极管理员转让给 ${result.nextOwner.email}，自己降级为普通管理员`,
      req
    )

    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CANNOT_TRANSFER_TO_SELF") {
        return NextResponse.json({ error: "不能把终极管理员身份转让给自己" }, { status: 400, headers: NO_STORE })
      }
      if (error.message === "TARGET_NOT_FOUND") {
        return NextResponse.json({ error: "目标用户不存在" }, { status: 404, headers: NO_STORE })
      }
      if (error.message === "TARGET_ALREADY_OWNER") {
        return NextResponse.json({ error: "目标用户已经是终极管理员" }, { status: 400, headers: NO_STORE })
      }
    }

    return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  }
}
