import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } })
  if (user?.role !== "owner") return NextResponse.json({ error: "仅站点所有者可访问" }, { status: 403 })

  // 不在 Next API 主进程里 require/render 未验证主题。
  // 请使用 CLI：npm run resume:verify-themes
  return NextResponse.json({
    ok: false,
    code: "CLI_REQUIRED",
    error: "请在服务器终端运行 npm run resume:verify-themes 进行主题验证。验证通过的主题会自动启用。",
  }, { status: 501 })
}
