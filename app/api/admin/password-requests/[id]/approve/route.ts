import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { recordActivity, requireAdmin } from "@/lib/admin"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const request = await prisma.passwordChangeRequest.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    })
    if (!request) return NextResponse.json({ error: "申请不存在" }, { status: 404, headers: NO_STORE })
    if (request.status !== "pending") {
      return NextResponse.json({ error: "申请已处理" }, { status: 409, headers: NO_STORE })
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: request.userId },
        data: { passwordHash: request.passwordHash },
      }),
      prisma.passwordChangeRequest.update({
        where: { id },
        data: { status: "approved", respondedAt: new Date(), approvedById: admin.id },
      }),
    ])

    await recordActivity(admin.id, "approve_password_change", `同意 ${request.user.email} 修改密码`, req)
    revalidatePath("/admin")
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  }
}
