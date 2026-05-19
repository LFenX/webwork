import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { prisma } from "@/lib/db"
import { publishUserPageChanged } from "@/lib/realtime-events"
import { revalidatePublicUserPaths } from "@/lib/public-revalidation"
import { getSession } from "@/lib/session"
import { moduleVisibilitySchema } from "@/lib/validators"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = moduleVisibilitySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400, headers: NO_STORE })
  }

  const setting = await prisma.moduleVisibility.upsert({
    where: { userId_module: { userId: session.userId, module: parsed.data.module } },
    update: { visibility: parsed.data.visibility },
    create: {
      id: crypto.randomUUID(),
      userId: session.userId,
      module: parsed.data.module,
      visibility: parsed.data.visibility,
    },
  })

  await publishUserPageChanged(session.userId, `module-visibility:${parsed.data.module}`)
  await revalidatePublicUserPaths(session.userId, ["", parsed.data.module])

  return NextResponse.json(setting, { headers: NO_STORE })
}
