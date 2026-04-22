import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { updateArticleFolderSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = updateArticleFolderSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400, headers: NO_STORE })

  const existing = await prisma.articleFolder.findFirst({ where: { id, userId: session.userId } })
  if (!existing) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })

  const folder = await prisma.articleFolder.update({
    where: { id },
    data: parsed.data,
  })
  revalidatePath(`/${folder.type}`)
  return NextResponse.json(folder, { headers: NO_STORE })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const existing = await prisma.articleFolder.findFirst({ where: { id, userId: session.userId } })
  if (!existing) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })

  await prisma.$transaction([
    prisma.post.updateMany({ where: { folderId: id, userId: session.userId }, data: { folderId: null } }),
    prisma.articleFolder.delete({ where: { id } }),
  ])
  revalidatePath(`/${existing.type}`)
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
