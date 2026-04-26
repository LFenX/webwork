import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminPermission } from "@/lib/admin"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission("manageAI")

    const q = req.nextUrl.searchParams.get("q") ?? ""
    const keyword = q.trim()

    let where = undefined
    if (keyword.length >= 1) {
      where = {
        OR: [
          { displayName: { contains: keyword } },
          { email: { contains: keyword } },
        ],
      }
    }

    const users = await prisma.user.findMany({
      where,
      take: keyword.length >= 1 ? 15 : 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        aiUsageGrant: {
          select: { id: true, status: true, providerLabel: true },
        },
      },
    })

    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        hasGrant: Boolean(user.aiUsageGrant),
        grantStatus: user.aiUsageGrant?.status ?? null,
        grantProvider: user.aiUsageGrant?.providerLabel ?? null,
      })),
    }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE })
  }
}
