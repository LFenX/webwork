import { NextRequest, NextResponse } from "next/server"
import fs from "node:fs"
import path from "node:path"
import { getSession } from "@/lib/session"
import { isThemeVerified, isThemeDisabled } from "@/lib/resume/theme-compat"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SNAPSHOT_DIR = path.join(process.cwd(), "data", "resume-theme-snapshots")

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 })

  const slug = req.nextUrl.searchParams.get("slug")?.trim()
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 })
  }

  // 只允许 verified && !disabled 的主题
  if (!isThemeVerified(slug) || isThemeDisabled(slug)) {
    return NextResponse.json({ ok: false, error: "主题不可用" }, { status: 404 })
  }

  const filePath = path.join(SNAPSHOT_DIR, `${slug}.html`)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ ok: false, error: "暂无预览快照，请运行验证脚本" }, { status: 404 })
  }

  try {
    const html = fs.readFileSync(filePath, "utf8")
    return NextResponse.json(
      { ok: true, html },
      { headers: { "Cache-Control": "private, max-age=3600" } },
    )
  } catch {
    return NextResponse.json({ ok: false, error: "读取快照失败" }, { status: 500 })
  }
}
