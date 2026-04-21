import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { resumeSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

async function ensureResume() {
  return prisma.resume.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  })
}

export async function GET() {
  const resume = await ensureResume()
  return NextResponse.json(resume, { headers: NO_STORE })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const parsed = resumeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 })
  }
  const resume = await prisma.resume.upsert({
    where: { id: "singleton" },
    update: parsed.data,
    create: { id: "singleton", ...parsed.data },
  })
  revalidatePath("/resume")
  return NextResponse.json(resume, { headers: NO_STORE })
}
