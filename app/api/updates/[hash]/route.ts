import { NextResponse } from "next/server"
import { getPublicUpdateDetail } from "@/lib/update-log"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params
  const detail = await getPublicUpdateDetail(hash)
  if (!detail) {
    return NextResponse.json({ error: "更新记录不存在或已隐藏" }, { status: 404, headers: NO_STORE })
  }
  return NextResponse.json(detail, { headers: NO_STORE })
}
