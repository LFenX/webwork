import { NextRequest, NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminPermission("manageAnnouncements").catch(() => null)
  if (!admin) return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  const { id } = await params
  await prisma.worldBroadcast.delete({ where: { id } }).catch(() => null)
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
