import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { resumeSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const resume = await prisma.resume.upsert({
    where: { userId: session.userId },
    update: {},
    create: { userId: session.userId },
  })
  return NextResponse.json(resume, { headers: NO_STORE })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json()
  const parsed = resumeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 })

  const resume = await prisma.resume.upsert({
    where: { userId: session.userId },
    update: parsed.data,
    create: { userId: session.userId, ...parsed.data },
  })
  revalidatePath("/resume")
  return NextResponse.json(resume, { headers: NO_STORE })
}
