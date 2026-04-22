import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "请输入已注册邮箱" }, { status: 400, headers: NO_STORE })
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  })
  if (!user) return NextResponse.json({ request: null }, { headers: NO_STORE })

  const request = await prisma.passwordChangeRequest.findFirst({
    where: { userId: user.id },
    orderBy: { requestedAt: "desc" },
    select: { id: true, status: true, requestedAt: true, respondedAt: true },
  })

  return NextResponse.json({ request }, { headers: NO_STORE })
}
