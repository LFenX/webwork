import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { siteSettingsSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

async function ensureSettings() {
  return prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  })
}

export async function GET() {
  const settings = await ensureSettings()
  return NextResponse.json(settings, { headers: NO_STORE })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const parsed = siteSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 })
  }
  const settings = await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: parsed.data,
    create: { id: "singleton", ...parsed.data },
  })
  revalidatePath("/")
  revalidatePath("/", "layout")
  return NextResponse.json(settings, { headers: NO_STORE })
}
