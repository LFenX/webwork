import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { requireAdminPermission } from "@/lib/admin"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

async function requireOwner() {
  return requireAdminPermission("manageUpdateLogs")
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ hash: string }> }) {
  try {
    const admin = await requireOwner()
    const { hash } = await params
    const body = await req.json().catch(() => null) as {
      customMessage?: string
      useOriginal?: boolean
      hidden?: boolean
    } | null
    if (!body) return NextResponse.json({ error: "参数错误" }, { status: 400, headers: NO_STORE })

    const entry = await prisma.updateLogOverride.upsert({
      where: { hash },
      update: {
        ...(body.customMessage !== undefined ? { customMessage: body.customMessage } : {}),
        ...(body.useOriginal !== undefined ? { useOriginal: body.useOriginal } : {}),
        ...(body.hidden !== undefined ? { hidden: body.hidden } : {}),
        updatedById: admin.id,
      },
      create: {
        hash,
        customMessage: body.customMessage,
        useOriginal: body.useOriginal ?? true,
        hidden: body.hidden ?? false,
        updatedById: admin.id,
      },
    })
    revalidatePath("/updates")
    return NextResponse.json(entry, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ hash: string }> }) {
  try {
    const admin = await requireOwner()
    const { hash } = await params
    const entry = await prisma.updateLogOverride.upsert({
      where: { hash },
      update: { hidden: true, updatedById: admin.id },
      create: { hash, hidden: true, updatedById: admin.id },
    })
    revalidatePath("/updates")
    return NextResponse.json(entry, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  }
}
